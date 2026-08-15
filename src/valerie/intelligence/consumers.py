import asyncio
import logging
from datetime import datetime
from valerie.core.events import Event, EventSubscriber, publisher
from valerie.db.engine import db, redis_client
from valerie.intelligence.clustering import run_prompt_clustering
from valerie.intelligence.anomaly import run_anomaly_detection

logger = logging.getLogger(__name__)

# Consumer health tracking (same pattern as knowledge consumer)
CONSUMER_ERROR_COUNT = 0
CONSUMER_LAST_ERROR_TIME: datetime | None = None
MAX_ERRORS_BEFORE_ALERT = 5
ERROR_WINDOW_SECONDS = 300


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
            f"INTELLIGENCE CONSUMER HEALTH ALERT: {CONSUMER_ERROR_COUNT} errors in {ERROR_WINDOW_SECONDS}s. "
            f"Last error: {error_msg}"
        )
        try:
            await publisher.publish(Event(
                type="consumer.health_alert",
                source="intelligence.consumer",
                correlation_id="system",
                payload={
                    "consumer": "intelligence",
                    "error_count": CONSUMER_ERROR_COUNT,
                    "error_window_seconds": ERROR_WINDOW_SECONDS,
                    "last_error": error_msg[:500]
                }
            ))
        except Exception:
            pass


async def intelligence_consumer_loop():
    """
    Intelligence domain event consumer with proper error handling and health monitoring.
    
    Features:
    - Dead letter queue simulation via re-publish on failure
    - Error rate tracking with alerting
    - Graceful shutdown on cancellation
    - Exponential backoff on repeated failures
    - Circuit breaker for consecutive failures
    """
    logger.info("Starting Intelligence Domain Consumer Loop")
    consecutive_failures = 0
    max_consecutive_failures = 10
    
    while True:
        subscriber = EventSubscriber()
        try:
            async for msg_id, event in subscriber.subscribe_group("valerie_intelligence", "worker_1"):
                if event is None:
                    continue
                
                try:
                    if event.type == "run.completed":
                        logger.info(f"Run {event.correlation_id} completed. Triggering intelligence batch processing.")
                        await run_prompt_clustering()
                        await run_anomaly_detection()
                    
                    consecutive_failures = 0
                    
                except Exception as e:
                    logger.error(f"Error processing run.completed event: {e}", exc_info=True)
                    consecutive_failures += 1
                    
                    await _record_consumer_error(str(e))
                    
                    # Re-queue failed event for manual review
                    try:
                        await publisher.publish(Event(
                            type=f"{event.type}.failed",
                            source="intelligence.consumer.dlq",
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
            logger.info("Intelligence consumer loop cancelled gracefully")
            await subscriber.close()
            break
        except Exception as e:
            logger.error(f"Fatal error in intelligence consumer loop: {e}", exc_info=True)
            await _record_consumer_error(str(e))
            await subscriber.close()
            backoff = min(2 ** consecutive_failures, 30)
            logger.info(f"Restarting consumer in {backoff}s...")
            await asyncio.sleep(backoff)

def start_intelligence_consumer():
    """Starts the intelligence consumer loop in an asyncio Task."""
    return asyncio.create_task(intelligence_consumer_loop())
