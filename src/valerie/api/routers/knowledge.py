from typing import Annotated

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from valerie.db.engine import db
from valerie.knowledge.embedding import compute_embedding
from valerie.api.auth import require_api_key


router = APIRouter(prefix="/knowledge", tags=["Knowledge"])

MAX_PAGE_SIZE = 200


async def _owned_run_filter(user: dict) -> dict | None:
    if user["id"] == "admin_master":
        return None
    cursor = db.pipeline_runs.find({"user_id": user["id"]}, {"id": 1}).sort("created_at", -1).limit(1000)
    docs = await cursor.to_list(length=1000)
    run_ids = [d["id"] for d in docs if "id" in d]
    if not run_ids:
        return {"run_id": "__none__"}
    return {"run_id": {"$in": run_ids}}


@router.get("/findings")
async def get_findings(
    limit: Annotated[int, Query(ge=1, le=MAX_PAGE_SIZE)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
    user=Depends(require_api_key),
):
    query = await _owned_run_filter(user)
    cursor = db.findings.find(query).sort("created_at", -1).skip(offset).limit(limit)
    findings = await cursor.to_list(length=limit)
    for f in findings:
        f.pop("_id", None)
    return {"findings": findings}

@router.get("/weaknesses")
async def get_weaknesses(
    limit: Annotated[int, Query(ge=1, le=MAX_PAGE_SIZE)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
    user=Depends(require_api_key),
):
    # Weaknesses are platform-level aggregate intelligence (AI_DISCOVERED);
    # authenticated users share the library, but access requires auth.
    cursor = db.weaknesses.find({}).sort("first_seen", -1).skip(offset).limit(limit)
    weaknesses = await cursor.to_list(length=limit)
    for w in weaknesses:
        w.pop("_id", None)
    return {"weaknesses": weaknesses}

class SearchRequest(BaseModel):
    query: str = Field(min_length=1, max_length=2048)
    limit: int = Field(default=10, ge=1, le=50)

@router.post("/search")
async def semantic_search(req: SearchRequest, user=Depends(require_api_key)):
    embedding = await compute_embedding(req.query)

    # Vector search stub: contract in place, returns most recent prompts.
    # Scoped to the caller's runs when not admin.
    match_stage = await _owned_run_filter(user)
    pipeline: list[dict] = [
        {"$match": match_stage} if match_stage else {"$match": {}},
        {"$sort": {"created_at": -1}},
        {"$limit": req.limit},
        {"$project": {"embedding": 0, "_id": 0}}
    ]

    cursor = db.prompts.aggregate(pipeline)
    results = await cursor.to_list(length=req.limit)

    return {"results": results}
