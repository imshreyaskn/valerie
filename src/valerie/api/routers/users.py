import re
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from valerie.db.engine import db
from valerie.api.auth import (
    require_api_key,
    create_access_token,
    pwd_context,
    check_rate_limit,
    check_auth_lockout,
    client_ip,
)

router = APIRouter(prefix="/users", tags=["Users"])

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class AuthRequest(BaseModel):
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=8, max_length=128)

    @classmethod
    def validate_email(cls, value: str) -> str:
        if not _EMAIL_RE.match(value):
            raise ValueError("Invalid email address")
        return value.lower()


async def _auth_throttle(request: Request, email: str) -> None:
    """Brute-force protection: per-IP and per-account limits plus lockout."""
    ip = client_ip(request)
    await check_rate_limit(f"login-ip:{ip}", limit=10)
    account = email.lower()
    await check_auth_lockout(f"acct:{account}")


def _normalize(req: AuthRequest) -> tuple[str, str]:
    try:
        email = AuthRequest.validate_email(req.email)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    return email, req.password


@router.post("/register")
async def register(req: AuthRequest, request: Request):
    email, password = _normalize(req)
    await check_rate_limit(f"register-ip:{client_ip(request)}", limit=5)

    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(400, "Email already registered")

    uid = str(uuid.uuid4())
    hashed_pwd = pwd_context.hash(password)

    await db.users.insert_one({
        "uid": uid,
        "email": email,
        "hashed_password": hashed_pwd,
        "display_name": email.split("@")[0],
        "created_at": datetime.now(timezone.utc)
    })

    token = create_access_token({"sub": uid})
    return {"token": token, "access_token": token, "uid": uid, "email": email}

@router.post("/login")
async def login(req: AuthRequest, request: Request):
    email, password = _normalize(req)
    await _auth_throttle(request, email)

    user = await db.users.find_one({"email": email})
    if not user or not user.get("hashed_password"):
        raise HTTPException(401, "Invalid email or password")

    if not pwd_context.verify(password, user["hashed_password"]):
        raise HTTPException(401, "Invalid email or password")

    token = create_access_token({"sub": user["uid"]})
    return {"token": token, "access_token": token, "uid": user["uid"], "email": user["email"]}

@router.get("/me")
async def get_me(user=Depends(require_api_key)):
    user_doc = await db.users.find_one({"uid": user["id"]})
    if not user_doc:
        raise HTTPException(404, "User not found")
    user_doc.pop("_id", None)
    user_doc.pop("hashed_password", None)
    return user_doc

@router.delete("/me")
async def delete_me(user=Depends(require_api_key)):
    await db.users.update_one({"uid": user["id"]}, {"$set": {"is_deleted": True}})
    return {"success": True}
