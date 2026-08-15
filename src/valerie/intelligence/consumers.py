import asyncio
import logging
from valerie.core.events import Event, EventSubscriber
from valerie.intelligence.clustering import run_prompt_clustering
from valerie.intelligence.anomaly import run_anomaly_detection

logger = logging.getLogger(__name__)

async def intelligence_consumer_loop():
    logger.info("Starting Intelligence Domain Consumer Loop")
    while True:
        subscriber = EventSubscriber()
        try:
            async for msg_id, event in subscriber.subscribe_group("valerie_intelligence", "worker_1"):
                if event is None:
                    continue
                if event.type == "run.completed":
                    logger.info(f"Run {event.correlation_id} completed. Triggering intelligence batch processing.")
                    await run_prompt_clustering()
                    await run_anomaly_detection()
        except asyncio.CancelledError:
            await subscriber.close()
            break
        except Exception as e:
            logger.error(f"Error in intelligence consumer loop: {e}")
            await subscriber.close()
            await asyncio.sleep(2)

def start_intelligence_consumer():
    """Starts the intelligence consumer loop in an asyncio Task."""
    return asyncio.create_task(intelligence_consumer_loop())
