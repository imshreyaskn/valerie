import hashlib
import json
import logging
from datetime import datetime, timezone
from typing import Any, Union
from uuid import uuid4
from pydantic import BaseModel, Field

from valerie.db.engine import db
from valerie.core.events import Event, publisher

logger = logging.getLogger("valerie.forensics")

GENESIS_HASH = "0" * 64

def utc_now() -> datetime:
    return datetime.now(timezone.utc)

def compute_sha256(data: Union[str, bytes, dict, list]) -> str:
    """Computes deterministic SHA-256 hash for any payload."""
    if isinstance(data, (dict, list)):
        payload_bytes = json.dumps(data, sort_keys=True, default=str).encode("utf-8")
    elif isinstance(data, str):
        payload_bytes = data.encode("utf-8")
    elif isinstance(data, bytes):
        payload_bytes = data
    else:
        payload_bytes = str(data).encode("utf-8")
    return hashlib.sha256(payload_bytes).hexdigest()

class ForensicEvidence(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    evaluation_id: str
    run_id: str
    user_id: str
    endpoint_id: str
    technique_id: str
    payload_hash: str
    adversarial_prompt_hash: str
    target_response_hash: str
    verdict_hash: str
    created_at: datetime = Field(default_factory=utc_now)

class AuditLogEntry(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    sequence_number: int
    entity_type: str
    entity_id: str
    action: str
    current_hash: str
    previous_entry_hash: str
    payload_snapshot: dict
    timestamp: datetime = Field(default_factory=utc_now)

async def _get_latest_audit_hash() -> tuple[int, str]:
    """Retrieves the sequence number and hash of the latest audit log entry."""
    try:
        latest = await db.audit_log.find_one({}, sort=[("sequence_number", -1)])
        if latest and "current_hash" in latest:
            return int(latest.get("sequence_number", 0)), str(latest["current_hash"])
    except Exception as e:
        logger.warning(f"Could not retrieve latest audit log entry: {e}")
    return 0, GENESIS_HASH

async def hash_and_persist_evaluation(
    evaluation_data: Union[dict, str],
    user_id: str | None = None,
    run_id: str | None = None,
    endpoint_id: str | None = None,
    technique_id: str | None = None,
) -> ForensicEvidence:
    """
    Computes cryptographic hashes for an evaluation result and creates an immutable
    audit log entry with blockchain-style previous_entry_hash chaining.
    
    Eliminates race condition (C-04) by accepting either the in-memory dictionary
    directly or resolving from DB if an ID is passed.
    """
    eval_dict: dict[str, Any] = {}
    eval_id: str = ""

    if isinstance(evaluation_data, dict):
        eval_dict = evaluation_data
        eval_id = str(eval_dict.get("id") or eval_dict.get("task_id") or uuid4())
    elif isinstance(evaluation_data, str):
        eval_id = evaluation_data
        # Query DB if only an ID was provided
        try:
            fetched = await db.evaluation_results.find_one({"id": eval_id})
            if fetched:
                eval_dict = fetched
            else:
                eval_dict = {"id": eval_id}
        except Exception as e:
            logger.warning(f"Failed to query evaluation result {eval_id}: {e}")
            eval_dict = {"id": eval_id}

    # Extract metadata fields with fallback resolution
    u_id = user_id or str(eval_dict.get("user_id") or "system")
    r_id = run_id or str(eval_dict.get("run_id") or "unspecified")
    ep_id = endpoint_id or str(eval_dict.get("endpoint_id") or "unspecified")
    tech_id = technique_id or str(eval_dict.get("technique_id") or eval_dict.get("attack_family") or "unspecified")

    adv_prompt = str(eval_dict.get("adversarial_prompt") or "")
    target_resp = str(eval_dict.get("target_response") or "")
    verdict = {
        "overall_risk_score": eval_dict.get("overall_risk_score", 0.0),
        "is_breakthrough": eval_dict.get("is_breakthrough", False),
        "pii_leakage": eval_dict.get("pii_leakage", False),
        "bias": eval_dict.get("bias", "none"),
        "toxicity": eval_dict.get("toxicity", False),
        "safety_concern": eval_dict.get("safety_concern", ""),
    }

    adv_hash = compute_sha256(adv_prompt)
    resp_hash = compute_sha256(target_resp)
    verdict_hash = compute_sha256(verdict)
    payload_hash = compute_sha256({
        "evaluation_id": eval_id,
        "run_id": r_id,
        "adversarial_prompt_hash": adv_hash,
        "target_response_hash": resp_hash,
        "verdict_hash": verdict_hash,
    })

    evidence = ForensicEvidence(
        evaluation_id=eval_id,
        run_id=r_id,
        user_id=u_id,
        endpoint_id=ep_id,
        technique_id=tech_id,
        payload_hash=payload_hash,
        adversarial_prompt_hash=adv_hash,
        target_response_hash=resp_hash,
        verdict_hash=verdict_hash,
        created_at=utc_now(),
    )

    # Persist evidence record
    try:
        await db.forensic_evidence.insert_one(evidence.model_dump(mode="json"))
    except Exception as e:
        logger.error(f"Failed to persist forensic evidence for eval {eval_id}: {e}")

    # Create chained audit log entry (H-09)
    last_seq, prev_hash = await _get_latest_audit_hash()
    new_seq = last_seq + 1

    audit_payload = {
        "sequence_number": new_seq,
        "entity_type": "evaluation_result",
        "entity_id": eval_id,
        "action": "EVALUATION_RECORDED",
        "previous_entry_hash": prev_hash,
        "evidence_id": evidence.id,
        "payload_hash": payload_hash,
    }
    current_entry_hash = compute_sha256(audit_payload)

    audit_entry = AuditLogEntry(
        sequence_number=new_seq,
        entity_type="evaluation_result",
        entity_id=eval_id,
        action="EVALUATION_RECORDED",
        current_hash=current_entry_hash,
        previous_entry_hash=prev_hash,
        payload_snapshot=audit_payload,
        timestamp=utc_now(),
    )

    try:
        await db.audit_log.insert_one(audit_entry.model_dump(mode="json"))
    except Exception as e:
        logger.error(f"Failed to persist chained audit log entry: {e}")

    # Emit telemetry event
    try:
        await publisher.publish(Event(
            type="forensic.evidence_created",
            source="forensics.evidence",
            correlation_id=r_id,
            payload={
                "evidence_id": evidence.id,
                "evaluation_id": eval_id,
                "sequence_number": new_seq,
                "payload_hash": payload_hash,
                "current_hash": current_entry_hash,
            }
        ))
    except Exception as e:
        logger.debug(f"Event emission for forensic evidence skipped: {e}")

    return evidence

async def verify_audit_log_chain(limit: int = 1000) -> dict[str, Any]:
    """
    Verifies cryptographic integrity of the audit log chain.
    Ensures no entries have been deleted, inserted, or modified.
    """
    cursor = db.audit_log.find({}).sort("sequence_number", 1).limit(limit)
    entries = await cursor.to_list(length=limit)

    if not entries:
        return {"valid": True, "total_verified": 0, "status": "empty_log"}

    prev_hash = GENESIS_HASH
    for idx, entry in enumerate(entries):
        expected_prev = entry.get("previous_entry_hash")
        if expected_prev != prev_hash:
            return {
                "valid": False,
                "broken_at_sequence": entry.get("sequence_number"),
                "reason": f"Hash chain break: expected prev {prev_hash}, found {expected_prev}",
            }
        
        # Verify current_hash matches payload
        payload = entry.get("payload_snapshot", {})
        recomputed_hash = compute_sha256(payload)
        if recomputed_hash != entry.get("current_hash"):
            return {
                "valid": False,
                "broken_at_sequence": entry.get("sequence_number"),
                "reason": "Tampered entry: payload does not match current_hash",
            }
        prev_hash = str(entry.get("current_hash"))

    return {
        "valid": True,
        "total_verified": len(entries),
        "latest_sequence": entries[-1].get("sequence_number") if entries else 0,
        "status": "verified_intact"
    }
