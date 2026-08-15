from fastapi import APIRouter
from valerie.db.engine import db
from valerie.intelligence.coverage import compute_coverage_matrix

router = APIRouter(prefix="/intelligence", tags=["Intelligence"])

@router.get("/coverage")
async def get_coverage():
    """Returns the gap analysis for execution coverage."""
    return await compute_coverage_matrix()

@router.get("/clusters")
async def get_clusters():
    """Returns discovered attack families (Weaknesses created by Intelligence)."""
    cursor = db.weaknesses.find({"category": "AI_DISCOVERED"})
    weaknesses = await cursor.to_list(length=100)
    
    # We must stringify ObjectId if it gets returned, but our models use string `id` field.
    # We'll just return the dicts directly, excluding `_id`.
    for w in weaknesses:
        if "_id" in w:
            del w["_id"]
            
    return {"clusters": weaknesses}
    
@router.get("/feed")
async def get_intelligence_feed():
    """
    Returns the latest anomaly and pattern findings.
    (This is a REST placeholder; the real feed is over Redis Streams)
    """
    return {"message": "Connect to Redis Streams for live feed (anomaly.detected, weakness.discovered)."}
