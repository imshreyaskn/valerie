from valerie.db.engine import db
import logging

logger = logging.getLogger("db.indexes")

async def init_indexes():
    """Create MongoDB indexes for performance, TTL data retention, and JSON Schema validation."""
    logger.info("Initializing MongoDB indexes and JSON schema validators...")
    
    # 1. users
    await db.users.create_index("uid", unique=True)
    
    # 2. api_keys
    await db.api_keys.create_index([("key_prefix", 1), ("user_id", 1)])
    await db.api_keys.create_index("user_id")
    
    # 3. endpoints
    await db.endpoints.create_index("user_id")
    
    # 4. pipeline_runs (Compound & TTL index: 90 days retention for old runs) (D-04, D-07)
    await db.pipeline_runs.create_index([("user_id", 1), ("created_at", -1)])
    await db.pipeline_runs.create_index("status")
    await db.pipeline_runs.create_index("endpoint_id")
    await db.pipeline_runs.create_index("created_at", expireAfterSeconds=90 * 24 * 3600)
    
    # 5. evaluation_results (Compound & TTL index: 90 days retention) (D-04, D-07)
    await db.evaluation_results.create_index("run_id")
    await db.evaluation_results.create_index("user_id")
    await db.evaluation_results.create_index("task_id")
    await db.evaluation_results.create_index("created_at", expireAfterSeconds=90 * 24 * 3600)
    
    # 6. experience_memory (Compound index & TTL index: 180 days retention for memory) (D-04, D-07)
    await db.experience_memory.create_index([("user_id", 1), ("attack_family", 1), ("domain", 1)])
    await db.experience_memory.create_index("created_at", expireAfterSeconds=180 * 24 * 3600)
    
    # 7. Knowledge Graph Entities
    await db.findings.create_index("run_id")
    await db.findings.create_index("task_id")
    await db.findings.create_index("created_at", expireAfterSeconds=90 * 24 * 3600)
    await db.prompts.create_index("run_id")
    await db.prompts.create_index("task_id")

    # 8. MongoDB Schema Validation Enforcement (D-01)
    await _apply_schema_validators()
    
    logger.info("MongoDB indexes, TTL rules, and schema validators initialized successfully.")

async def _apply_schema_validators():
    """Apply MongoDB JSON Schema validation rules to enforce data integrity at database level."""
    try:
        # Pipeline Run Schema
        await db.command("collMod", "pipeline_runs", validator={
            "$jsonSchema": {
                "bsonType": "object",
                "required": ["id", "user_id", "endpoint_id", "status", "domain"],
                "properties": {
                    "id": {"bsonType": "string"},
                    "user_id": {"bsonType": "string"},
                    "endpoint_id": {"bsonType": "string"},
                    "status": {"bsonType": "string"},
                    "domain": {"bsonType": "string"}
                }
            }
        }, validationLevel="moderate")
    except Exception as e:
        logger.warning(f"Could not apply schema validator to pipeline_runs (may require collection creation): {e}")

