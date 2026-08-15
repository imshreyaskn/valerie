import os
import sys
import pytest
import asyncio
from fastapi import HTTPException

sys.path.insert(0, 'src')

from valerie.core.settings import settings
from valerie.api.auth import require_api_key, create_access_token, MASTER_KEY, JWT_SECRET
from valerie.llm.validator import is_safe_url
from valerie.llm.router import _is_retryable_exception
from valerie.graph.pipeline import PipelineRunConfig
from valerie.graph.nodes import extract_json, EvaluationResult
import litellm

# ---------------------------------------------------------
# 1. Authentication & Security Tests (B-01, B-02, B-04, B-07)
# ---------------------------------------------------------
@pytest.mark.asyncio
async def test_require_api_key_master_key():
    # Valid master key via X-API-Key
    auth_result = await require_api_key(x_api_key=MASTER_KEY)
    assert auth_result["type"] == "master_key"
    assert auth_result["role"] == "admin"
    assert auth_result["id"] == "admin_master"

@pytest.mark.asyncio
async def test_require_api_key_invalid_master_key():
    # Invalid master key
    with pytest.raises(HTTPException) as exc_info:
        await require_api_key(x_api_key="vl_live_invalidkey1234567")
    assert exc_info.value.status_code == 401
    assert "Invalid API Key" in exc_info.value.detail

@pytest.mark.asyncio
async def test_require_api_key_jwt():
    # Generate valid JWT
    token = create_access_token({"sub": "user_test_123"})
    from fastapi.security import HTTPAuthorizationCredentials
    bearer = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)
    
    auth_result = await require_api_key(bearer=bearer)
    assert auth_result["type"] == "jwt"
    assert auth_result["id"] == "user_test_123"


@pytest.mark.asyncio
async def test_require_api_key_missing_credentials():
    with pytest.raises(HTTPException) as exc_info:
        await require_api_key()
    assert exc_info.value.status_code == 401
    assert "Missing authentication credentials" in exc_info.value.detail

# ---------------------------------------------------------
# 2. SSRF Protection Tests (B-15, B-34)
# ---------------------------------------------------------
def test_ssrf_blocklist_loopback():
    is_safe, reason = is_safe_url("http://127.0.0.1:8080/admin")
    assert not is_safe
    assert "loopback" in reason.lower()

def test_ssrf_blocklist_metadata():
    is_safe, reason = is_safe_url("http://169.254.169.254/latest/meta-data/")
    assert not is_safe
    assert "private" in reason.lower() or "link-local" in reason.lower()

def test_ssrf_blocklist_private_ip():
    is_safe, reason = is_safe_url("http://10.0.0.1/internal")
    assert not is_safe
    assert "private" in reason.lower()

def test_ssrf_blocklist_valid_external_url():
    is_safe, reason = is_safe_url("https://api.openai.com/v1/chat/completions")
    assert is_safe
    assert reason == ""

def test_ssrf_blocklist_invalid_scheme():
    is_safe, reason = is_safe_url("file:///etc/passwd")
    assert not is_safe
    assert "scheme" in reason.lower()

# ---------------------------------------------------------
# 3. LLM Router Retry Filter Tests (B-30)
# ---------------------------------------------------------
def test_retry_filter_non_retryable_auth_error():
    auth_err = litellm.AuthenticationError(message="Invalid API Key", model="gpt-4", llm_provider="openai")
    assert not _is_retryable_exception(auth_err)

def test_retry_filter_non_retryable_not_found_error():
    not_found_err = litellm.NotFoundError(message="Model not found", model="nonexistent", llm_provider="openai")
    assert not _is_retryable_exception(not_found_err)

def test_retry_filter_retryable_rate_limit():
    rate_limit_err = litellm.RateLimitError(message="Rate limit exceeded", model="gpt-4", llm_provider="openai")
    assert _is_retryable_exception(rate_limit_err)

def test_retry_filter_generic_exception():
    assert _is_retryable_exception(RuntimeError("Connection reset by peer"))

# ---------------------------------------------------------
# 4. Pipeline Config Validation Tests (B-24)
# ---------------------------------------------------------
def test_pipeline_config_valid():
    config_data = {
        "run_id": "test_run_1",
        "user_id": "user_123",
        "endpoint_id": "ep_123",
        "domain": "general",
        "harm_types": ["misinformation"],
        "selected_techniques": ["prompt_injection"],
        "judge_model": "mistral-small-latest",
        "attacker_model": "mistral-small-latest",
        "max_iterations": 5,
        "risk_threshold": 0.8,
        "max_concurrency": 10
    }
    validated = PipelineRunConfig(**config_data)
    assert validated.run_id == "test_run_1"
    assert validated.max_iterations == 5

def test_pipeline_config_invalid_iterations():
    config_data = {
        "run_id": "test_run_2",
        "user_id": "user_123",
        "endpoint_id": "ep_123",
        "domain": "general",
        "selected_techniques": ["prompt_injection"],
        "judge_model": "mistral-small-latest",
        "attacker_model": "mistral-small-latest",
        "max_iterations": 100 # exceeds max 20
    }
    with pytest.raises(Exception):
        PipelineRunConfig(**config_data)

# ---------------------------------------------------------
# 5. Extract JSON & Multi-Objective Model Tests (B-22, B-26)
# ---------------------------------------------------------
def test_extract_json_markdown_block():
    raw_response = '```json\n{"overall_risk_score": 0.85, "novelty": 0.9, "pii_leakage": true}\n```'
    parsed = extract_json(raw_response)
    assert parsed["overall_risk_score"] == 0.85
    assert parsed["novelty"] == 0.9
    assert parsed["pii_leakage"] is True

def test_extract_json_fallback_graceful():
    raw_response = "Sorry I cannot format json: something went wrong"
    parsed = extract_json(raw_response)
    assert parsed["overall_risk_score"] == 0.0
    assert "Failed to parse judge JSON" in parsed["safety_concern"]

# ---------------------------------------------------------
# 6. Technique Registry Validation Test (B-10)
# ---------------------------------------------------------
def test_technique_registry_validation():
    from valerie.attacks.techniques import TECHNIQUES
    assert "indirect_prompting" in TECHNIQUES
    assert "obfuscation" in TECHNIQUES
    assert TECHNIQUES["role_play"].id == "role_play"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
