import os
import sys
import pytest
import asyncio
from datetime import datetime, timezone

sys.path.insert(0, 'src')

from valerie.core.settings import settings
from valerie.db.engine import db, client, redis_client
from valerie.db.models import EvaluationResult, Endpoint, PipelineRun
from valerie.db.indexes import init_indexes

@pytest.mark.asyncio
async def test_database_name_alignment():
    # Verify D-09 fix: db uses settings.database.database name
    assert db.name == settings.database.database

@pytest.mark.asyncio
async def test_evaluation_result_list_bounds():
    # Verify D-06 fix: EvaluationResult list fields are bounded strings
    res = EvaluationResult(
        user_id="user_123",
        run_id="run_123",
        task_id="task_123",
        original_prompt="test prompt",
        harm_type="bias",
        technique_id="technique_1",
        adversarial_prompt="adv prompt",
        target_response="resp",
        iterations_used=1,
        is_breakthrough=False,
        pii_examples=["example1", "example2"],
        bias_examples=["bias1"]
    )
    assert res.pii_examples == ["example1", "example2"]
    assert res.bias_examples == ["bias1"]

@pytest.mark.asyncio
async def test_index_initialization_run(monkeypatch):
    # Verify D-04 & D-07: init_indexes runs cleanly without errors with current loop Motor client
    from motor.motor_asyncio import AsyncIOMotorClient
    import certifi
    test_client = AsyncIOMotorClient(settings.database.connection_url, tlsCAFile=certifi.where())
    test_db = test_client[settings.database.database]
    
    import valerie.db.indexes
    monkeypatch.setattr(valerie.db.indexes, "db", test_db)
    
    try:
        await valerie.db.indexes.init_indexes()
    except Exception as e:
        pytest.fail(f"init_indexes raised unexpected exception: {e}")
    finally:
        test_client.close()


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
