from fastapi import APIRouter, Depends, HTTPException
from valerie.db.engine import db
from valerie.api.auth import require_api_key

router = APIRouter(prefix="/lineage", tags=["Lineage"])


async def _verify_run_ownership(run_id: str, user: dict) -> None:
    """Non-admin users may only read lineage of their own runs (audit C3)."""
    if user["id"] == "admin_master":
        return
    run = await db.pipeline_runs.find_one({"id": run_id}, {"_id": 0, "user_id": 1})
    if not run:
        raise HTTPException(404, "Run not found")
    if run.get("user_id") != user["id"]:
        raise HTTPException(403, "Forbidden: You do not own this run.")


@router.get("/runs/{run_id}/tasks/{task_id}")
async def get_task_lineage(run_id: str, task_id: str, user=Depends(require_api_key)):
    """
    Retrieves the chronological lineage of prompt mutations for a specific task.
    Includes the semantic distance (cosine difference) between consecutive mutations.
    """
    await _verify_run_ownership(run_id, user)

    query = {"task_id": task_id}
    if run_id != "all":
        query["run_id"] = run_id
    elif user["id"] != "admin_master":
        # "all" + concrete task: resolve the owning run from the prompts themselves.
        probe = await db.prompts.find_one({"task_id": task_id}, {"run_id": 1})
        if not probe:
            raise HTTPException(404, "Task not found")
        await _verify_run_ownership(probe["run_id"], user)
        query["run_id"] = probe["run_id"]

    cursor = db.prompts.find(query).sort("iteration", 1)
    prompts = await cursor.to_list(length=100)

    # Batch risk-score lookup instead of N+1 queries.
    prompt_ids = [p["id"] for p in prompts if "id" in p]
    findings_by_prompt: dict[str, dict] = {}
    if prompt_ids:
        f_cursor = db.findings.find({"prompt_id": {"$in": prompt_ids}}, {"prompt_id": 1, "verdict.overall_risk_score": 1})
        async for f in f_cursor:
            findings_by_prompt[f.get("prompt_id")] = f

    response_chain = []

    for i, p in enumerate(prompts):
        finding = findings_by_prompt.get(p.get("id"))
        risk_score = float(finding.get("verdict", {}).get("overall_risk_score", 0.0)) if finding else 0.0

        semantic_distance = 0.0
        if i > 0:
            prev_emb = prompts[i-1].get("embedding")
            curr_emb = p.get("embedding")
            if prev_emb and curr_emb:
                semantic_distance = _cosine_distance(prev_emb, curr_emb)

        response_chain.append({
            "id": p["id"],
            "iteration": p.get("iteration", i),
            "text": p.get("text", ""),
            "technique": p.get("technique_id", "unknown"),
            "risk_score": risk_score,
            "semantic_distance_from_parent": semantic_distance,
            "parent_prompt_id": p.get("parent_prompt_id", None)
        })

    return {"lineage": response_chain}


def _cosine_distance(vec1: list[float], vec2: list[float]) -> float:
    import numpy as np
    v1 = np.array(vec1)
    v2 = np.array(vec2)
    norm1 = np.linalg.norm(v1)
    norm2 = np.linalg.norm(v2)
    if norm1 == 0 or norm2 == 0:
        return 0.0
    return float(1.0 - (np.dot(v1, v2) / (norm1 * norm2)))


@router.get("/{prompt_id}")
async def get_prompt_lineage(prompt_id: str, user=Depends(require_api_key)):
    """
    Returns the full mutation chain for a single prompt (frontend contract).
    Ownership enforced via the prompt's parent run.
    """
    prompt = await db.prompts.find_one({"id": prompt_id})
    if not prompt:
        raise HTTPException(404, "Prompt not found")

    run_id = prompt.get("run_id")
    if run_id and user["id"] != "admin_master":
        await _verify_run_ownership(run_id, user)

    chain = []
    current = prompt
    visited = set()
    while current and current.get("id") not in visited:
        visited.add(current.get("id"))
        finding = await db.findings.find_one(
            {"prompt_id": current["id"]}, {"verdict.overall_risk_score": 1}
        )
        chain.append({
            "id": current["id"],
            "iteration": current.get("iteration", 0),
            "text": current.get("text", ""),
            "technique": current.get("technique_id", "unknown"),
            "risk_score": float(finding.get("verdict", {}).get("overall_risk_score", 0.0)) if finding else 0.0,
            "semantic_distance_from_parent": 0.0,
            "parent_prompt_id": current.get("parent_prompt_id"),
        })
        if not current.get("parent_prompt_id"):
            break
        current = await db.prompts.find_one({"id": current["parent_prompt_id"]})

    return {"lineage": list(reversed(chain))}
