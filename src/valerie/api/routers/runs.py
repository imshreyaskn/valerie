from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from valerie.api.auth import require_api_key
from valerie.db.models import PipelineRun
from valerie.db.engine import AsyncSession
from pydantic import BaseModel
import os
import json
import httpx
import logging
from uuid import uuid4
from sqlmodel import select

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


async def _dispatch_to_worker(payload: dict) -> None:
    """Fire-and-forget: call the worker. Runs as a FastAPI BackgroundTask."""
    worker_url = os.getenv("WORKER_URL", "http://localhost:8081/internal/run")
    run_id = payload.get("run_id", "unknown")
    logger.info(f"Dispatching run {run_id} to worker at {worker_url}")
    try:
        # Use a long timeout — worker will run LLM calls for several minutes
        async with httpx.AsyncClient(timeout=600.0) as client:
            resp = await client.post(worker_url, json=payload)
            logger.info(f"Worker responded {resp.status_code} for run {run_id}")
    except Exception as e:
        logger.error(f"Failed to dispatch run {run_id} to worker: {e}")
        # Mark as failed in DB
        try:
            async with AsyncSession() as session:
                run = await session.get(PipelineRun, run_id)
                if run:
                    run.status = "failed"
                    run.error_message = str(e)
                    await session.commit()
        except Exception as db_err:
            logger.error(f"Also failed to update DB status: {db_err}")


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

    # BackgroundTasks runs AFTER the response is sent but BEFORE Cloud Run shuts down
    background_tasks.add_task(_dispatch_to_worker, payload)

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
