import asyncio
import logging
from typing import Any

import certifi
from motor.motor_asyncio import AsyncIOMotorClient
import redis.asyncio as redis

from valerie.core.settings import settings

logger = logging.getLogger("valerie.db.engine")

MONGO_URI = settings.database.connection_url
REDIS_URI = settings.redis.url

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
    logger.info("MongoDB client initialized successfully")
except Exception as e:
    # Fallback to local connection if remote SRV DNS lookup fails (e.g. offline unit test environment)
    logger.warning(f"Failed to initialize MongoDB client with URI: {MONGO_URI}. Falling back to localhost. Error: {e}")
    client = AsyncIOMotorClient("mongodb://localhost:27017")

db = client[settings.database.database]

# Initialize Redis Client with socket timeout and connection pool
try:
    redis_client = redis.from_url(
        REDIS_URI,
        decode_responses=True,
        socket_timeout=5.0,
        socket_connect_timeout=5.0,
        retry_on_timeout=True,
    )
    logger.info("Redis client initialized successfully")
except Exception as e:
    logger.warning(f"Failed to initialize Redis client with URI: {REDIS_URI}. Error: {e}")
    redis_client = redis.Redis(
        host="localhost",
        port=6379,
        db=0,
        decode_responses=True,
        socket_timeout=5.0,
        socket_connect_timeout=5.0,
    )


async def close_db_connections(timeout: float = 5.0):
    """
    Gracefully and safely closes MongoDB and Redis connection pools with timeouts (H-03).

    This prevents connection leaks and resource exhaustion in long-running servers.
    Should be called during application lifespan shutdown.
    """
    logger.info("Closing database and cache connections...")

    # 1. Close Redis Client
    try:
        if redis_client:
            await asyncio.wait_for(redis_client.aclose(), timeout=timeout)
            logger.info("Redis connection closed cleanly.")
    except Exception as e:
        logger.warning(f"Error during Redis client shutdown: {e}")

    # 2. Close Motor / Mongo Client
    try:
        if client:
            client.close()
            logger.info("MongoDB client closed cleanly.")
    except Exception as e:
        logger.warning(f"Error during MongoDB client shutdown: {e}")
