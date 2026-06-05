from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from valerie.api.auth import require_api_key
from valerie.db.models import PipelineRun
from valerie.db.engine import AsyncSession
from pydantic import BaseModel
import os
import json
import logging
from uuid import uuid4
from sqlmodel import select
from google.cloud import tasks_v2
from google.protobuf import timestamp_pb2
import datetime

router = APIRouter(prefix="/runs", tags=["Runs"])
logger = logging.getLogger("api.runs")

class RunConfigRequest(BaseModel):
    domain: str
    harm_types: list[str]
    techniques: list[str]
    target_model: str
    target_api_key: str | None = None
    target_api_base: str | None = None
    judge_model: str
    judge_api_key: str | None = None
    attacker_model: str
    attacker_api_key: str | None = None
    max_iterations: int = 3
    risk_threshold: float = 0.7
    max_concurrency: int = 10


def _dispatch_task(payload: dict) -> None:
    project_id = os.getenv("GCP_PROJECT_ID")
    location = os.getenv("CLOUD_TASKS_LOCATION", "us-central1")
    queue = os.getenv("CLOUD_TASKS_QUEUE")
    worker_url = os.getenv("WORKER_URL", "http://localhost:8081/internal/run")
    use_cloud_tasks = os.getenv("WORKER_USE_CLOUD_TASKS", "false").lower() == "true"
    run_id = payload.get("run_id", "unknown")

    if not use_cloud_tasks or not project_id or not queue:
        # Fallback to local HTTP
        import httpx
        import asyncio
        async def _local_call():
            try:
                async with httpx.AsyncClient(timeout=600.0) as client:
                    await client.post(worker_url, json=payload)
            except Exception as e:
                logger.error(f"Local fallback dispatch failed: {e}")
        asyncio.run(_local_call())
        return

    logger.info(f"Dispatching run {run_id} to Cloud Tasks queue {queue}")
    try:
        client = tasks_v2.CloudTasksClient()
        parent = client.queue_path(project_id, location, queue)

        task = {
            "http_request": {
                "http_method": tasks_v2.HttpMethod.POST,
                "url": worker_url,
                "headers": {"Content-type": "application/json"},
                "body": json.dumps(payload).encode(),
                "oidc_token": {
                    "service_account_email": f"valerie-cloudrun@{project_id}.iam.gserviceaccount.com"
                }
            }
        }
        response = client.create_task(request={"parent": parent, "task": task})
        logger.info(f"Created task {response.name} for run {run_id}")
    except Exception as e:
        logger.error(f"Failed to create Cloud Task for run {run_id}: {e}")

@router.post("/")
async def create_run(
    config: RunConfigRequest,
    background_tasks: BackgroundTasks,
    user=Depends(require_api_key),
):
    run_id = str(uuid4())
    run_record = PipelineRun(
        id=run_id,
        api_key_hash=user.get("id") if isinstance(user, dict) else user.id,
        status="queued",
        domain=config.domain,
        harm_types=json.dumps(config.harm_types),
        selected_techniques=json.dumps(config.techniques),
        target_model=config.target_model,
        judge_model=config.judge_model,
        attacker_model=config.attacker_model,
        target_api_base=config.target_api_base,
    )

    async with AsyncSession() as session:
        session.add(run_record)
        await session.commit()

    payload = config.dict()
    payload["run_id"] = run_id
    payload["selected_techniques"] = payload.pop("techniques")

    background_tasks.add_task(_dispatch_task, payload)

    return {"run_id": run_id, "status": "queued"}

@router.get("/")
async def list_runs(limit: int = 50, offset: int = 0, user=Depends(require_api_key)):
    async with AsyncSession() as session:
        statement = (
            select(PipelineRun)
            .order_by(PipelineRun.created_at.desc())
            .offset(offset)
            .limit(limit)
        )
        results = await session.execute(statement)
        runs = results.scalars().all()
        return {"runs": runs}

@router.get("/{run_id}")
async def get_run(run_id: str, user=Depends(require_api_key)):
    async with AsyncSession() as session:
        run = await session.get(PipelineRun, run_id)
        if not run:
            raise HTTPException(404, "Run not found")
        return run
