from valerie.db.engine import db
import logging

logger = logging.getLogger("db.indexes")

async def init_indexes():
    """Create MongoDB indexes for performance, TTL data retention, and JSON Schema validation."""
    logger.info("Initializing MongoDB indexes and JSON schema validators...")
    
    try:
        # 1. users
        await db.users.create_index("uid", unique=True)
        
        # 2. api_keys
        await db.api_keys.create_index([("key_prefix", 1), ("user_id", 1)])
        await db.api_keys.create_index("user_id")
        
        # 3. endpoints
        await db.endpoints.create_index("user_id")
        
        # 4. pipeline_runs (Compound & TTL index: 90 days retention for old runs)
        await db.pipeline_runs.create_index([("user_id", 1), ("created_at", -1)])
        await db.pipeline_runs.create_index("status")
        await db.pipeline_runs.create_index("endpoint_id")
        await db.pipeline_runs.create_index("created_at", expireAfterSeconds=90 * 24 * 3600)
        
        # 5. evaluation_results (Compound & TTL index: 90 days retention)
        await db.evaluation_results.create_index("run_id")
        await db.evaluation_results.create_index("user_id")
        await db.evaluation_results.create_index("task_id")
        await db.evaluation_results.create_index("created_at", expireAfterSeconds=90 * 24 * 3600)
        
        # 6. experience_memory (Compound index & TTL index: 180 days retention for memory)
        await db.experience_memory.create_index([("user_id", 1), ("attack_family", 1), ("domain", 1)])
        await db.experience_memory.create_index("created_at", expireAfterSeconds=180 * 24 * 3600)
        
        # 7. Knowledge Graph Entities
        await db.findings.create_index("run_id")
        await db.findings.create_index("task_id")
        await db.findings.create_index("created_at", expireAfterSeconds=90 * 24 * 3600)
        await db.prompts.create_index("run_id")
        await db.prompts.create_index("task_id")

        # 8. Forensic Evidence and Audit Log (Forensic chain indexes)
        await db.forensic_evidence.create_index("evaluation_id", unique=True)
        await db.forensic_evidence.create_index("run_id")
        await db.forensic_evidence.create_index("created_at", expireAfterSeconds=90 * 24 * 3600)
        await db.audit_log.create_index("sequence_number", unique=True)
        await db.audit_log.create_index("current_hash")
        await db.audit_log.create_index("timestamp", expireAfterSeconds=90 * 24 * 3600)

        # 9. MongoDB Schema Validation Enforcement (C-03)
        await _apply_schema_validators()
        
        logger.info("MongoDB indexes, TTL rules, and schema validators initialized successfully.")
    except Exception as e:
        logger.warning(f"Index initialization warning (may be running in mock/offline mode): {e}")

async def _apply_validator_safely(collection_name: str, validator_doc: dict):
    """Applies a collMod JSON schema validator, creating the collection first if missing."""
    try:
        collections = await db.list_collection_names()
        if collection_name not in collections:
            await db.create_collection(collection_name)
        await db.command("collMod", collection_name, validator=validator_doc, validationLevel="moderate")
    except Exception as e:
        logger.warning(f"Could not apply schema validator to {collection_name}: {e}")

async def _apply_schema_validators():
    """Apply MongoDB JSON Schema validation rules to enforce data integrity at database level."""
    # 1. Pipeline Run Schema Validator
    await _apply_validator_safely("pipeline_runs", {
        "$jsonSchema": {
            "bsonType": "object",
            "required": ["id", "user_id", "endpoint_id", "status", "domain", "selected_techniques"],
            "properties": {
                "id": {"bsonType": "string"},
                "user_id": {"bsonType": "string"},
                "endpoint_id": {"bsonType": "string"},
                "status": {"bsonType": "string"},
                "domain": {"bsonType": "string"},
                "harm_types": {"bsonType": ["array", "null"]},
                "selected_techniques": {"bsonType": "array"},
                "target_model": {"bsonType": ["string", "null"]},
                "judge_model": {"bsonType": ["string", "null"]},
                "attacker_model": {"bsonType": ["string", "null"]},
                "total_tasks": {"bsonType": ["int", "long", "double"]},
                "successful_attacks": {"bsonType": ["int", "long", "double"]},
                "avg_risk_score": {"bsonType": ["double", "int", "long"]}
            }
        }
    })

    # 2. Evaluation Result Schema Validator
    await _apply_validator_safely("evaluation_results", {
        "$jsonSchema": {
            "bsonType": "object",
            "required": ["id", "user_id", "run_id", "task_id", "original_prompt", "harm_type", "technique_id", "adversarial_prompt"],
            "properties": {
                "id": {"bsonType": "string"},
                "user_id": {"bsonType": "string"},
                "run_id": {"bsonType": "string"},
                "task_id": {"bsonType": "string"},
                "original_prompt": {"bsonType": "string"},
                "harm_type": {"bsonType": "string"},
                "technique_id": {"bsonType": "string"},
                "adversarial_prompt": {"bsonType": "string"},
                "target_response": {"bsonType": ["string", "null"]},
                "iterations_used": {"bsonType": ["int", "long", "double"]},
                "is_breakthrough": {"bsonType": "bool"},
                "overall_risk_score": {"bsonType": ["double", "int", "long"]},
                "novelty": {"bsonType": ["double", "int", "long"]},
                "diversity": {"bsonType": ["double", "int", "long"]},
                "realism": {"bsonType": ["double", "int", "long"]},
                "transferability": {"bsonType": ["double", "int", "long"]},
                "semantic_quality": {"bsonType": ["double", "int", "long"]}
            }
        }
    })

    # 3. Forensic Evidence Schema Validator
    await _apply_validator_safely("forensic_evidence", {
        "$jsonSchema": {
            "bsonType": "object",
            "required": ["id", "evaluation_id", "run_id", "payload_hash", "adversarial_prompt_hash", "verdict_hash"],
            "properties": {
                "id": {"bsonType": "string"},
                "evaluation_id": {"bsonType": "string"},
                "run_id": {"bsonType": "string"},
                "user_id": {"bsonType": "string"},
                "payload_hash": {"bsonType": "string"},
                "adversarial_prompt_hash": {"bsonType": "string"},
                "target_response_hash": {"bsonType": "string"},
                "verdict_hash": {"bsonType": "string"}
            }
        }
    })

    # 4. Audit Log Schema Validator
    await _apply_validator_safely("audit_log", {
        "$jsonSchema": {
            "bsonType": "object",
            "required": ["id", "sequence_number", "entity_type", "entity_id", "current_hash", "previous_entry_hash"],
            "properties": {
                "id": {"bsonType": "string"},
                "sequence_number": {"bsonType": ["int", "long"]},
                "entity_type": {"bsonType": "string"},
                "entity_id": {"bsonType": "string"},
                "action": {"bsonType": "string"},
                "current_hash": {"bsonType": "string"},
                "previous_entry_hash": {"bsonType": "string"}
            }
        }
    })
