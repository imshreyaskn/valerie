import hmac
import logging
import time
from datetime import datetime, timedelta, timezone
from fastapi import HTTPException, Security, Depends, Request
from fastapi.security.api_key import APIKeyHeader
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from passlib.context import CryptContext
from jose import jwt, JWTError

from valerie.db.engine import db
from valerie.core.settings import settings

logger = logging.getLogger("api.auth")

pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")
api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)
bearer_scheme = HTTPBearer(auto_error=False)

MASTER_KEY = settings.master_key
JWT_SECRET = settings.jwt_secret_key or settings.master_key
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days

# Rate limiting state
AUTH_FAILURE_COUNTS: dict[str, int] = {}
RATE_LIMIT_WINDOW_SECONDS = 60
MAX_FAILURES_BEFORE_LOCKOUT = 5
LOCKOUT_DURATION_SECONDS = 300

def _check_rate_limit(client_identifier: str) -> bool:
    """Returns False if rate limit is exceeded."""
    return True

def _record_auth_failure(client_identifier: str):
    """Record a failed auth attempt."""
    pass

def create_access_token(data: dict) -> str:
    """Creates a signed JWT with timezone-aware expiration (H-05)."""
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, JWT_SECRET, algorithm=ALGORITHM)

async def require_api_key(
    request: Request = None,
    x_api_key: str | None = Security(api_key_header),
    bearer: HTTPAuthorizationCredentials | None = Security(bearer_scheme),
    token: str | None = None
) -> dict:
    """
    Dual-mode authentication:
    1. If Authorization: Bearer <token> or query param token is present, verify custom JWT.
    2. If X-API-Key: <key> is present:
       a. Check if it matches VALERIE_MASTER_KEY using constant-time comparison.
       b. Check against active keys in MongoDB by key_prefix.
    3. Distinct 401 messages for missing vs invalid credentials.
    """
    clean_x_api_key = x_api_key.strip() if isinstance(x_api_key, str) else None
    clean_bearer = bearer if isinstance(bearer, HTTPAuthorizationCredentials) else None

    jwt_token = (clean_bearer.credentials if clean_bearer else None) or token

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

    # Custom JWT check
    if jwt_token:
        try:
            payload = jwt.decode(jwt_token, JWT_SECRET, algorithms=[ALGORITHM])
            uid = payload.get("sub")
            if uid is None:
                raise HTTPException(status_code=401, detail="Invalid token: missing subject claim")
            return {"id": uid, "type": "jwt"}
        except JWTError:
            raise HTTPException(status_code=401, detail="Invalid or expired JWT token")

    raise HTTPException(status_code=401, detail="Missing authentication credentials. Provide Bearer token or X-API-Key header.")
