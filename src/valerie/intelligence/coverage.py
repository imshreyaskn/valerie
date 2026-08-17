import logging
import uuid
import pandas as pd
from valerie.db.engine import db
from valerie.core.events import Event, publisher

logger = logging.getLogger("intelligence.coverage")

async def compute_coverage_matrix():
    """
    Computes 3D coverage matrix across (endpoint, domain, technique) using
    streaming MongoDB aggregation (M-04) to prevent memory exhaustion on large datasets.
    """
    logger.info("Computing 3D coverage matrix via database aggregation")
    
    aggregation_pipeline = [
        {"$match": {"selected_techniques": {"$exists": True, "$ne": []}}},
        {"$unwind": "$selected_techniques"},
        {
            "$group": {
                "_id": {
                    "endpoint": "$endpoint_id",
                    "domain": "$domain",
                    "technique": "$selected_techniques"
                },
                "runs_count": {"$sum": 1}
            }
        }
    ]

    cursor = db.pipeline_runs.aggregate(aggregation_pipeline)
    coverage_rows = []
    async for doc in cursor:
        group_id = doc.get("_id", {})
        coverage_rows.append({
            "endpoint": group_id.get("endpoint"),
            "domain": group_id.get("domain"),
            "technique": group_id.get("technique"),
            "runs_count": doc.get("runs_count", 0)
        })

    if not coverage_rows:
        return {
            "total_combinations": 0,
            "covered_combinations": 0,
            "coverage_percent": 0.0,
            "recommendations": [],
            "matrix": []
        }

    df_coverage = pd.DataFrame(coverage_rows)
    endpoints = df_coverage["endpoint"].dropna().unique()
    domains = df_coverage["domain"].dropna().unique()
    techniques = df_coverage["technique"].dropna().unique()

    if len(endpoints) == 0 or len(domains) == 0 or len(techniques) == 0:
        return {
            "total_combinations": len(coverage_rows),
            "covered_combinations": len(coverage_rows),
            "coverage_percent": 100.0,
            "recommendations": [],
            "matrix": coverage_rows
        }

    idx = pd.MultiIndex.from_product([endpoints, domains, techniques], names=["endpoint", "domain", "technique"])
    all_combos = pd.DataFrame(index=idx).reset_index()

    merged = pd.merge(all_combos, df_coverage, on=["endpoint", "domain", "technique"], how="left")
    merged["runs_count"] = merged["runs_count"].fillna(0)

    gaps = merged[merged["runs_count"] == 0]
    recommendations = gaps.head(5).to_dict("records")

    for gap in recommendations:
        try:
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
        except Exception as e:
            logger.debug(f"Could not publish coverage gap event: {e}")

    total_combos = len(all_combos)
    covered_combos = len(coverage_rows)

    return {
        "total_combinations": total_combos,
        "covered_combinations": covered_combos,
        "coverage_percent": (covered_combos / total_combos) * 100 if total_combos > 0 else 0.0,
        "recommendations": recommendations,
        "matrix": coverage_rows
    }
