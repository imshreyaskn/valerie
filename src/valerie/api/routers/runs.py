import os
import json
import logging
from uuid import uuid4
import datetime
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Header, Response, status
from pydantic import BaseModel, Field
from google.cloud import tasks_v2

from valerie.api.auth import require_api_key
from valerie.db.models import PipelineRun
from valerie.db.engine import db
from valerie.core.settings import settings
from valerie.graph.nodes import DOMAIN_FILES

router = APIRouter(prefix="/runs", tags=["Runs"])
logger = logging.getLogger("api.runs")

class RunConfigRequest(BaseModel):
    domain: str
    harm_types: list[str] = Field(default_factory=list)
    techniques: list[str] = Field(..., min_length=1)
    endpoint_id: str
    judge_model: str
    attacker_model: str
    attacker_api_key: str | None = None
    judge_api_key: str | None = None
    max_iterations: int = Field(default=3, ge=1, le=20)
    risk_threshold: float = Field(default=0.7, ge=0.0, le=1.0)
    max_concurrency: int = Field(default=10, ge=1, le=50)


class WorkerTaskPayload(BaseModel):
    """Explicit contract model between API server and Worker execution engine (X-08)."""
    run_id: str
    user_id: str
    domain: str
    harm_types: list[str]
    selected_techniques: list[str]
    endpoint_id: str
    judge_model: str
    attacker_model: str
    attacker_api_key: str | None = None
    judge_api_key: str | None = None
    max_iterations: int = 3
    risk_threshold: float = 0.7
    max_concurrency: int = 10



async def _dispatch_task(payload: dict, background_tasks: BackgroundTasks) -> None:
    project_id = os.getenv("GCP_PROJECT_ID")
    location = os.getenv("CLOUD_TASKS_LOCATION", "us-central1")
    queue = os.getenv("CLOUD_TASKS_QUEUE")
    worker_url = os.getenv("WORKER_URL", "http://localhost:8081/internal/run")
    use_cloud_tasks = os.getenv("WORKER_USE_CLOUD_TASKS", "false").lower() == "true"
    run_id = payload.get("run_id", "unknown")

    if not use_cloud_tasks or not project_id or not queue:
        logger.info(f"Using BackgroundTasks fallback for run {run_id}")
        from valerie.graph.pipeline import run_pipeline
        
        async def _run_and_handle(config):
            try:
                await db.pipeline_runs.update_one({"id": config.get("run_id")}, {"$set": {"status": "running"}})
                await run_pipeline(config)
            except Exception as e:
                logger.error(f"Pipeline fallback failed: {e}")
                await db.pipeline_runs.update_one({"id": config.get("run_id")}, {"$set": {"status": "failed", "error_message": str(e)}})

        background_tasks.add_task(_run_and_handle, payload)
        return

    logger.info(f"Dispatching run {run_id} to Cloud Tasks queue {queue}")
    try:
        client = tasks_v2.CloudTasksClient()
        parent = client.queue_path(project_id, location, queue)

        task = {
            "http_request": {
                "http_method": tasks_v2.HttpMethod.POST,
                "url": worker_url,
                "headers": {
                    "Content-type": "application/json",
                    "X-Worker-Secret": settings.worker_secret
                },
                "body": json.dumps(payload).encode(),
                "oidc_token": {
                    "service_account_email": f"valerie-cloudrun@{project_id}.iam.gserviceaccount.com"
                }
            }
        }
        import asyncio
        loop = asyncio.get_running_loop()
        response = await loop.run_in_executor(None, lambda: client.create_task(request={"parent": parent, "task": task}))
        logger.info(f"Created task {response.name} for run {run_id}")
    except Exception as e:
        logger.error(f"Failed to create Cloud Task for run {run_id}: {e}")

from valerie.attacks.techniques import TECHNIQUES

@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_run(
    config: RunConfigRequest,
    background_tasks: BackgroundTasks,
    response: Response,
    user=Depends(require_api_key),
):
    # Validate Domain (B-10)
    if config.domain not in DOMAIN_FILES:
        raise HTTPException(status_code=400, detail=f"Invalid domain '{config.domain}'. Must be one of: {list(DOMAIN_FILES.keys())}")

    # Validate Techniques against registry (B-10)
    invalid_techs = [t for t in config.techniques if t not in TECHNIQUES]
    if invalid_techs:
        raise HTTPException(status_code=400, detail=f"Invalid technique(s): {invalid_techs}. Must be valid IDs in attack registry.")

    # Validate Endpoint existence & ownership (B-09)
    endpoint = await db.endpoints.find_one({"id": config.endpoint_id})
    if not endpoint:
        raise HTTPException(status_code=404, detail=f"Endpoint '{config.endpoint_id}' not found.")
    if user["id"] != "admin_master" and endpoint.get("user_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Forbidden: You do not own this endpoint.")


    run_id = str(uuid4())
    run_record = PipelineRun(
        id=run_id,
        user_id=user["id"],
        endpoint_id=config.endpoint_id,
        status="queued",
        domain=config.domain,
        harm_types=config.harm_types,
        selected_techniques=config.techniques,
        target_model=endpoint.get("name", "deferred_to_worker"),
        judge_model=config.judge_model,
        attacker_model=config.attacker_model,
    )

    await db.pipeline_runs.insert_one(run_record.model_dump())

    payload_obj = WorkerTaskPayload(
        run_id=run_id,
        user_id=user["id"],
        domain=config.domain,
        harm_types=config.harm_types,
        selected_techniques=config.techniques,
        endpoint_id=config.endpoint_id,
        judge_model=config.judge_model,
        attacker_model=config.attacker_model,
        attacker_api_key=config.attacker_api_key,
        judge_api_key=config.judge_api_key,
        max_iterations=config.max_iterations,
        risk_threshold=config.risk_threshold,
        max_concurrency=config.max_concurrency,
    )

    await _dispatch_task(payload_obj.model_dump(), background_tasks)

    response.headers["Location"] = f"/runs/{run_id}"
    return {"run_id": run_id, "status": "queued"}


@router.get("/")
async def list_runs(limit: int = 50, offset: int = 0, user=Depends(require_api_key)):
    query = {} if user["id"] == "admin_master" else {"user_id": user["id"]}
    total = await db.pipeline_runs.count_documents(query)
    
    runs_cursor = db.pipeline_runs.find(query).sort("created_at", -1).skip(offset).limit(limit)
    runs = await runs_cursor.to_list(length=limit)
    for run in runs:
        run.pop("_id", None)
        
    has_more = (offset + len(runs)) < total
    return {
        "runs": runs,
        "pagination": {
            "total": total,
            "limit": limit,
            "offset": offset,
            "has_more": has_more
        }
    }

@router.get("/{run_id}")
async def get_run(run_id: str, user=Depends(require_api_key)):
    query = {"id": run_id} if user["id"] == "admin_master" else {"id": run_id, "user_id": user["id"]}
    run = await db.pipeline_runs.find_one(query)
    if not run:
        raise HTTPException(404, "Run not found")
    run.pop("_id", None)
    return run

from fastapi.responses import StreamingResponse
from valerie.core.events import EventSubscriber
import asyncio

_active_sse_connections: int = 0
MAX_SSE_CONNECTIONS: int = 100

@router.get("/stream/{run_id}")
async def stream_run_events(
    run_id: str, 
    user: dict = Depends(require_api_key),
    last_event_id: str = Header(default="0", alias="Last-Event-ID")
):
    """
    Server-Sent Events (SSE) stream for real-time run monitoring.
    Only yields events for the specified run_id.
    Includes active connection guards and periodic comment heartbeats (X-05).
    """
    global _active_sse_connections
    if _active_sse_connections >= MAX_SSE_CONNECTIONS:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Too many active event streams (limit {MAX_SSE_CONNECTIONS}). Please retry later."
        )

    _active_sse_connections += 1

    async def event_generator():
        global _active_sse_connections
        subscriber = EventSubscriber()
        try:
            if run_id == "all":
                last_event_id_val = "$"
            else:
                last_event_id_val = last_event_id
                
            async for msg_id, event in subscriber.subscribe(last_id=last_event_id_val):
                if event is None:
                    # SSE comment heartbeat to detect dead TCP sockets (X-05)
                    yield ": heartbeat\n\n"
                    continue
                    
                if run_id == "all" or event.correlation_id == run_id:
                    data = event.model_dump_json()
                    yield f"id: {msg_id}\ndata: {data}\n\n"
                    
                    if run_id != "all" and event.type in ("run.completed", "run.failed"):
                        break
        except asyncio.CancelledError:
            logger.info(f"Client disconnected from run stream {run_id}")
        finally:
            _active_sse_connections = max(0, _active_sse_connections - 1)
            await subscriber.close()

    return StreamingResponse(event_generator(), media_type="text/event-stream")


