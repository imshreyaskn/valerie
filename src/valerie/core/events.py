import json
import logging
from datetime import datetime, UTC
from uuid import uuid4
from typing import Any

from pydantic import BaseModel, Field
import redis.asyncio as redis

from valerie.core.settings import settings

logger = logging.getLogger(__name__)

class Event(BaseModel):
    """
    Universal Event Envelope for the Valerie Security Intelligence Platform.
    All bounded domains communicate exclusively via this event format over Redis Streams.
    """
    id: str = Field(default_factory=lambda: str(uuid4()))
    type: str
    source: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(UTC))
    correlation_id: str  # Usually the run_id, tying a sequence of events together
    causation_id: str | None = None  # The ID of the event that directly caused this one
    payload: dict[str, Any]

class EventPublisher:
    """
    Publishes events to Redis Streams.
    """
    def __init__(self, stream_name: str = "valerie:events"):
        self.stream_name = stream_name
        self._redis: redis.Redis | None = None

    async def connect(self):
        if self._redis is None:
            self._redis = redis.from_url(settings.redis.url, decode_responses=True)
            logger.info("Connected EventPublisher to Redis")

    async def publish(self, event: Event) -> str:
        """
        Publishes the event to the global Redis stream.
        """
        if self._redis is None:
            await self.connect()
            
        event_dict = event.model_dump(mode="json")
        
        # Redis streams require dict values to be strings or bytes
        # We serialize the entire event to a JSON string and store it under the 'data' key
        stream_payload = {"data": json.dumps(event_dict)}
        
        # Add to stream
        message_id = await self._redis.xadd(self.stream_name, stream_payload)  # type: ignore
        
        logger.debug(f"Published event {event.type} to {self.stream_name} (msg_id: {message_id})")
        return message_id

    async def close(self):
        if self._redis is not None:
            await self._redis.aclose()
            self._redis = None

class EventSubscriber:
    """
    Subscribes to events from Redis Streams.
    """
    def __init__(self, stream_name: str = "valerie:events"):
        self.stream_name = stream_name
        self._redis: redis.Redis | None = None

    async def connect(self):
        if self._redis is None:
            self._redis = redis.from_url(settings.redis.url, decode_responses=True)

    async def subscribe(self, last_id: str = "$"):
        """Pub/Sub style subscription (fire-and-forget for new events)"""
        if not self._redis:
            await self.connect()
        assert self._redis is not None
        
        current_id = last_id
        while True:
            messages = await self._redis.xread({self.stream_name: current_id}, count=100, block=15000)
            if not messages:
                yield None, None
                continue
            for stream, stream_messages in messages:
                for msg_id, msg_data in stream_messages:
                    current_id = msg_id
                    if "data" in msg_data:
                        event_dict = json.loads(msg_data["data"])
                        yield current_id, Event(**event_dict)

    async def subscribe_group(self, group_name: str, consumer_name: str):
        """Reliable queue subscription using Redis Consumer Groups."""
        if not self._redis:
            await self.connect()
        assert self._redis is not None
            
        try:
            await self._redis.xgroup_create(self.stream_name, group_name, id="0", mkstream=True)
        except Exception as e:
            if "BUSYGROUP" not in str(e):
                raise
                
        while True:
            messages = await self._redis.xreadgroup(
                group_name, consumer_name, {self.stream_name: ">"}, count=10, block=5000
            )
            if not messages:
                yield None, None
                continue
                
            for stream, stream_messages in messages:
                for msg_id, msg_data in stream_messages:
                    if "data" in msg_data:
                        event_dict = json.loads(msg_data["data"])
                        yield msg_id, Event(**event_dict)
                    await self._redis.xack(self.stream_name, group_name, msg_id)


    async def close(self):
        if self._redis is not None:
            await self._redis.aclose()
            self._redis = None

# Global instance
publisher = EventPublisher()
# Consumers must instantiate their own EventSubscriber to maintain independent cursors.
