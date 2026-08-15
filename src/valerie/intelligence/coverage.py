import pandas as pd
from valerie.db.engine import db
import logging
import uuid
from valerie.core.events import Event, publisher

logger = logging.getLogger(__name__)

async def compute_coverage_matrix():
    logger.info("Computing 3D coverage matrix")
    
    # Look at all pipeline_runs to see what has been tested.
    cursor = db.pipeline_runs.find({})
    runs = await cursor.to_list(length=10000)
    
    if not runs:
        return {"matrix": [], "recommendations": [], "coverage_percent": 0.0}
        
    data = []
    for r in runs:
        endpoint = r.get("endpoint_id")
        domain = r.get("domain")
        for tech in r.get("selected_techniques", []):
            data.append({"endpoint": endpoint, "domain": domain, "technique": tech})
            
    if not data:
        return {"matrix": [], "recommendations": [], "coverage_percent": 0.0}

    df = pd.DataFrame(data)
    
    # Aggregate counts
    coverage = df.groupby(["endpoint", "domain", "technique"]).size().reset_index(name='runs_count')
    
    # Find all unique endpoints, domains, and techniques to find the complement (gaps)
    endpoints = df["endpoint"].unique()
    domains = df["domain"].unique()
    techniques = df["technique"].unique()
    
    # Create multiindex of all combinations
    idx = pd.MultiIndex.from_product([endpoints, domains, techniques], names=["endpoint", "domain", "technique"])
    all_combos = pd.DataFrame(index=idx).reset_index()
    
    merged = pd.merge(all_combos, coverage, on=["endpoint", "domain", "technique"], how="left")
    merged["runs_count"] = merged["runs_count"].fillna(0)
    
    gaps = merged[merged["runs_count"] == 0]
    recommendations = gaps.head(5).to_dict("records")
    
    # Emit events for the top gaps to trigger learning/exploration
    for gap in recommendations:
        await publisher.publish(Event(
            type="coverage.gap",
            source="intelligence.coverage",
            correlation_id=str(uuid.uuid4()),
            payload={
                "endpoint_id": gap["endpoint"],
                "domain": gap["domain"],
                "technique": gap["technique"]
            }
        ))
    
    return {
        "total_combinations": len(all_combos),
        "covered_combinations": len(coverage),
        "coverage_percent": (len(coverage) / len(all_combos)) * 100 if len(all_combos) > 0 else 0,
        "recommendations": recommendations,
        "matrix": coverage.to_dict("records")
    }
