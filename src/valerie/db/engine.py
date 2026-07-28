import certifi
from motor.motor_asyncio import AsyncIOMotorClient
import redis.asyncio as redis
from valerie.core.settings import settings

MONGO_URI = settings.database.connection_url
REDIS_URI = settings.redis.url

from typing import Any

# Initialize Motor Client with connection pool tuning and certifi TLS for Windows
try:
    kwargs: dict[str, Any] = {
        "maxPoolSize": 50,
        "minPoolSize": 5,
        "serverSelectionTimeoutMS": 5000,
        "connectTimeoutMS": 5000,
        "socketTimeoutMS": 30000,
    }
    if "+srv" in MONGO_URI or "tls=true" in MONGO_URI.lower():
        kwargs["tlsCAFile"] = certifi.where()
        
    client: AsyncIOMotorClient = AsyncIOMotorClient(
        MONGO_URI,
        **kwargs
    )
except Exception:
    # Fallback to local connection if remote SRV DNS lookup fails (e.g. offline unit test environment)
    client = AsyncIOMotorClient("mongodb://localhost:27017")

db = client[settings.database.database]

# Initialize Redis Client with socket timeout and connection pool
redis_client = redis.from_url(
    REDIS_URI,
    decode_responses=True,
    socket_timeout=5.0,
    socket_connect_timeout=5.0,
    retry_on_timeout=True,
)

