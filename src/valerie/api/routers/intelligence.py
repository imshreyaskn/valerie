from fastapi import APIRouter, Depends
from valerie.db.engine import db
from valerie.intelligence.coverage import compute_coverage_matrix
from valerie.api.auth import require_api_key

router = APIRouter(prefix="/intelligence", tags=["Intelligence"])


@router.get("/coverage")
async def get_coverage(user=Depends(require_api_key)):
    """Returns the gap analysis for execution coverage (owner-scoped)."""
    user_id = None if user["id"] == "admin_master" else user["id"]
    return await compute_coverage_matrix(user_id=user_id)

@router.get("/clusters")
async def get_clusters(user=Depends(require_api_key)):
    """Returns discovered attack families (Weaknesses created by Intelligence)."""
    cursor = db.weaknesses.find({"category": "AI_DISCOVERED"})
    weaknesses = await cursor.to_list(length=100)

    for w in weaknesses:
        if "_id" in w:
            del w["_id"]

    return {"clusters": weaknesses}

@router.get("/feed")
async def get_intelligence_feed(user=Depends(require_api_key)):
    """
    Returns the latest anomaly and pattern findings.
    (This is a REST placeholder; the real feed is over Redis Streams)
    """
    return {"message": "Connect to Redis Streams for live feed (anomaly.detected, weakness.discovered)."}
