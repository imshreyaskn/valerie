from fastapi import APIRouter, Depends, HTTPException
from valerie.db.engine import db
from valerie.api.auth import require_api_key
from valerie.db.models import Endpoint
import uuid
import httpx

router = APIRouter(prefix="/endpoints", tags=["Endpoints"])

@router.get("/")
async def list_endpoints(user=Depends(require_api_key)):
    cursor = db.endpoints.find({"user_id": user["id"]}).sort("created_at", -1)
    endpoints = await cursor.to_list(length=100)
    for e in endpoints:
        e.pop("_id", None)
    return {"endpoints": endpoints}

@router.post("/")
async def create_endpoint(payload: dict, user=Depends(require_api_key)):
    endpoint = Endpoint(
        id=str(uuid.uuid4()),
        user_id=user["id"],
        name=payload.get("name", "Unnamed Endpoint"),
        provider=payload.get("provider", "custom"),
        base_url=payload.get("base_url"),
        api_key=payload.get("api_key"),
        custom_payload_template=payload.get("custom_payload_template"),
        custom_response_path=payload.get("custom_response_path"),
        custom_headers=payload.get("custom_headers")
    )
    await db.endpoints.insert_one(endpoint.model_dump())
    return endpoint.model_dump()

@router.delete("/{endpoint_id}")
async def delete_endpoint(endpoint_id: str, user=Depends(require_api_key)):
    query = {"id": endpoint_id} if user["id"] == "admin_master" else {"id": endpoint_id, "user_id": user["id"]}
    endpoint = await db.endpoints.find_one(query)
    if not endpoint:
        raise HTTPException(404, "Endpoint not found")

    # Cascade check: prevent deleting endpoints attached to active runs (D-05)
    active_run = await db.pipeline_runs.find_one({"endpoint_id": endpoint_id, "status": {"$in": ["queued", "running"]}})
    if active_run:
        raise HTTPException(status_code=400, detail=f"Cannot delete endpoint: active pipeline run '{active_run['id']}' is relying on it.")

    await db.endpoints.delete_one({"id": endpoint_id})
    return {"success": True, "deleted_id": endpoint_id}


@router.post("/{endpoint_id}/test")
async def test_endpoint(endpoint_id: str, user=Depends(require_api_key)):
    query = {"id": endpoint_id} if user["id"] == "admin_master" else {"id": endpoint_id, "user_id": user["id"]}
    endpoint = await db.endpoints.find_one(query)
    if not endpoint:
        raise HTTPException(404, "Endpoint not found")
        
    provider = endpoint.get("provider")
    base_url = endpoint.get("base_url")
    api_key = endpoint.get("api_key")
    
    if base_url:
        from valerie.llm.validator import is_safe_url
        is_safe, reason = is_safe_url(base_url)
        if not is_safe:
            return {"status": "error", "detail": f"Forbidden target URL: {reason}"}

    try:

        async with httpx.AsyncClient(timeout=10.0) as client:
            if provider == "openai_compat":
                resp = await client.get(f"{base_url}/models", headers={"Authorization": f"Bearer {api_key}"} if api_key else {})
                resp.raise_for_status()
            elif provider == "anthropic":
                # Basic ping not easily available without a chat completion, but we can check if it resolves
                resp = await client.get("https://api.anthropic.com/v1/models", headers={"x-api-key": api_key, "anthropic-version": "2023-06-01"})
                resp.raise_for_status()
            # other providers omitted for brevity; this is a best-effort test
            return {"status": "ok"}
    except Exception as e:
        return {"status": "error", "detail": str(e)}
