import time
import uuid
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from valerie.core.events import publisher
from valerie.core.settings import settings
from valerie.db.engine import db, redis_client
from valerie.db.indexes import init_indexes
from valerie.api.routers import (
    validate, domains, attacks, runs, results, endpoints, keys, users, intelligence, lineage, knowledge
)

logging.basicConfig(
    level=getattr(logging, settings.log_level.upper(), logging.INFO),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("api.main")

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan with proper resource management (H-03).
    
    Startup:
    - Initialize database indexes
    - Connect event publisher
    - Start consumer loops
    
    Shutdown:
    - Cancel consumer tasks gracefully
    - Close database connections
    - Close event publisher
    """
    logger.info("Initializing Valerie API service...")
    await init_indexes()
    await publisher.connect()
    
    from valerie.knowledge.consumers import start_knowledge_consumer
    from valerie.intelligence.consumers import start_intelligence_consumer
    from valerie.learning.consumers import start_learning_consumer
    from valerie.db.engine import close_db_connections
    
    app.state.knowledge_consumer_task = start_knowledge_consumer()
    app.state.intelligence_consumer_task = start_intelligence_consumer()
    app.state.learning_consumer_task = start_learning_consumer()
    
    logger.info("All services initialized successfully")
    
    try:
        yield
    finally:
        # Graceful shutdown sequence
        logger.info("Shutting down Valerie API service...")
        
        import asyncio
        
        # 1. Cancel consumer tasks first
        tasks = []
        if hasattr(app.state, "knowledge_consumer_task"):
            tasks.append(app.state.knowledge_consumer_task)
        if hasattr(app.state, "intelligence_consumer_task"):
            tasks.append(app.state.intelligence_consumer_task)
        if hasattr(app.state, "learning_consumer_task"):
            tasks.append(app.state.learning_consumer_task)
            
        for task in tasks:
            task.cancel()
            
        if tasks:
            logger.info(f"Cancelling {len(tasks)} consumer tasks...")
            results = await asyncio.gather(*tasks, return_exceptions=True)
            for i, result in enumerate(results):
                if isinstance(result, Exception):
                    logger.warning(f"Consumer task {i} raised exception during cancellation: {result}")
        
        # 2. Close event publisher
        try:
            await publisher.close()
            logger.info("Event publisher closed")
        except Exception as e:
            logger.error(f"Error closing event publisher: {e}")
        
        # 3. Close database connections (H-03)
        await close_db_connections()
        
        logger.info("Shutdown complete")

app = FastAPI(
    title="Valerie Red Team API",
    version="2.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS Configuration (B-17)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Request ID Correlation & Security Headers Middleware (B-36, B-40)
@app.middleware("http")
async def security_and_tracing_middleware(request: Request, call_next):
    request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
    request.state.request_id = request_id

    start_time = time.monotonic()
    response = await call_next(request)
    duration_ms = (time.monotonic() - start_time) * 1000

    response.headers["X-Request-ID"] = request_id
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Content-Security-Policy"] = "default-src 'self'; frame-ancestors 'none';"
    
    if settings.is_production():
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"

    logger.info(f"[{request_id}] {request.method} {request.url.path} -> {response.status_code} ({duration_ms:.1f}ms)")
    return response

from fastapi import FastAPI, Request, status, HTTPException, APIRouter

# Global Exception Handlers (B-27, X-06)
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    request_id = getattr(request.state, "request_id", "unknown")
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": "HTTPException",
            "detail": exc.detail,
            "status_code": exc.status_code,
            "correlation_id": request_id
        },
        headers=getattr(exc, "headers", None)
    )

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """
    Global exception handler with security hardening (H-06).
    
    - Never expose internal details in production
    - Log full details server-side for debugging
    - Return generic error message to clients
    """
    request_id = getattr(request.state, "request_id", "unknown")
    logger.error(f"[{request_id}] Unhandled exception on {request.method} {request.url.path}: {exc}", exc_info=True)
    
    # H-06: Never expose internal exception details, even in debug mode
    # Only return safe, generic error messages
    detail = "An internal server error occurred. Please contact support with the correlation ID."
    
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": "InternalServerError",
            "detail": detail,
            "correlation_id": request_id,
            "support_reference": f"Request ID: {request_id}"
        }
    )

# API Version 1 Router (X-04)
v1_router = APIRouter(prefix="/v1")
v1_router.include_router(domains.router)
v1_router.include_router(attacks.router)
v1_router.include_router(validate.router)
v1_router.include_router(runs.router)
v1_router.include_router(results.router)
v1_router.include_router(endpoints.router)
v1_router.include_router(keys.router)
v1_router.include_router(users.router)
v1_router.include_router(intelligence.router)
v1_router.include_router(lineage.router)
v1_router.include_router(knowledge.router)

# Mount /v1 router ONLY - remove duplicate root aliases (X-04)
# Duplicate routers cause security policy inconsistency and API documentation confusion
app.include_router(v1_router)


# Comprehensive Health Check (B-39, M-07)
# Checks all critical dependencies including consumer health
@app.get("/health")
async def health_check():
    from valerie.knowledge.consumers import CONSUMER_ERROR_COUNT as KNOWLEDGE_ERRORS
    from valerie.intelligence.consumers import CONSUMER_ERROR_COUNT as INTELLIGENCE_ERRORS
    from valerie.learning.consumers import CONSUMER_ERROR_COUNT as LEARNING_ERRORS
    
    mongo_status = "ok"
    redis_status = "ok"
    consumers_status = "ok"
    
    # MongoDB health
    try:
        await db.command("ping")
    except Exception as e:
        mongo_status = f"unhealthy: {str(e)[:100]}"
        logger.error(f"Health check: MongoDB unhealthy - {e}")

    # Redis health
    try:
        await redis_client.ping()
    except Exception as e:
        redis_status = f"unhealthy: {str(e)[:100]}"
        logger.error(f"Health check: Redis unhealthy - {e}")
    
    # Consumer health check (M-07)
    consumer_issues = []
    if KNOWLEDGE_ERRORS >= 5:
        consumer_issues.append(f"knowledge_consumer_errors={KNOWLEDGE_ERRORS}")
    if INTELLIGENCE_ERRORS >= 5:
        consumer_issues.append(f"intelligence_consumer_errors={INTELLIGENCE_ERRORS}")
    if LEARNING_ERRORS >= 5:
        consumer_issues.append(f"learning_consumer_errors={LEARNING_ERRORS}")
    
    if consumer_issues:
        consumers_status = "degraded: " + ", ".join(consumer_issues)
        logger.warning(f"Health check: Consumer degradation detected - {consumer_issues}")

    # Determine overall health
    is_healthy = (
        mongo_status == "ok" and 
        redis_status == "ok" and 
        consumers_status == "ok"
    )
    status_code = 200 if is_healthy else 503

    return JSONResponse(
        status_code=status_code,
        content={
            "status": "ok" if is_healthy else "degraded",
            "environment": settings.environment,
            "services": {
                "mongodb": mongo_status,
                "redis": redis_status,
                "consumers": consumers_status
            },
            "metrics": {
                "knowledge_consumer_errors": KNOWLEDGE_ERRORS,
                "intelligence_consumer_errors": INTELLIGENCE_ERRORS,
                "learning_consumer_errors": LEARNING_ERRORS
            }
        }
    )

