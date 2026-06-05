from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from valerie.api.auth import require_api_key
from valerie.db.engine import AsyncSession
from valerie.db.models import EvaluationResult
from sqlmodel import select
import csv
from io import StringIO

router = APIRouter(prefix="/runs", tags=["Results"])

@router.get("/{run_id}/results")
async def get_run_results(run_id: str, limit: int = 100, offset: int = 0, user = Depends(require_api_key)):
    async with AsyncSession() as session:
        statement = select(EvaluationResult).where(EvaluationResult.run_id == run_id).offset(offset).limit(limit)
        results = await session.execute(statement)
        return {"results": results.scalars().all()}

@router.get("/{run_id}/export")
async def export_run_results(run_id: str, format: str = "csv", user = Depends(require_api_key)):
    async with AsyncSession() as session:
        statement = select(EvaluationResult).where(EvaluationResult.run_id == run_id)
        results = await session.execute(statement)
        evals = results.scalars().all()
        
        if format == "json":
            return [e.dict() for e in evals]
            
        output = StringIO()
        writer = csv.writer(output)
        if not evals:
            return Response(content="No results", media_type="text/plain")
            
        headers = evals[0].dict().keys()
        writer.writerow(headers)
        for e in evals:
            writer.writerow(e.dict().values())
            
        return Response(
            content=output.getvalue(),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=run_{run_id}.csv"}
        )
