import asyncio
import hashlib
import hmac as hmac_mod
import json
import logging
from datetime import datetime, timezone
from typing import Any, Union
from uuid import uuid4

from pydantic import BaseModel, Field
from pymongo.errors import DuplicateKeyError

from valerie.core.settings import settings

logger = logging.getLogger("valerie.forensics")

GENESIS_HASH = "0" * 64
CHAIN_APPEND_MAX_RETRIES = 5
EVIDENCE_INSERT_MAX_RETRIES = 3


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


def _signing_key() -> bytes:
    """HMAC key derived from the master key; never stored alongside the log."""
    return hashlib.sha256(f"{settings.master_key}:audit-chain".encode("utf-8")).digest()


def compute_entry_signature(canonical_payload: dict) -> str:
    """
    HMAC-SHA256 signature over the canonical audit payload.

    Plain SHA-256 chaining alone is re-computable by anyone with DB write
    access (they can rebuild the whole chain). The HMAC binds entries to a
    server-side secret so tampering is detectable without the key.
    """
    canonical = json.dumps(canonical_payload, sort_keys=True, default=str)
    return hmac_mod.new(_signing_key(), canonical.encode("utf-8"), hashlib.sha256).hexdigest()


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
    hmac_signature: str | None = None  # Absent on legacy (pre-signing) entries.
    payload_snapshot: dict
    timestamp: datetime = Field(default_factory=utc_now)


async def _get_latest_audit_hash() -> tuple[int, str]:
    """Retrieves the sequence number and hash of the latest audit log entry."""
    try:
        from valerie.db.engine import db
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
    Computes cryptographic hashes for an evaluation result and appends a signed,
    hash-chained audit log entry.

    Concurrency (audit H5): the unique index on `sequence_number` arbitrates the
    read-then-append race. On collision we re-read the chain head and retry,
    guaranteeing a single linear chain under parallel writers.
    """
    from valerie.db.engine import db

    eval_dict: dict[str, Any] = {}
    eval_id: str = ""

    if isinstance(evaluation_data, dict):
        eval_dict = evaluation_data
        eval_id = str(eval_dict.get("id") or eval_dict.get("task_id") or uuid4())
    elif isinstance(evaluation_data, str):
        eval_id = evaluation_data
        try:
            fetched = await db.evaluation_results.find_one({"id": eval_id})
            eval_dict = fetched if fetched else {"id": eval_id}
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

    # Persist evidence record with retries; losing evidence silently is not
    # acceptable for a forensic product — fail loudly after retries.
    last_error: Exception | None = None
    for attempt in range(EVIDENCE_INSERT_MAX_RETRIES):
        try:
            await db.forensic_evidence.insert_one(evidence.model_dump(mode="json"))
            last_error = None
            break
        except Exception as e:
            last_error = e
            logger.error(f"Evidence persist attempt {attempt + 1} failed for eval {eval_id}: {e}")
            await asyncio.sleep(0.2 * (attempt + 1))
    if last_error is not None:
        raise RuntimeError(f"Failed to persist forensic evidence for eval {eval_id}") from last_error

    # Append chained audit entry with duplicate-sequence retry.
    new_seq = 0
    current_entry_hash = ""
    for attempt in range(CHAIN_APPEND_MAX_RETRIES):
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
        current_entry_hash = compute_entry_signature(audit_payload)

        audit_entry = AuditLogEntry(
            sequence_number=new_seq,
            entity_type="evaluation_result",
            entity_id=eval_id,
            action="EVALUATION_RECORDED",
            current_hash=current_entry_hash,
            previous_entry_hash=prev_hash,
            hmac_signature=current_entry_hash,
            payload_snapshot=audit_payload,
            timestamp=utc_now(),
        )

        try:
            await db.audit_log.insert_one(audit_entry.model_dump(mode="json"))
            break
        except DuplicateKeyError:
            # Another writer won the sequence slot; retry with fresh head.
            logger.warning(f"Audit sequence {new_seq} contention, retrying ({attempt + 1})")
            continue
        except Exception as e:
            raise RuntimeError(f"Failed to append audit log entry for eval {eval_id}") from e

    # Emit telemetry event
    try:
        from valerie.core.events import Event, publisher
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
    Verifies integrity of the audit log chain: linkage, payload hashes and
    HMAC signatures. Legacy unsigned entries are reported separately instead
    of failing the whole chain.
    """
    from valerie.db.engine import db
    cursor = db.audit_log.find({}).sort("sequence_number", 1).limit(limit)
    entries = await cursor.to_list(length=limit)

    if not entries:
        return {"valid": True, "total_verified": 0, "unsigned_legacy_entries": 0, "status": "empty_log"}

    prev_hash = GENESIS_HASH
    unsigned_legacy = 0
    for entry in entries:
        expected_prev = entry.get("previous_entry_hash")
        if expected_prev != prev_hash:
            return {
                "valid": False,
                "broken_at_sequence": entry.get("sequence_number"),
                "reason": f"Hash chain break: expected prev {prev_hash}, found {expected_prev}",
                "unsigned_legacy_entries": unsigned_legacy,
            }

        payload = entry.get("payload_snapshot", {})
        signature = entry.get("hmac_signature")

        if signature:
            recomputed = compute_entry_signature(payload)
            if not hmac_mod.compare_digest(recomputed, str(signature)):
                return {
                    "valid": False,
                    "broken_at_sequence": entry.get("sequence_number"),
                    "reason": "Tampered entry: HMAC signature mismatch",
                    "unsigned_legacy_entries": unsigned_legacy,
                }
        else:
            unsigned_legacy += 1

        # Legacy integrity check still applies to unsigned entries.
        if not signature:
            legacy_hash = compute_sha256(payload)
            if legacy_hash != entry.get("current_hash"):
                return {
                    "valid": False,
                    "broken_at_sequence": entry.get("sequence_number"),
                    "reason": "Tampered legacy entry: payload does not match current_hash",
                    "unsigned_legacy_entries": unsigned_legacy,
                }

        prev_hash = str(entry.get("current_hash"))

    return {
        "valid": True,
        "total_verified": len(entries),
        "latest_sequence": entries[-1].get("sequence_number", 0),
        "unsigned_legacy_entries": unsigned_legacy,
        "status": "verified_intact",
    }
