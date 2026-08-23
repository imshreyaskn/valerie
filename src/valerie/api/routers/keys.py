from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from valerie.db.engine import db
from valerie.api.auth import require_api_key, check_rate_limit, client_ip
from valerie.db.models import ApiKey
import uuid
import secrets
from fastapi import Request
from valerie.api.auth import pwd_context

router = APIRouter(prefix="/keys", tags=["Keys"])

MAX_KEYS_PER_USER = 20


class CreateKeyRequest(BaseModel):
    label: str = Field(default="Default Key", min_length=1, max_length=64)


@router.get("/")
async def list_keys(user=Depends(require_api_key)):
    cursor = db.api_keys.find({"user_id": user["id"], "is_active": True}).sort("created_at", -1)
    keys = await cursor.to_list(length=100)
    for k in keys:
        k.pop("_id", None)
        k.pop("key_hash", None)  # Do not return hashes
    return {"keys": keys}

@router.post("/")
async def create_key(payload: CreateKeyRequest, request: Request, user=Depends(require_api_key)):
    # Throttle issuance to prevent key-farming (audit H2).
    await check_rate_limit(f"keycreate:{client_ip(request)}", limit=10)
    active_count = await db.api_keys.count_documents({"user_id": user["id"], "is_active": True})
    if active_count >= MAX_KEYS_PER_USER:
        raise HTTPException(400, f"Maximum of {MAX_KEYS_PER_USER} active keys reached. Revoke unused keys first.")

    raw_key = f"vl_live_{secrets.token_hex(16)}"
    prefix = raw_key[:16]  # vl_live_ + 8 chars
    key_hash = pwd_context.hash(raw_key)

    key_record = ApiKey(
        id=str(uuid.uuid4()),
        user_id=user["id"],
        key_prefix=prefix,
        key_hash=key_hash,
        label=payload.label
    )

    await db.api_keys.insert_one(key_record.model_dump())

    res = key_record.model_dump()
    res.pop("key_hash", None)
    res["api_key"] = raw_key  # Return raw key ONLY ONCE
    return res

@router.delete("/{key_id}")
async def revoke_key(key_id: str, user=Depends(require_api_key)):
    result = await db.api_keys.update_one(
        {"id": key_id, "user_id": user["id"]},
        {"$set": {"is_active": False}}
    )
    if result.modified_count == 0:
        raise HTTPException(404, "Key not found")
    return {"success": True}
