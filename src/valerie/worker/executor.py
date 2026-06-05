from fastapi import FastAPI, Request, BackgroundTasks
from valerie.graph.pipeline import run_pipeline
import logging

app = FastAPI(title="Valerie Worker API")
logger = logging.getLogger("worker")

@app.post("/internal/run")
async def execute_run(request: Request, background_tasks: BackgroundTasks):
    """
    Called by Cloud Tasks (or locally via HTTP) to execute the LangGraph pipeline.
    """
    config = await request.json()
    run_id = config.get("run_id")
    
    if not run_id:
        return {"error": "Missing run_id"}
        
    logger.info(f"Received pipeline run task for run_id: {run_id}")
    
    try:
        results = await run_pipeline(config)
        return {"status": "success", "tasks_processed": len(results)}
    except Exception as e:
        logger.error(f"Pipeline failed for {run_id}: {e}")
        from valerie.db.engine import AsyncSession
        from valerie.db.models import PipelineRun
        
        async with AsyncSession() as session:
            run = await session.get(PipelineRun, run_id)
            if run:
                run.status = "failed"
                run.error_message = str(e)
                await session.commit()
                
        from fastapi import HTTPException
        raise HTTPException(status_code=500, detail=str(e))
