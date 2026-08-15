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
    logger.info("Initializing Valerie API service...")
    await init_indexes()
    await publisher.connect()
    
    from valerie.knowledge.consumers import start_knowledge_consumer
    from valerie.intelligence.consumers import start_intelligence_consumer
    from valerie.learning.consumers import start_learning_consumer
    
    app.state.knowledge_consumer_task = start_knowledge_consumer()
    app.state.intelligence_consumer_task = start_intelligence_consumer()
    app.state.learning_consumer_task = start_learning_consumer()
    
    yield
    
    import asyncio
    
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
        await asyncio.gather(*tasks, return_exceptions=True)
        
    await publisher.close()

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
    request_id = getattr(request.state, "request_id", "unknown")
    logger.error(f"[{request_id}] Unhandled exception on {request.method} {request.url.path}: {exc}", exc_info=True)
    
    detail = "An internal server error occurred."
    if settings.debug or settings.is_development():
        detail = str(exc)

    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": "InternalServerError",
            "detail": detail,
            "message": detail,
            "correlation_id": request_id
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

# Mount /v1 router AND root aliases for backward compatibility (X-04)
app.include_router(v1_router)
app.include_router(domains.router)
app.include_router(attacks.router)
app.include_router(validate.router)
app.include_router(runs.router)
app.include_router(results.router)
app.include_router(endpoints.router)
app.include_router(keys.router)
app.include_router(users.router)
app.include_router(intelligence.router)
app.include_router(lineage.router)
app.include_router(knowledge.router)


# Deep Health Check (B-39)
@app.get("/health")
async def health_check():
    mongo_status = "ok"
    redis_status = "ok"

    try:
        await db.command("ping")
    except Exception as e:
        mongo_status = f"unhealthy: {str(e)[:100]}"

    try:
        await redis_client.ping()
    except Exception as e:
        redis_status = f"unhealthy: {str(e)[:100]}"

    is_healthy = (mongo_status == "ok") and (redis_status == "ok")
    status_code = 200 if is_healthy else 503

    return JSONResponse(
        status_code=status_code,
        content={
            "status": "ok" if is_healthy else "degraded",
            "environment": settings.environment,
            "services": {
                "mongodb": mongo_status,
                "redis": redis_status
            }
        }
    )

