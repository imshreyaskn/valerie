import numpy as np
from fastapi import APIRouter
from valerie.db.engine import db
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/lineage", tags=["Lineage"])

def cosine_distance(vec1: list[float], vec2: list[float]) -> float:
    v1 = np.array(vec1)
    v2 = np.array(vec2)
    norm1 = np.linalg.norm(v1)
    norm2 = np.linalg.norm(v2)
    if norm1 == 0 or norm2 == 0:
        return 0.0
    return 1.0 - (np.dot(v1, v2) / (norm1 * norm2))

@router.get("/runs/{run_id}/tasks/{task_id}")
async def get_task_lineage(run_id: str, task_id: str):
    """
    Retrieves the chronological lineage of prompt mutations for a specific task.
    Includes the semantic distance (cosine difference) between consecutive mutations.
    """
    query = {"task_id": task_id}
    if run_id != "all":
        query["run_id"] = run_id
        
    cursor = db.prompts.find(query).sort("iteration", 1)
    prompts = await cursor.to_list(length=100)
    
    response_chain = []
    
    for i, p in enumerate(prompts):
        # find corresponding finding to get the risk score
        finding = await db.findings.find_one({"prompt_id": p["id"]})
        risk_score = 0.0
        if finding:
            risk_score = finding.get("verdict", {}).get("overall_risk_score", 0.0)
            
        semantic_distance = 0.0
        if i > 0:
            prev_emb = prompts[i-1].get("embedding")
            curr_emb = p.get("embedding")
            if prev_emb and curr_emb:
                semantic_distance = float(cosine_distance(prev_emb, curr_emb))
                
        response_chain.append({
            "id": p["id"],
            "iteration": p.get("iteration", i),
            "text": p.get("text", ""),
            "technique": p.get("technique_id", "unknown"),
            "risk_score": risk_score,
            "semantic_distance_from_parent": semantic_distance,
            "parent_prompt_id": p.get("parent_prompt_id", None)
        })
        
    return {"lineage": response_chain}
