import pytest
import asyncio
from unittest.mock import AsyncMock, patch, MagicMock
from datetime import datetime, timezone
from valerie.forensics.evidence import (
    compute_sha256,
    ForensicEvidence,
    AuditLogEntry,
    hash_and_persist_evaluation,
    verify_audit_log_chain,
    GENESIS_HASH
)
from valerie.db.models import EvaluationResult, JudgeVerdictPayload, PipelineRun
from valerie.llm.validator import is_safe_url
from valerie.api.auth import create_access_token, JWT_SECRET, ALGORITHM
from valerie.knowledge.embedding import compute_embedding
from valerie.learning.genome import _heuristic_genome
from valerie.core.settings import ConfigurationError
from jose import jwt

@pytest.mark.asyncio
async def test_forensic_hashing_and_chaining():
    """Test cryptographic SHA-256 evidence hashing and immutable audit chaining."""
    stored_evidence = []
    stored_audit_log = []

    mock_db = MagicMock()
    
    async def mock_insert_evidence(doc):
        stored_evidence.append(doc)
        return MagicMock(inserted_id="mock_id")
        
    async def mock_insert_audit(doc):
        stored_audit_log.append(doc)
        return MagicMock(inserted_id="mock_id")
        
    async def mock_find_latest_audit(filter_dict, sort=None):
        if stored_audit_log:
            return stored_audit_log[-1]
        return None

    mock_db.forensic_evidence.insert_one = AsyncMock(side_effect=mock_insert_evidence)
    mock_db.audit_log.insert_one = AsyncMock(side_effect=mock_insert_audit)
    mock_db.audit_log.find_one = AsyncMock(side_effect=mock_find_latest_audit)

    mock_cursor = MagicMock()
    mock_cursor.sort = MagicMock(return_value=mock_cursor)
    mock_cursor.limit = MagicMock(return_value=mock_cursor)
    mock_cursor.to_list = AsyncMock(side_effect=lambda length: stored_audit_log)
    mock_db.audit_log.find = MagicMock(return_value=mock_cursor)

    with patch("valerie.forensics.evidence.db", mock_db):
        eval_sample1 = {
            "id": "eval-101",
            "user_id": "user-test",
            "run_id": "run-test",
            "task_id": "task-test",
            "original_prompt": "Test original prompt",
            "harm_type": "pii_leakage",
            "attack_family": "obfuscation",
            "adversarial_prompt": "Test transformed prompt 1",
            "target_response": "Synthetic model response",
            "iterations_used": 1,
            "is_breakthrough": True,
            "overall_risk_score": 0.85,
            "pii_leakage": True,
            "safety_concern": "PII exposed"
        }

        # 1. First record (starts with GENESIS_HASH)
        evidence1 = await hash_and_persist_evaluation(eval_sample1)
        assert evidence1.evaluation_id == "eval-101"
        assert len(evidence1.payload_hash) == 64
        assert len(stored_audit_log) == 1
        assert stored_audit_log[0]["previous_entry_hash"] == GENESIS_HASH

        # 2. Second record (chained to first record's current_hash)
        eval_sample2 = {**eval_sample1, "id": "eval-102", "adversarial_prompt": "Prompt 2"}
        evidence2 = await hash_and_persist_evaluation(eval_sample2)
        assert evidence2.evaluation_id == "eval-102"
        assert len(stored_audit_log) == 2
        assert stored_audit_log[1]["previous_entry_hash"] == stored_audit_log[0]["current_hash"]

        # 3. Verify audit log integrity
        verification = await verify_audit_log_chain(limit=10)
        assert verification["valid"] is True
        assert verification["total_verified"] == 2
        assert verification["status"] == "verified_intact"

def test_ssrf_and_dns_rebinding_protection():
    """Test is_safe_url rejects loopback, metadata, private IPs, and non-http schemes."""
    # Loopback
    is_safe, reason = is_safe_url("http://127.0.0.1:8000/v1")
    assert is_safe is False
    assert "loopback" in reason.lower() or "restricted" in reason.lower()

    # Cloud metadata IP (AWS/GCP/Azure)
    is_safe, reason = is_safe_url("http://169.254.169.254/latest/meta-data")
    assert is_safe is False

    # Private network RFC1918
    is_safe, reason = is_safe_url("http://192.168.1.1/api")
    assert is_safe is False

    is_safe, reason = is_safe_url("http://10.0.0.5/api")
    assert is_safe is False

    # Non-HTTP/HTTPS schemes
    is_safe, reason = is_safe_url("file:///etc/passwd")
    assert is_safe is False

    is_safe, reason = is_safe_url("gopher://127.0.0.1:70")
    assert is_safe is False

def test_timezone_aware_jwt():
    """Test JWT tokens are issued with timezone-aware UTC timestamps."""
    token = create_access_token({"sub": "user_123"})
    payload = jwt.decode(token, JWT_SECRET, algorithms=[ALGORITHM])
    assert payload["sub"] == "user_123"
    assert "exp" in payload
    exp_timestamp = payload["exp"]
    current_timestamp = datetime.now(timezone.utc).timestamp()
    assert exp_timestamp > current_timestamp

def test_unified_evaluation_result_model():
    """Test canonical EvaluationResult and JudgeVerdictPayload serialization."""
    verdict = JudgeVerdictPayload(
        pii_leakage=True,
        overall_risk_score=0.92,
        novelty=0.8,
        diversity=0.7,
        realism=0.9,
        transferability=0.85,
        semantic_quality=0.75
    )
    dumped = verdict.model_dump()
    assert dumped["overall_risk_score"] == 0.92
    assert dumped["novelty"] == 0.8

    eval_result = EvaluationResult(
        user_id="u1",
        run_id="r1",
        task_id="t1",
        original_prompt="test",
        harm_type="general",
        technique_id="obfuscation",
        adversarial_prompt="adv test",
        target_response="resp",
        iterations_used=2,
        is_breakthrough=True,
        overall_risk_score=0.92,
        novelty=0.8
    )
    assert eval_result.is_breakthrough is True
    assert eval_result.created_at.tzinfo is not None

def test_heuristic_genome_extraction():
    """Test deterministic heuristic genome extraction."""
    genome = _heuristic_genome("Admin compliance urgent override immediately. Fictional roleplay scenario.")
    assert len(genome) == 5
    assert genome[0] > 0.0  # Authority
    assert genome[1] > 0.0  # Urgency
    assert genome[4] > 0.0  # Roleplay

@pytest.mark.asyncio
async def test_embedding_no_zero_vector_corruption():
    """Test that embedding fallback returns empty list rather than 1536 zero vector."""
    res = await compute_embedding("")
    assert res == []
