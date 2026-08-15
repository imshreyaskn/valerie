import hmac
import logging
import time
from datetime import datetime, timedelta
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
JWT_SECRET = settings.jwt_secret_key
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days

# Rate limiting state (simple in-memory for now)
AUTH_FAILURE_COUNTS: dict[str, int] = {}
RATE_LIMIT_WINDOW_SECONDS = 60
MAX_FAILURES_BEFORE_LOCKOUT = 5
LOCKOUT_DURATION_SECONDS = 300

def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, JWT_SECRET, algorithm=ALGORITHM)

def _check_rate_limit(client_identifier: str) -> bool:
    """
    Rate limiting for authentication attempts.
    Returns True if the request should be allowed, False if rate limited.
    """
    current_time = time.time()
    
    # Clean up old entries
    expired_keys = [
        k for k, v in AUTH_FAILURE_COUNTS.items() 
        if isinstance(v, tuple) and current_time - v[1] > RATE_LIMIT_WINDOW_SECONDS
    ]
    for k in expired_keys:
        del AUTH_FAILURE_COUNTS[k]
    
    # Check if currently locked out
    if client_identifier in AUTH_FAILURE_COUNTS:
        value = AUTH_FAILURE_COUNTS[client_identifier]
        if isinstance(value, tuple):
            failures, lockout_time = value
            if current_time - lockout_time < LOCKOUT_DURATION_SECONDS:
                return False
            # Lockout expired, reset
            AUTH_FAILURE_COUNTS[client_identifier] = (0, current_time)
    
    return True

def _record_auth_failure(client_identifier: str):
    """Record an authentication failure for rate limiting."""
    current_time = time.time()
    
    if client_identifier not in AUTH_FAILURE_COUNTS:
        AUTH_FAILURE_COUNTS[client_identifier] = (1, current_time)
        return
    
    value = AUTH_FAILURE_COUNTS[client_identifier]
    if isinstance(value, tuple):
        failures, window_start = value
        if current_time - window_start > RATE_LIMIT_WINDOW_SECONDS:
            # Window expired, start fresh
            AUTH_FAILURE_COUNTS[client_identifier] = (1, current_time)
            return
        
        new_failures = failures + 1
        if new_failures >= MAX_FAILURES_BEFORE_LOCKOUT:
            # Lockout the client
            AUTH_FAILURE_COUNTS[client_identifier] = (new_failures, current_time)
            logger.warning(
                f"Authentication rate limit exceeded for {client_identifier}. "
                f"Locked out for {LOCKOUT_DURATION_SECONDS}s"
            )
        else:
            AUTH_FAILURE_COUNTS[client_identifier] = (new_failures, window_start)
    else:
        AUTH_FAILURE_COUNTS[client_identifier] = (value + 1, current_time)

async def require_api_key(
    request: Request,
    x_api_key: str | None = Security(api_key_header),
    bearer: HTTPAuthorizationCredentials | None = Security(bearer_scheme),
    token: str | None = None
) -> dict:
    """
    Dual-mode authentication with rate limiting and proper error handling:
    1. If Authorization: Bearer <token> or query param token is present, verify custom JWT.
    2. If X-API-Key: <key> is present:
       a. Check if it matches VALERIE_MASTER_KEY using constant-time comparison.
       b. Check against active keys in MongoDB by key_prefix.
    3. Distinct 401 messages for missing vs invalid credentials.
    4. Rate limiting on failed attempts.
    """
    # Extract client identifier for rate limiting
    client_ip = request.client.host if request.client else "unknown"
    x_forwarded_for = request.headers.get("x-forwarded-for")
    if x_forwarded_for:
        client_ip = x_forwarded_for.split(",")[0].strip()
    
    client_identifier = f"auth:{client_ip}"
    
    # Check rate limit before processing
    if not _check_rate_limit(client_identifier):
        logger.warning(f"Authentication rate limit exceeded for {client_ip}")
        raise HTTPException(
            status_code=429, 
            detail=f"Too many authentication failures. Try again in {LOCKOUT_DURATION_SECONDS} seconds."
        )
    
    # Safely unwrap parameters - fail fast if None when required
    if x_api_key is None or not isinstance(x_api_key, str):
        clean_x_api_key = None
    else:
        clean_x_api_key = x_api_key.strip()
    
    if bearer is None or not isinstance(bearer, HTTPAuthorizationCredentials):
        clean_bearer = None
    else:
        clean_bearer = bearer

    jwt_token = (clean_bearer.credentials if clean_bearer else None) or token

    # Master Key check (X-API-Key header)
    if clean_x_api_key:
        # Validate format first (fail fast)
        if not clean_x_api_key.startswith("vl_live_") and clean_x_api_key != MASTER_KEY:
            _record_auth_failure(client_identifier)
            raise HTTPException(status_code=401, detail="Invalid API Key format")
        
        # Constant-time comparison to prevent side-channel timing attacks
        if hmac.compare_digest(clean_x_api_key.encode("utf-8"), MASTER_KEY.encode("utf-8")):
            logger.info(f"Master key authentication successful from {client_ip}")
            return {"id": "admin_master", "type": "master_key", "role": "admin"}

        # Database lookup for user API keys
        prefix = clean_x_api_key[:16]  # vl_live_ + 8 chars
        
        try:
            key_doc = await db.api_keys.find_one({"key_prefix": prefix, "is_active": True})
            if key_doc:
                # Verify the full key against stored hash
                if pwd_context.verify(clean_x_api_key, key_doc["key_hash"]):
                    logger.info(f"API key authentication successful for user {key_doc['user_id']}")
                    return {"id": key_doc["user_id"], "type": "api_key", "key_id": key_doc["id"]}
        except Exception as e:
            # Log but don't expose internal errors
            logger.error(f"Database error during API key verification: {e}")
            # Don't record failure - this is a system error, not auth failure
        
        # Authentication failed
        _record_auth_failure(client_identifier)
        logger.warning(f"Invalid API key attempt from {client_ip}")
        raise HTTPException(status_code=401, detail="Invalid API Key provided")

    # Custom JWT check
    if jwt_token:
        try:
            payload = jwt.decode(jwt_token, JWT_SECRET, algorithms=[ALGORITHM])
            uid = payload.get("sub")
            if uid is None:
                _record_auth_failure(client_identifier)
                raise HTTPException(status_code=401, detail="Invalid token: missing subject claim")
            logger.info(f"JWT authentication successful for user {uid}")
            return {"id": uid, "type": "jwt"}
        except JWTError as e:
            _record_auth_failure(client_identifier)
            logger.warning(f"Invalid JWT token from {client_ip}: {e}")
            raise HTTPException(status_code=401, detail="Invalid or expired JWT token")

    # No credentials provided
    logger.warning(f"Missing authentication credentials from {client_ip}")
    raise HTTPException(status_code=401, detail="Missing authentication credentials. Provide Bearer token or X-API-Key header.")

