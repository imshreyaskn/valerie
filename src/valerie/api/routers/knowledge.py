import typing
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from valerie.db.engine import db
from valerie.knowledge.embedding import compute_embedding
from valerie.api.auth import require_api_key


router = APIRouter(prefix="/knowledge", tags=["Knowledge"])

@router.get("/findings")
async def get_findings(limit: int = 50, offset: int = 0, user=Depends(require_api_key)):
    cursor = db.findings.find({}).sort("created_at", -1).skip(offset).limit(limit)
    findings = await cursor.to_list(length=limit)
    for f in findings:
        f.pop("_id", None)
    return {"findings": findings}

@router.get("/weaknesses")
async def get_weaknesses(limit: int = 50, offset: int = 0, user=Depends(require_api_key)):
    cursor = db.weaknesses.find({}).sort("first_seen", -1).skip(offset).limit(limit)
    weaknesses = await cursor.to_list(length=limit)
    for w in weaknesses:
        w.pop("_id", None)
    return {"weaknesses": weaknesses}

class SearchRequest(BaseModel):
    query: str
    limit: int = 10

@router.post("/search")
async def semantic_search(req: SearchRequest, user=Depends(require_api_key)):
    embedding = await compute_embedding(req.query)
    
    # In a real Mongo Atlas setup, we would use $vectorSearch.
    # Since we don't have Atlas running locally in this stub, we will 
    # mock the vector search with a basic find for demonstration, 
    # but the API contract is now in place.
    # To truly simulate, we just return the most recent prompts.
    
    pipeline: list[dict[str, typing.Any]] = [
        {"$sort": {"created_at": -1}},
        {"$limit": req.limit},
        {"$project": {"embedding": 0, "_id": 0}}
    ]
    
    cursor = db.prompts.aggregate(pipeline)
    results = await cursor.to_list(length=req.limit)
    
    return {"results": results}

