import hmac
import logging
import time
from datetime import datetime, timedelta, timezone

import jwt as pyjwt
from fastapi import HTTPException, Security, Depends, Request
from fastapi.security.api_key import APIKeyHeader
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from passlib.context import CryptContext

from valerie.db.engine import db
from valerie.core.settings import settings

logger = logging.getLogger("api.auth")

pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")
api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)
bearer_scheme = HTTPBearer(auto_error=False)

MASTER_KEY = settings.master_key
JWT_SECRET = settings.jwt_secret_key  # No fallback to master key: distinct secrets by design.
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 hours
SSE_TOKEN_TTL_SECONDS = 120
SSE_TOKEN_AUDIENCE = "valerie:sse"

# ---------------------------------------------------------------------------
# Rate limiting (Redis fixed-window with in-memory fallback)
# ---------------------------------------------------------------------------

RATE_LIMIT_WINDOW_SECONDS = 60
MAX_FAILURES_BEFORE_LOCKOUT = 5
LOCKOUT_DURATION_SECONDS = 300

# In-memory fallback used only when Redis is unreachable (single-process dev).
_memory_counters: dict[str, list[float]] = {}


def _redis() -> object | None:
    try:
        from valerie.db.engine import redis_client
        return redis_client
    except Exception:
        return None


async def _incr_window(key: str, window_seconds: int) -> int:
    """Increment a fixed-window counter; returns the current count."""
    r = _redis()
    if r is not None:
        try:
            bucket = f"valerie:rl:{key}"
            pipe = r.pipeline()
            pipe.incr(bucket)
            pipe.expire(bucket, window_seconds)
            count, _ = await pipe.execute()
            return int(count)
        except Exception as e:
            logger.warning(f"Redis rate-limit backend unavailable ({e}); using in-memory fallback")
    now = time.monotonic()
    window_start = now - window_seconds
    entries = [t for t in _memory_counters.get(key, []) if t > window_start]
    entries.append(now)
    _memory_counters[key] = entries[-1000:]
    return len(entries)


async def check_rate_limit(identifier: str, limit: int, window_seconds: int = RATE_LIMIT_WINDOW_SECONDS) -> None:
    """
    Raises 429 when `identifier` exceeds `limit` actions per window.
    Used for login/register brute-force protection and key issuance.
    """
    count = await _incr_window(identifier, window_seconds)
    if count > limit:
        raise HTTPException(
            status_code=429,
            detail="Too many requests. Please slow down and try again later.",
        )


async def check_auth_lockout(client_identifier: str) -> None:
    """Raises 403 while the identifier is locked out after repeated auth failures."""
    lockout_key = f"lockout:{client_identifier}"
    count = await _incr_window(lockout_key, LOCKOUT_DURATION_SECONDS)
    if count > MAX_FAILURES_BEFORE_LOCKOUT:
        raise HTTPException(
            status_code=403,
            detail=f"Account temporarily locked due to repeated failures. Try again in {LOCKOUT_DURATION_SECONDS}s.",
        )


def client_ip(request: Request | None) -> str:
    if request is None:
        return "unknown"
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


# ---------------------------------------------------------------------------
# Token creation
# ---------------------------------------------------------------------------

def create_access_token(data: dict) -> str:
    """Creates a signed JWT with timezone-aware expiration."""
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return pyjwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)


def create_stream_token(user_id: str, run_id: str | None = None) -> str:
    """
    Short-lived token scoped to SSE streaming so EventSource (which cannot set
    headers) never needs the long-lived session JWT in a URL.
    """
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "aud": SSE_TOKEN_AUDIENCE,
        "run_id": run_id,
        "iat": now,
        "exp": now + timedelta(seconds=SSE_TOKEN_TTL_SECONDS),
    }
    return pyjwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


# ---------------------------------------------------------------------------
# Authentication dependency
# ---------------------------------------------------------------------------

def _decode_jwt(token: str, expect_sse_audience: bool = False) -> dict:
    try:
        kwargs: dict = {"algorithms": [JWT_ALGORITHM]}
        if expect_sse_audience:
            kwargs["audience"] = SSE_TOKEN_AUDIENCE
        payload = pyjwt.decode(token, JWT_SECRET, **kwargs)
    except pyjwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    uid = payload.get("sub")
    if not uid:
        raise HTTPException(status_code=401, detail="Invalid token: missing subject claim")
    return payload


async def require_api_key(
    request: Request = None,  # type: ignore[assignment]
    x_api_key: str | None = Security(api_key_header),
    bearer: HTTPAuthorizationCredentials | None = Security(bearer_scheme),
    token: str | None = None,
) -> dict:
    """
    Dual-mode authentication:
    1. Authorization: Bearer <jwt> — standard API access.
    2. Query param ?token= — accepted ONLY for short-lived SSE stream tokens
       (audience-restricted), because EventSource cannot send headers.
    3. X-API-Key header — master key or hashed per-user platform keys.
    """
    clean_x_api_key = x_api_key.strip() if isinstance(x_api_key, str) else None
    clean_bearer = bearer.credentials if isinstance(bearer, HTTPAuthorizationCredentials) else None
    clean_query_token = token.strip() if isinstance(token, str) else None

    # Master Key check (X-API-Key header)
    if clean_x_api_key:
        if hmac.compare_digest(clean_x_api_key.encode("utf-8"), MASTER_KEY.encode("utf-8")):
            return {"id": "admin_master", "type": "master_key", "role": "admin"}

        if not clean_x_api_key.startswith("vl_live_"):
            raise HTTPException(status_code=401, detail="Invalid API Key format")

        prefix = clean_x_api_key[:16]  # vl_live_ + 8 chars

        try:
            key_doc = await db.api_keys.find_one({"key_prefix": prefix, "is_active": True})
            if key_doc and pwd_context.verify(clean_x_api_key, key_doc["key_hash"]):
                return {"id": key_doc["user_id"], "type": "api_key", "key_id": key_doc["id"]}
        except Exception as e:
            logger.warning(f"Database query error during API key verification: {e}")

        raise HTTPException(status_code=401, detail="Invalid API Key provided")

    # Standard Bearer JWT
    if clean_bearer:
        payload = _decode_jwt(clean_bearer)
        return {"id": payload["sub"], "type": "jwt"}

    # Short-lived SSE token via query param (audience-restricted)
    if clean_query_token:
        payload = _decode_jwt(clean_query_token, expect_sse_audience=True)
        identity = {"id": payload["sub"], "type": "sse_token"}
        if payload.get("run_id"):
            identity["run_id"] = payload["run_id"]
        return identity

    raise HTTPException(
        status_code=401,
        detail="Missing authentication credentials. Provide Bearer token or X-API-Key header.",
    )
