import asyncio
import sys
import logging

sys.path.insert(0, 'src')

from valerie.db.engine import db, redis_client
from valerie.db.indexes import init_indexes

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("valerie.purge_db")


async def purge_database():
    logger.info("Starting complete database purge...")

    # 1. MongoDB Collections to purge
    collections = await db.list_collection_names()
    logger.info(f"Existing MongoDB collections: {collections}")

    for col_name in collections:
        # We drop evaluation, pipeline runs, findings, audit, memory, prompts, etc.
        logger.info(f"Dropping collection: {col_name}")
        await db[col_name].drop()

    logger.info("All MongoDB collections dropped.")

    # 2. Redis purge
    try:
        logger.info("Flushing Redis keys and event streams...")
        await redis_client.flushdb()
        logger.info("Redis database flushed successfully.")
    except Exception as e:
        logger.warning(f"Could not flush Redis (may be offline or mocked): {e}")

    # 3. Reinitialize fresh indexes and schema validators
    logger.info("Reinitializing indexes and schema validation...")
    await init_indexes()
    logger.info("MongoDB indexes and validators re-created successfully.")

    logger.info("==============================================")
    logger.info("DATABASE PURGE COMPLETE: DB is completely fresh.")
    logger.info("==============================================")


if __name__ == "__main__":
    asyncio.run(purge_database())
