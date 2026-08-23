import hmac
import logging
from fastapi import FastAPI, Request, BackgroundTasks, HTTPException, Header
from valerie.graph.pipeline import run_pipeline
from valerie.core.settings import settings

app = FastAPI(title="Valerie Worker API")
logger = logging.getLogger("worker")

@app.get("/health")
async def health_check():
    return {"status": "ok"}

@app.post("/internal/run")
async def execute_run(
    request: Request,
    background_tasks: BackgroundTasks,
    x_worker_secret: str | None = Header(default=None, alias="X-Worker-Secret"),
    x_api_key: str | None = Header(default=None, alias="X-API-Key"),
):
    """
    Called by Cloud Tasks (or locally via HTTP) to execute the LangGraph pipeline.
    Requires authentication via X-Worker-Secret or X-API-Key header.
    """
    expected_secret = settings.worker_secret
    master_key = settings.master_key

    provided_token = x_worker_secret or x_api_key
    if not provided_token:
        raise HTTPException(status_code=401, detail="Authentication required: X-Worker-Secret header missing.")

    valid_secret = hmac.compare_digest(provided_token.encode("utf-8"), expected_secret.encode("utf-8"))
    valid_master = hmac.compare_digest(provided_token.encode("utf-8"), master_key.encode("utf-8"))

    if not (valid_secret or valid_master):
        raise HTTPException(status_code=401, detail="Invalid worker authentication token.")

    # Validate the task contract before executing (audit M: worker trusted raw JSON).
    from valerie.graph.pipeline import PipelineRunConfig
    body = await request.json()
    try:
        config = PipelineRunConfig(**body)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Invalid task payload: {type(e).__name__}: {str(e)[:200]}")

    run_id = config.run_id
        
    logger.info(f"Received pipeline run task for run_id: {run_id}")
    
    try:
        results = await run_pipeline(config.model_dump())
        return {"status": "success", "tasks_processed": len(results)}
    except Exception as e:
        logger.error(f"Pipeline failed for {run_id}: {e}", exc_info=True)
        from valerie.db.engine import db
        
        # Sanitize error message to prevent leaking internal stack trace or paths
        sanitized_error = f"Pipeline execution failed: {type(e).__name__}"
        if str(e):
            sanitized_error += f" - {str(e)[:200]}"
            
        await db.pipeline_runs.update_one(
            {"id": run_id},
            {"$set": {"status": "failed", "error_message": sanitized_error}}
        )
                
        raise HTTPException(status_code=500, detail=sanitized_error)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("valerie.worker.executor:app", host="127.0.0.1", port=8081)

