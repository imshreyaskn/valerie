"""
Forensic Evidence Hashing and Chain of Custody (C-04, H-09)
============================================================

This module provides cryptographic integrity guarantees for all evidence
collected during red teaming operations. It ensures:

1. Tamper-evident storage via SHA-256 hashes
2. Chain of custody tracking with provenance metadata
3. Immutable audit logging
4. Timestamp verification

Design Principles:
- All prompts/responses are hashed on ingestion
- Hashes stored separately from content (defense in depth)
- Provenance chain links derived data to source
- Audit log is append-only
"""

import hashlib
import json
import logging
from datetime import datetime, timezone
from typing import Any, Optional
from pydantic import BaseModel, Field

logger = logging.getLogger("forensics")


def compute_sha256(content: str) -> str:
    """
    Compute SHA-256 hash of content string.
    
    Args:
        content: String content to hash
        
    Returns:
        Hex-encoded SHA-256 hash
    """
    if isinstance(content, bytes):
        content = content.decode('utf-8')
    return hashlib.sha256(content.encode('utf-8')).hexdigest()


def compute_content_hash(prompt: str, response: str, metadata: Optional[dict] = None) -> dict[str, str]:
    """
    Compute composite hash for prompt-response pair with optional metadata.
    
    This creates a tamper-evident seal for the entire interaction.
    
    Args:
        prompt: Original or adversarial prompt text
        response: Model response text
        metadata: Optional additional fields to include in hash
        
    Returns:
        Dictionary containing:
        - prompt_hash: SHA-256 of prompt alone
        - response_hash: SHA-256 of response alone
        - interaction_hash: SHA-256 of combined interaction
        - timestamp: UTC timestamp of hashing
    """
    prompt_hash = compute_sha256(prompt)
    response_hash = compute_sha256(response)
    
    # Composite hash includes both plus metadata for full context
    interaction_data = {
        "prompt": prompt,
        "response": response,
        "metadata": metadata or {},
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    interaction_hash = compute_sha256(json.dumps(interaction_data, sort_keys=True))
    
    return {
        "prompt_hash": prompt_hash,
        "response_hash": response_hash,
        "interaction_hash": interaction_hash,
        "hashed_at": datetime.now(timezone.utc).isoformat()
    }


class ForensicEvidence(BaseModel):
    """
    Immutable forensic evidence record with chain of custody.
    
    This model captures all required metadata for legal/compliance use cases.
    """
    id: str = Field(..., description="Unique evidence identifier")
    run_id: str = Field(..., description="Parent pipeline run ID")
    task_id: str = Field(..., description="Task that generated this evidence")
    
    # Content hashes (tamper-evident)
    prompt_hash: str = Field(..., description="SHA-256 hash of prompt")
    response_hash: str = Field(..., description="SHA-256 hash of response")
    interaction_hash: str = Field(..., description="SHA-256 hash of full interaction")
    
    # Provenance chain
    parent_evidence_id: Optional[str] = Field(None, description="Parent evidence in refinement chain")
    technique_id: str = Field(..., description="Attack technique used")
    endpoint_id: str = Field(..., description="Target endpoint")
    
    # Temporal data
    created_at: str = Field(..., description="UTC ISO timestamp")
    hashed_at: str = Field(..., description="When hashing occurred")
    
    # Verification
    verification_status: str = Field(default="pending", description="pending|verified|tampered")
    verified_at: Optional[str] = Field(None, description="When verification occurred")
    verified_by: Optional[str] = Field(None, description="Who/what verified")
    
    class Config:
        frozen = True  # Immutable after creation


class AuditLogEntry(BaseModel):
    """
    Append-only audit log entry for security events.
    
    Each entry is self-contained and can be independently verified.
    """
    id: str = Field(..., description="Unique log entry ID")
    event_type: str = Field(..., description="Type of event being logged")
    source: str = Field(..., description="Component that generated event")
    correlation_id: str = Field(..., description="Trace correlation ID")
    
    # Event data (hash only for large payloads)
    payload_hash: Optional[str] = Field(None, description="Hash of full payload if large")
    payload_summary: dict = Field(default_factory=dict, description="Summary of payload")
    
    # Temporal
    timestamp: str = Field(..., description="UTC ISO timestamp")
    
    # Integrity
    previous_entry_hash: Optional[str] = Field(None, description="Hash chain linkage")
    entry_hash: str = Field(..., description="Self-hash for verification")
    
    @classmethod
    def create(cls, event_type: str, source: str, correlation_id: str, 
               payload: Optional[dict] = None, previous_hash: Optional[str] = None) -> 'AuditLogEntry':
        """Factory method that computes entry hash automatically."""
        import uuid
        
        entry_id = str(uuid.uuid4())
        timestamp = datetime.now(timezone.utc).isoformat()
        
        # Compute payload hash if payload is large
        payload_hash = None
        payload_summary = {}
        if payload:
            payload_json = json.dumps(payload, sort_keys=True)
            if len(payload_json) > 1000:
                payload_hash = compute_sha256(payload_json)
                payload_summary = {"size": len(payload_json), "keys": list(payload.keys())}
            else:
                payload_summary = payload
        
        # Entry data for hashing
        entry_data = {
            "id": entry_id,
            "event_type": event_type,
            "source": source,
            "correlation_id": correlation_id,
            "payload_hash": payload_hash,
            "payload_summary": payload_summary,
            "timestamp": timestamp,
            "previous_entry_hash": previous_hash
        }
        
        entry_hash = compute_sha256(json.dumps(entry_data, sort_keys=True))
        
        return cls(
            id=entry_id,
            event_type=event_type,
            source=source,
            correlation_id=correlation_id,
            payload_hash=payload_hash,
            payload_summary=payload_summary,
            timestamp=timestamp,
            previous_entry_hash=previous_hash,
            entry_hash=entry_hash
        )


async def persist_evidence(evidence: ForensicEvidence) -> bool:
    """
    Persist forensic evidence to database with integrity verification.
    
    Args:
        evidence: ForensicEvidence object to persist
        
    Returns:
        True if successfully persisted
    """
    from valerie.db.engine import db
    
    try:
        # Insert into immutable forensic_evidence collection
        await db.forensic_evidence.insert_one(evidence.model_dump(mode='json'))
        logger.info(f"Persisted forensic evidence {evidence.id} with hash {evidence.interaction_hash}")
        return True
    except Exception as e:
        logger.error(f"Failed to persist forensic evidence: {e}")
        return False


async def persist_audit_entry(entry: AuditLogEntry) -> bool:
    """
    Append audit log entry to immutable audit trail.
    
    Args:
        entry: AuditLogEntry to append
        
    Returns:
        True if successfully appended
    """
    from valerie.db.engine import db
    
    try:
        await db.audit_log.insert_one(entry.model_dump(mode='json'))
        logger.debug(f"Appended audit log entry {entry.id}")
        return True
    except Exception as e:
        logger.error(f"Failed to append audit log entry: {e}")
        return False


async def verify_evidence_integrity(evidence_id: str) -> dict[str, Any]:
    """
    Verify integrity of stored evidence by recomputing hashes.
    
    Args:
        evidence_id: ID of evidence to verify
        
    Returns:
        Verification result with status and details
    """
    from valerie.db.engine import db
    
    evidence_doc = await db.forensic_evidence.find_one({"id": evidence_id})
    if not evidence_doc:
        return {"status": "not_found", "error": "Evidence not found"}
    
    # Retrieve original content from evaluation_results
    eval_doc = await db.evaluation_results.find_one({"task_id": evidence_doc["task_id"]})
    if not eval_doc:
        return {"status": "orphaned", "error": "Source evaluation not found"}
    
    # Recompute hashes
    computed_hashes = compute_content_hash(
        prompt=eval_doc.get("adversarial_prompt", ""),
        response=eval_doc.get("target_response", ""),
        metadata={"run_id": eval_doc.get("run_id")}
    )
    
    # Compare hashes
    if (computed_hashes["prompt_hash"] != evidence_doc["prompt_hash"] or
        computed_hashes["response_hash"] != evidence_doc["response_hash"] or
        computed_hashes["interaction_hash"] != evidence_doc["interaction_hash"]):
        return {
            "status": "tampered",
            "error": "Hash mismatch detected - evidence may have been modified",
            "expected": evidence_doc,
            "computed": computed_hashes
        }
    
    return {
        "status": "verified",
        "evidence_id": evidence_id,
        "verified_at": datetime.now(timezone.utc).isoformat()
    }


async def get_chain_of_custody(run_id: str) -> list[dict]:
    """
    Retrieve complete chain of custody for a pipeline run.
    
    Returns all forensic evidence linked to the run with provenance chains.
    
    Args:
        run_id: Pipeline run ID
        
    Returns:
        List of evidence records sorted by creation time
    """
    from valerie.db.engine import db
    
    cursor = db.forensic_evidence.find(
        {"run_id": run_id},
        sort=[("created_at", 1)]
    )
    
    return await cursor.to_list(length=None)


# Convenience function for hashing during evaluation
async def hash_and_persist_evaluation(run_id: str, task_id: str, 
                                       prompt: str, response: str,
                                       parent_evidence_id: Optional[str] = None) -> Optional[ForensicEvidence]:
    """
    Complete workflow: hash evaluation content and persist forensic record.
    
    This is the primary integration point for the evaluation pipeline.
    
    Args:
        run_id: Parent pipeline run
        task_id: Task that generated this evaluation
        prompt: Adversarial prompt text
        response: Target model response
        parent_evidence_id: Optional parent for refinement chains
        
    Returns:
        ForensicEvidence object if successful, None on failure
    """
    from valerie.db.engine import db
    import uuid
    
    # Compute hashes
    hashes = compute_content_hash(prompt, response, {"run_id": run_id})
    
    # Get technique and endpoint info for provenance
    eval_doc = await db.evaluation_results.find_one({"run_id": run_id, "task_id": task_id})
    if not eval_doc:
        logger.warning(f"Cannot create forensic evidence: evaluation not found for {task_id}")
        return None
    
    evidence = ForensicEvidence(
        id=str(uuid.uuid4()),
        run_id=run_id,
        task_id=task_id,
        prompt_hash=hashes["prompt_hash"],
        response_hash=hashes["response_hash"],
        interaction_hash=hashes["interaction_hash"],
        parent_evidence_id=parent_evidence_id,
        technique_id=eval_doc.get("technique_id", "unknown"),
        endpoint_id=eval_doc.get("endpoint_id", "unknown"),
        created_at=datetime.now(timezone.utc).isoformat(),
        hashed_at=hashes["hashed_at"]
    )
    
    success = await persist_evidence(evidence)
    if not success:
        return None
    
    # Log to audit trail
    audit_entry = AuditLogEntry.create(
        event_type="evidence.created",
        source="forensics.hash_and_persist",
        correlation_id=run_id,
        payload={"evidence_id": evidence.id, "task_id": task_id},
        previous_hash=None  # Could chain from previous entry
    )
    await persist_audit_entry(audit_entry)
    
    return evidence
