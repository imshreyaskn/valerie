import numpy as np
from sklearn.cluster import DBSCAN
import logging
from valerie.db.engine import db
from valerie.core.events import Event, publisher
from valerie.knowledge.entities import Weakness
import uuid

logger = logging.getLogger(__name__)

async def run_prompt_clustering():
    """
    Empirically clusters prompt embeddings into attack families.
    Identifies natural groupings (Weaknesses) independent of static tags.
    """
    logger.info("Running Prompt Clustering (DBSCAN over embeddings)")
    
    # Fetch all prompts with embeddings
    cursor = db.prompts.find({"embedding": {"$exists": True}})
    prompts = await cursor.to_list(length=10000)
    
    valid_prompts = []
    for p in prompts:
        emb_raw = p.get("embedding")
        if emb_raw and len(emb_raw) > 0:
            emb = np.array(emb_raw)
            if np.any(emb): # Skip zero-vectors
                valid_prompts.append(p)
            
    if len(valid_prompts) < 10:
        logger.info("Not enough valid prompts for meaningful clustering. Skipping.")
        return
        
    embeddings = np.array([p["embedding"] for p in valid_prompts])
    prompt_ids = [p["id"] for p in valid_prompts]
    
    # Run DBSCAN using cosine distance (0.15 represents high semantic similarity)
    clustering = DBSCAN(eps=0.15, min_samples=3, metric="cosine").fit(embeddings)
    
    clusters = {}
    for i, label in enumerate(clustering.labels_):
        if label == -1:
            continue # Noise
        clusters.setdefault(label, []).append(prompt_ids[i])
        
    logger.info(f"Found {len(clusters)} distinct clusters.")
    
    for label, p_ids in clusters.items():
        # Check if we already have a weakness mapping these prompts
        # We will do a simplified mapping: if a weakness contains the majority of these prompts, update it.
        # Otherwise, create a new weakness.
        
        # Find findings associated with these prompts
        finding_cursor = db.findings.find({"prompt_id": {"$in": p_ids}, "is_breakthrough": True})
        findings = await finding_cursor.to_list(length=10000)
        finding_ids = [f["id"] for f in findings]
        endpoint_ids = list(set([f["endpoint_id"] for f in findings]))
        
        if not findings:
            continue # No breakthroughs in this cluster, not a weakness
            
        techniques = list(set([f.get("technique_id") for f in findings if f.get("technique_id")]))
        domains = list(set([f.get("domain") for f in findings if f.get("domain")]))
        primary_tech = techniques[0].replace("_", " ").title() if techniques else "Adversarial"
        primary_domain = domains[0].upper() if domains else "CROSS-DOMAIN"

        weakness_name = f"{primary_tech} Exploit Topology ({primary_domain})"
        description = f"Empirical semantic cluster of {len(findings)} confirmed breakthroughs utilizing {primary_tech.lower()} in {primary_domain} evaluation sweeps."
        density = round(len(findings) / max(1, len(p_ids)), 2)

        # Upsert Weakness entity
        existing = await db.weaknesses.find_one({"name": weakness_name})
        if existing:
            await db.weaknesses.update_one(
                {"_id": existing["_id"]},
                {"$set": {
                    "description": description,
                    "finding_ids": list(set(existing.get("finding_ids", []) + finding_ids)),
                    "affected_endpoint_ids": list(set(existing.get("affected_endpoint_ids", []) + endpoint_ids)),
                    "cluster_density": density,
                    "trend": "emerging" if len(findings) > 5 else "stable",
                }}
            )
            weakness_id = existing["id"]
        else:
            new_weakness = Weakness(
                name=weakness_name,
                description=description,
                category="AI_DISCOVERED",
                finding_ids=finding_ids,
                affected_endpoint_ids=endpoint_ids,
                cluster_density=density,
                trend="emerging" if len(findings) > 5 else "stable"
            )
            await db.weaknesses.insert_one(new_weakness.model_dump(mode="json"))
            weakness_id = new_weakness.id
            
            await publisher.publish(Event(
                type="weakness.discovered",
                source="intelligence.clustering",
                correlation_id=str(uuid.uuid4()),
                payload={"weakness_id": weakness_id, "cluster_size": len(p_ids), "density": density}
            ))
