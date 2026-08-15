from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from valerie.api.auth import require_api_key
from valerie.db.engine import db
import csv
from io import StringIO

router = APIRouter(prefix="/runs", tags=["Results"])

async def _aggregate_results(run_id: str, limit: int = 100, offset: int = 0):
    # Prefer evaluation_results since they contain target_response (D-06/Phase 3)
    eval_cursor = db.evaluation_results.find({"run_id": run_id}).skip(offset).limit(limit)
    eval_docs = await eval_cursor.to_list(length=limit)
    if eval_docs:
        for r in eval_docs:
            r.pop("_id", None)
            if "severity" not in r:
                score = r.get("overall_risk_score", 0.0)
                if score >= 0.9: r["severity"] = "critical"
                elif score >= 0.7: r["severity"] = "high"
                elif score >= 0.4: r["severity"] = "medium"
                else: r["severity"] = "low"
        return eval_docs

    # Fallback to findings if no evaluation_results exist
    cursor = db.findings.find({"run_id": run_id}).skip(offset).limit(limit)
    findings = await cursor.to_list(length=limit)
    
    if not findings:
        return []
        
    prompt_ids = list({f["prompt_id"] for f in findings if "prompt_id" in f})
    if prompt_ids:
        prompts_cursor = db.prompts.find({"id": {"$in": prompt_ids}})
        prompts = await prompts_cursor.to_list(length=len(prompt_ids))
        prompt_map = {p["id"]: p for p in prompts}
    else:
        prompt_map = {}
    
    results = []
    for f in findings:
        p = prompt_map.get(f.get("prompt_id"), {})
        r = {
            "id": f.get("id", ""),
            "task_id": f.get("task_id", ""),
            "adversarial_prompt": p.get("text", f.get("adversarial_prompt", "")),
            "target_response": f.get("target_response", ""),
            "is_breakthrough": f.get("is_breakthrough", False),
            "overall_risk_score": f.get("verdict", {}).get("overall_risk_score", 0.0),
            "severity": f.get("severity", "low"),
            "technique_id": f.get("technique_id", "unknown")
        }
        
        for ev in f.get("evidence", []):
            if isinstance(ev, dict):
                if ev.get("type") == "pii_leakage":
                    r["pii_leakage"] = True
                if ev.get("type") == "bias":
                    r["bias"] = ev.get("description", "none")
                if ev.get("type") == "toxicity":
                    r["toxicity"] = True
                    r["toxicity_severity"] = ev.get("description", "low")
                
        results.append(r)
    return results

@router.get("/{run_id}/results")
async def get_run_results(run_id: str, limit: int = 100, offset: int = 0, user = Depends(require_api_key)):
    query = {"id": run_id} if user["id"] == "admin_master" else {"id": run_id, "user_id": user["id"]}
    run = await db.pipeline_runs.find_one(query)
    if not run:
        raise HTTPException(404, "Run not found")
        
    results = await _aggregate_results(run_id, limit, offset)
    return {
        "run_id": run_id,
        "run_status": run.get("status", "unknown"),
        "results": results,
        "total_results": len(results)
    }

@router.get("/{run_id}/export")
async def export_run_results(run_id: str, format: str = "csv", page: int = 1, page_size: int = 1000, user = Depends(require_api_key)):
    """
    Export run results with pagination to prevent memory exhaustion (M-02).
    
    Args:
        run_id: The pipeline run ID
        format: Output format (csv or json)
        page: Page number (1-indexed), default 1
        page_size: Results per page, max 1000, default 1000
    """
    # Enforce reasonable limits (M-02)
    page_size = min(max(page_size, 1), 1000)
    page = max(page, 1)
    offset = (page - 1) * page_size
    
    query = {"id": run_id} if user["id"] == "admin_master" else {"id": run_id, "user_id": user["id"]}
    run = await db.pipeline_runs.find_one(query)
    if not run:
        raise HTTPException(404, "Run not found")
    
    # Get total count for pagination metadata
    total_count = await db.evaluation_results.count_documents({"run_id": run_id})
        
    results = await _aggregate_results(run_id, limit=page_size, offset=offset)
    
    if format == "json":
        return {
            "run_id": run_id,
            "page": page,
            "page_size": page_size,
            "total_count": total_count,
            "total_pages": (total_count + page_size - 1) // page_size,
            "results": results
        }
        
    output = StringIO()
    writer = csv.writer(output)
    if not results:
        return Response(content="No results", media_type="text/plain")
        
    headers = list({k for r in results for k in r.keys()})
    writer.writerow(headers)
    for r in results:
        writer.writerow([r.get(h, "") for h in headers])
        
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename=run_{run_id}_page{page}.csv",
            "X-Total-Count": str(total_count),
            "X-Page": str(page),
            "X-Page-Size": str(page_size),
            "X-Total-Pages": str((total_count + page_size - 1) // page_size)
        }
    )

