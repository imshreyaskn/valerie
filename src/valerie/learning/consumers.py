import asyncio
import logging
from datetime import datetime, timezone
import uuid
from valerie.core.events import Event, EventSubscriber, publisher
from valerie.db.engine import db, redis_client
from valerie.learning.genome import extract_genome

logger = logging.getLogger("learning.consumers")

DOMAIN_NAME = "learning"

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

async def process_task_completed(event: Event):
    payload = event.payload
    task_id = payload.get("task_id", "")
    final_result = payload.get("final_result", {})
    
    if not final_result.get("is_breakthrough"):
        return
        
    attack_family = final_result.get("attack_family")
    original_prompt = final_result.get("original_prompt")
    adversarial_prompt = final_result.get("adversarial_prompt")
    score = final_result.get("overall_risk_score", 0.0)
    
    user_id = payload.get("user_id", "unknown")
    domain = payload.get("domain", "general")
    
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

async def learning_consumer_loop():
    logger.info("Starting Learning Domain Consumer Loop")
    while True:
        subscriber = EventSubscriber()
        try:
            async for msg_id, event in subscriber.subscribe_group("valerie_learning", "worker_1", auto_ack=False):
                if event is None:
                    await _record_heartbeat()
                    continue
                if event.type == "task.completed":
                    await process_task_completed(event)
                elif event.type == "prompt.generated":
                    await process_prompt_generated(event)
                
                if msg_id:
                    await subscriber.ack("valerie_learning", msg_id)
                await _record_heartbeat()
        except asyncio.CancelledError:
            await subscriber.close()
            break
        except Exception as e:
            logger.error(f"Error in learning consumer loop: {e}")
            await _record_error(str(e))
            await subscriber.close()
            await asyncio.sleep(2)

def start_learning_consumer():
    """Starts the learning consumer loop in an asyncio Task."""
    return asyncio.create_task(learning_consumer_loop())
