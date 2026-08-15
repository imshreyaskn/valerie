import litellm
from tenacity import retry, wait_exponential, stop_after_attempt, retry_if_exception_type

@retry(
    wait=wait_exponential(multiplier=1.5, min=2, max=20),
    stop=stop_after_attempt(3),
    retry=retry_if_exception_type(Exception)
)
async def compute_embedding(text: str) -> list[float]:
    """
    Computes a vector embedding for the given text.
    Fails gracefully to a zero-vector if no API key is present,
    following the Ponytail lazy-dev rule.
    """
    try:
        response = await litellm.aembedding(
            model="text-embedding-3-small",
            input=[text]
        )
        return response.data[0]["embedding"]
    except Exception as e:
        print(f"Embedding failed (likely no API key): {e}. Returning zero vector.")
        return [0.0] * 1536

