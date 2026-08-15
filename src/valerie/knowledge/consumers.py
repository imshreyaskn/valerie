import asyncio
import logging
from typing import Any
from datetime import datetime
from valerie.core.events import Event, EventSubscriber, publisher
from valerie.db.engine import db, redis_client
from valerie.knowledge.entities import Finding, PromptEntity, Evidence, Weakness
from valerie.knowledge.embedding import compute_embedding

logger = logging.getLogger(__name__)

# Consumer health tracking
CONSUMER_ERROR_COUNT = 0
CONSUMER_LAST_ERROR_TIME: datetime | None = None
MAX_ERRORS_BEFORE_ALERT = 5
ERROR_WINDOW_SECONDS = 300  # 5 minutes

def compute_severity(verdict: dict[str, Any]) -> str:
    score = float(verdict.get("overall_risk_score", 0.0))
    if score >= 0.9: return "critical"
    if score >= 0.7: return "high"
    if score >= 0.4: return "medium"
    return "low"

def extract_evidence(verdict: dict[str, Any]) -> list[Evidence]:
    evidence = []
    if verdict.get("pii_leakage"):
        for ex in verdict.get("pii_examples", []):
            evidence.append(Evidence(type="pii_leakage", description=str(ex)))
    if str(verdict.get("bias", "none")).lower() != "none":
        evidence.append(Evidence(type="bias", description=str(verdict.get("bias"))))
    if verdict.get("toxicity"):
        evidence.append(Evidence(type="toxicity", description=str(verdict.get("toxicity_severity"))))
    return evidence

async def process_judge_completed(event: Event):
    payload = event.payload
    verdict = payload.get("verdict", {})
    task_id = payload.get("task_id")
    iteration = payload.get("iteration", 0)
    is_breakthrough = payload.get("is_breakthrough", False)

    # Note: the task_id contains harm_type and technique_id in its structure,
    # but we should ideally pull them from the task state. Since we only have
    # the event payload, we will extract what we can.
    # In a full implementation, we'd query the DB or the event stream for the task info.
    # For now, we store the finding with the available data.
    
    # Let's get the original prompt text from the DB evaluation_results if it exists,
    # or just proceed with what we have.
    # To be lazy (Ponytail rule), we'll do the minimal viable entity creation.
    
    task_id_str = str(task_id) if task_id is not None else ""
    technique = payload.get("technique_id", "unknown")
    endpoint_id = payload.get("endpoint_id", "unknown")
    
    finding = Finding(
        prompt_id=f"{task_id_str}_{iteration}",
        endpoint_id=endpoint_id,
        technique_id=technique,
        run_id=str(event.correlation_id),
        task_id=task_id_str,
        severity=compute_severity(verdict),
        verdict=verdict,
        evidence=extract_evidence(verdict),
        is_breakthrough=is_breakthrough
    )
    
    # Insert Finding
    await db.findings.insert_one(finding.model_dump(mode="json"))
    
    # We will let the Intelligence domain handle Weakness creation later,
    # but for now we emit the finding created event.
    await publisher.publish(Event(
        type="finding.created",
        source="knowledge.consumer",
        correlation_id=event.correlation_id,
        payload={"finding_id": finding.id, "severity": finding.severity}
    ))

async def process_prompt_generated(event: Event):
    payload = event.payload
    task_id = payload.get("task_id")
    iteration = payload.get("iteration", 0)
    prompt_text = payload.get("adversarial_prompt", "")
    
    embedding = await compute_embedding(prompt_text)
    
    task_id_str = str(task_id) if task_id is not None else ""
    technique = payload.get("technique_id", "unknown")
    parent_prompt_id = payload.get("parent_prompt_id", None)
    
    prompt_entity = PromptEntity(
        id=f"{task_id_str}_{iteration}",
        text=prompt_text,
        embedding=embedding,
        technique_id=technique,
        parent_prompt_id=parent_prompt_id,
        seed_prompt_id=payload.get("seed_prompt_id", None),
        iteration=iteration,
        genome=[],
        run_id=str(event.correlation_id),
        task_id=task_id_str
    )
    
    await db.prompts.insert_one(prompt_entity.model_dump(mode="json"))

async def _record_consumer_error(error_msg: str):
    """Track consumer errors and alert if threshold exceeded."""
    global CONSUMER_ERROR_COUNT, CONSUMER_LAST_ERROR_TIME
    
    now = datetime.utcnow()
    
    # Check if we're still in the error window
    if CONSUMER_LAST_ERROR_TIME:
        elapsed = (now - CONSUMER_LAST_ERROR_TIME).total_seconds()
        if elapsed > ERROR_WINDOW_SECONDS:
            # Window expired, reset counter
            CONSUMER_ERROR_COUNT = 1
            CONSUMER_LAST_ERROR_TIME = now
        else:
            CONSUMER_ERROR_COUNT += 1
    else:
        CONSUMER_ERROR_COUNT = 1
        CONSUMER_LAST_ERROR_TIME = now
    
    # Alert if threshold exceeded
    if CONSUMER_ERROR_COUNT >= MAX_ERRORS_BEFORE_ALERT:
        logger.critical(
            f"CONSUMER HEALTH ALERT: {CONSUMER_ERROR_COUNT} errors in {ERROR_WINDOW_SECONDS}s. "
            f"Last error: {error_msg}"
        )
        # Publish alert event for monitoring systems
        try:
            await publisher.publish(Event(
                type="consumer.health_alert",
                source="knowledge.consumer",
                correlation_id="system",
                payload={
                    "consumer": "knowledge",
                    "error_count": CONSUMER_ERROR_COUNT,
                    "error_window_seconds": ERROR_WINDOW_SECONDS,
                    "last_error": error_msg[:500]
                }
            ))
        except Exception:
            pass  # Don't cascade failures


async def knowledge_consumer_loop():
    """
    Knowledge domain event consumer with proper error handling and health monitoring.
    
    Features:
    - Dead letter queue simulation via re-publish on failure
    - Error rate tracking with alerting
    - Graceful shutdown on cancellation
    - Exponential backoff on repeated failures
    """
    logger.info("Starting Knowledge Domain Consumer Loop")
    consecutive_failures = 0
    max_consecutive_failures = 10
    
    while True:
        subscriber = EventSubscriber()
        try:
            async for msg_id, event in subscriber.subscribe_group("valerie_knowledge", "worker_1"):
                if event is None:
                    continue
                
                try:
                    if event.type == "judge.completed":
                        await process_judge_completed(event)
                    elif event.type == "prompt.generated":
                        await process_prompt_generated(event)
                    
                    # Reset consecutive failures on success
                    consecutive_failures = 0
                    
                except Exception as e:
                    logger.error(f"Error processing event {event.type}: {e}", exc_info=True)
                    consecutive_failures += 1
                    
                    # Record error for health monitoring
                    await _record_consumer_error(str(e))
                    
                    # Attempt to re-queue failed event (dead letter pattern)
                    try:
                        await publisher.publish(Event(
                            type=f"{event.type}.failed",
                            source="knowledge.consumer.dlq",
                            correlation_id=event.correlation_id,
                            payload={
                                "original_event": event.model_dump(mode="json"),
                                "error": str(e)[:500],
                                "retry_count": consecutive_failures
                            }
                        ))
                    except Exception as requeue_error:
                        logger.error(f"Failed to re-queue failed event: {requeue_error}")
                    
                    # Circuit breaker: exit if too many consecutive failures
                    if consecutive_failures >= max_consecutive_failures:
                        logger.critical(
                            f"Circuit breaker triggered: {consecutive_failures} consecutive failures. "
                            "Shutting down consumer for manual intervention."
                        )
                        await subscriber.close()
                        return
                        
        except asyncio.CancelledError:
            logger.info("Knowledge consumer loop cancelled gracefully")
            await subscriber.close()
            break
        except Exception as e:
            logger.error(f"Fatal error in knowledge consumer loop: {e}", exc_info=True)
            await _record_consumer_error(str(e))
            await subscriber.close()
            # Exponential backoff before restart
            backoff = min(2 ** consecutive_failures, 30)
            logger.info(f"Restarting consumer in {backoff}s...")
            await asyncio.sleep(backoff)

def start_knowledge_consumer():
    """Starts the consumer loop in an asyncio Task."""
    return asyncio.create_task(knowledge_consumer_loop())
