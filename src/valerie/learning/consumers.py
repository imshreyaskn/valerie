import asyncio
import logging
import uuid
from datetime import datetime
from valerie.core.events import Event, EventSubscriber, publisher
from valerie.db.engine import db, redis_client
from valerie.learning.genome import extract_genome

logger = logging.getLogger(__name__)

# Consumer health tracking (same pattern as other consumers)
CONSUMER_ERROR_COUNT = 0
CONSUMER_LAST_ERROR_TIME: datetime | None = None
MAX_ERRORS_BEFORE_ALERT = 5
ERROR_WINDOW_SECONDS = 300

async def process_task_completed(event: Event):
    payload = event.payload
    task_id = payload.get("task_id", "")
    final_result = payload.get("final_result", {})
    
    if not final_result.get("is_breakthrough"):
        return
        
    # Rebuild experience memory by storing the successful adversarial prompt
    attack_family = final_result.get("attack_family")
    original_prompt = final_result.get("original_prompt")
    adversarial_prompt = final_result.get("adversarial_prompt")
    score = final_result.get("overall_risk_score", 0.0)
    
    user_id = payload.get("user_id", "unknown")
    domain = payload.get("domain", "general")
    
    # Upsert experience memory
    await db.experience_memory.update_one(
        {
            "user_id": user_id, 
            "attack_family": attack_family, 
            "domain": domain, 
            "original_prompt": original_prompt
        },
        {
            "$set": {
                "successful_pattern": adversarial_prompt,
                "score": score
            }
        },
        upsert=True
    )
    logger.info(f"Updated experience memory for {attack_family} in domain {domain}")

async def process_prompt_generated(event: Event):
    payload = event.payload
    prompt_text = payload.get("adversarial_prompt", "")
    task_id = payload.get("task_id", "")
    iteration = payload.get("iteration", 0)
    
    if not prompt_text:
        return
        
    genome = await extract_genome(prompt_text)
    prompt_id = f"{task_id}_{iteration}"
    
    await db.prompts.update_one(
        {"id": prompt_id},
        {"$set": {"genome": genome}}
    )
    
    await publisher.publish(Event(
        type="genome.computed",
        source="learning.consumer",
        correlation_id=event.correlation_id,
        payload={"prompt_id": prompt_id, "genome": genome}
    ))

async def _record_consumer_error(error_msg: str):
    """Track consumer errors and alert if threshold exceeded."""
    global CONSUMER_ERROR_COUNT, CONSUMER_LAST_ERROR_TIME
    
    now = datetime.utcnow()
    
    if CONSUMER_LAST_ERROR_TIME:
        elapsed = (now - CONSUMER_LAST_ERROR_TIME).total_seconds()
        if elapsed > ERROR_WINDOW_SECONDS:
            CONSUMER_ERROR_COUNT = 1
            CONSUMER_LAST_ERROR_TIME = now
        else:
            CONSUMER_ERROR_COUNT += 1
    else:
        CONSUMER_ERROR_COUNT = 1
        CONSUMER_LAST_ERROR_TIME = now
    
    if CONSUMER_ERROR_COUNT >= MAX_ERRORS_BEFORE_ALERT:
        logger.critical(
            f"LEARNING CONSUMER HEALTH ALERT: {CONSUMER_ERROR_COUNT} errors in {ERROR_WINDOW_SECONDS}s. "
            f"Last error: {error_msg}"
        )
        try:
            await publisher.publish(Event(
                type="consumer.health_alert",
                source="learning.consumer",
                correlation_id="system",
                payload={
                    "consumer": "learning",
                    "error_count": CONSUMER_ERROR_COUNT,
                    "error_window_seconds": ERROR_WINDOW_SECONDS,
                    "last_error": error_msg[:500]
                }
            ))
        except Exception:
            pass


async def learning_consumer_loop():
    """
    Learning domain event consumer with proper error handling and health monitoring.
    
    Features:
    - Dead letter queue simulation via re-publish on failure
    - Error rate tracking with alerting
    - Graceful shutdown on cancellation
    - Exponential backoff on repeated failures
    - Circuit breaker for consecutive failures
    """
    logger.info("Starting Learning Domain Consumer Loop")
    consecutive_failures = 0
    max_consecutive_failures = 10
    
    while True:
        subscriber = EventSubscriber()
        try:
            async for msg_id, event in subscriber.subscribe_group("valerie_learning", "worker_1"):
                if event is None:
                    continue
                
                try:
                    if event.type == "task.completed":
                        await process_task_completed(event)
                    elif event.type == "prompt.generated":
                        await process_prompt_generated(event)
                    
                    consecutive_failures = 0
                    
                except Exception as e:
                    logger.error(f"Error processing event {event.type}: {e}", exc_info=True)
                    consecutive_failures += 1
                    
                    await _record_consumer_error(str(e))
                    
                    # Re-queue failed event for manual review
                    try:
                        await publisher.publish(Event(
                            type=f"{event.type}.failed",
                            source="learning.consumer.dlq",
                            correlation_id=event.correlation_id,
                            payload={
                                "original_event": event.model_dump(mode="json"),
                                "error": str(e)[:500],
                                "retry_count": consecutive_failures
                            }
                        ))
                    except Exception as requeue_error:
                        logger.error(f"Failed to re-queue failed event: {requeue_error}")
                    
                    if consecutive_failures >= max_consecutive_failures:
                        logger.critical(
                            f"Circuit breaker triggered: {consecutive_failures} consecutive failures. "
                            "Shutting down consumer for manual intervention."
                        )
                        await subscriber.close()
                        return
                        
        except asyncio.CancelledError:
            logger.info("Learning consumer loop cancelled gracefully")
            await subscriber.close()
            break
        except Exception as e:
            logger.error(f"Fatal error in learning consumer loop: {e}", exc_info=True)
            await _record_consumer_error(str(e))
            await subscriber.close()
            backoff = min(2 ** consecutive_failures, 30)
            logger.info(f"Restarting consumer in {backoff}s...")
            await asyncio.sleep(backoff)

def start_learning_consumer():
    """Starts the learning consumer loop in an asyncio Task."""
    return asyncio.create_task(learning_consumer_loop())
