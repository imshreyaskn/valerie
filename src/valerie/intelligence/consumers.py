import asyncio
import logging
from datetime import datetime, timezone
from valerie.core.events import Event, EventSubscriber
from valerie.db.engine import redis_client
from valerie.intelligence.clustering import run_prompt_clustering
from valerie.intelligence.anomaly import run_anomaly_detection

logger = logging.getLogger("intelligence.consumers")

DOMAIN_NAME = "intelligence"

async def _record_heartbeat():
    try:
        await redis_client.hset(f"valerie:consumer_health:{DOMAIN_NAME}", mapping={
            "last_heartbeat": datetime.now(timezone.utc).isoformat(),
            "status": "healthy"
        })
    except Exception:
        pass

async def _record_error(err_str: str):
    try:
        await redis_client.hincrby(f"valerie:consumer_health:{DOMAIN_NAME}", "error_count", 1)
        await redis_client.hset(f"valerie:consumer_health:{DOMAIN_NAME}", mapping={
            "last_error": err_str[:250],
            "last_error_time": datetime.now(timezone.utc).isoformat(),
            "status": "degraded"
        })
    except Exception:
        pass

async def intelligence_consumer_loop():
    logger.info("Starting Intelligence Domain Consumer Loop")
    while True:
        subscriber = EventSubscriber()
        try:
            async for msg_id, event in subscriber.subscribe_group("valerie_intelligence", "worker_1", auto_ack=False):
                if event is None:
                    await _record_heartbeat()
                    continue
                if event.type == "run.completed":
                    logger.info(f"Run {event.correlation_id} completed. Triggering intelligence batch processing.")
                    await run_prompt_clustering()
                    await run_anomaly_detection()
                
                if msg_id:
                    await subscriber.ack("valerie_intelligence", msg_id)
                await _record_heartbeat()
        except asyncio.CancelledError:
            await subscriber.close()
            break
        except Exception as e:
            logger.error(f"Error in intelligence consumer loop: {e}")
            await _record_error(str(e))
            await subscriber.close()
            await asyncio.sleep(2)

def start_intelligence_consumer():
    """Starts the intelligence consumer loop in an asyncio Task."""
    return asyncio.create_task(intelligence_consumer_loop())
