from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from valerie.db.engine import db
from valerie.api.auth import require_api_key
from valerie.core.crypto import encrypt_secret, decrypt_secret, mask_secret
from valerie.db.models import Endpoint
import uuid
import httpx

router = APIRouter(prefix="/endpoints", tags=["Endpoints"])


class EndpointCreate(BaseModel):
    name: str = Field(default="Unnamed Endpoint", min_length=1, max_length=128)
    provider: str = Field(default="custom", max_length=64)
    base_url: str | None = Field(default=None, max_length=2048)
    api_key: str | None = Field(default=None, max_length=2048)
    custom_payload_template: dict | str | None = None
    custom_response_path: str | None = Field(default=None, max_length=256)
    custom_headers: dict[str, str] | None = None


def _public_endpoint(doc: dict) -> dict:
    """Strip storage internals; never return the raw BYOK key."""
    doc.pop("_id", None)
    doc["api_key"] = mask_secret(decrypt_secret(doc.get("api_key")))
    return doc


@router.get("/")
async def list_endpoints(user=Depends(require_api_key)):
    cursor = db.endpoints.find({"user_id": user["id"]}).sort("created_at", -1)
    endpoints = await cursor.to_list(length=100)
    return {"endpoints": [_public_endpoint(e) for e in endpoints]}

@router.post("/")
async def create_endpoint(payload: EndpointCreate, user=Depends(require_api_key)):
    # Fail fast on unsafe target URLs instead of only at test/run time.
    if payload.base_url:
        from valerie.llm.validator import is_safe_url
        is_safe, reason = is_safe_url(payload.base_url)
        if not is_safe:
            raise HTTPException(status_code=400, detail=f"Forbidden target URL: {reason}")

    endpoint = Endpoint(
        id=str(uuid.uuid4()),
        user_id=user["id"],
        name=payload.name,
        provider=payload.provider,
        base_url=payload.base_url,
        api_key=encrypt_secret(payload.api_key),
        custom_payload_template=payload.custom_payload_template,
        custom_response_path=payload.custom_response_path,
        custom_headers=payload.custom_headers
    )
    await db.endpoints.insert_one(endpoint.model_dump())
    return _public_endpoint(endpoint.model_dump())

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
    api_key = decrypt_secret(endpoint.get("api_key"))

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
                resp = await client.get("https://api.anthropic.com/v1/models", headers={"x-api-key": api_key, "anthropic-version": "2023-06-01"})
                resp.raise_for_status()
            return {"status": "ok"}
    except Exception as e:
        # Return the exception class plus a truncated message; avoid leaking
        # full stack traces or internal hostnames to the client.
        return {"status": "error", "detail": f"{type(e).__name__}: {str(e)[:200]}"}
