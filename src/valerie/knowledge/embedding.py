import logging
import litellm
from tenacity import retry, wait_exponential, stop_after_attempt, retry_if_exception_type

logger = logging.getLogger("knowledge.embedding")

@retry(
    wait=wait_exponential(multiplier=1.5, min=2, max=10),
    stop=stop_after_attempt(3),
    retry=retry_if_exception_type(Exception),
    reraise=False
)
async def _fetch_embedding(text: str) -> list[float] | None:
    response = await litellm.aembedding(
        model="text-embedding-3-small",
        input=[text]
    )
    return response.data[0]["embedding"]

async def compute_embedding(text: str) -> list[float]:
    """
    Computes a vector embedding for the given text.
    Returns empty list on failure rather than a corrupting zero vector (H-07).
    """
    if not text or not text.strip():
        return []

    try:
        res = await _fetch_embedding(text)
        return res if res is not None else []
    except Exception as e:
        logger.warning(f"Embedding generation failed: {e}. Omitting vector to prevent clustering corruption.")
        return []
