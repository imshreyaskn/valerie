import litellm
from litellm import acompletion
import asyncio
from tenacity import retry, wait_exponential, stop_after_attempt, retry_if_exception_type

litellm.drop_params = True   # ignore unsupported params silently

@retry(
    wait=wait_exponential(multiplier=1.5, min=2, max=20),
    stop=stop_after_attempt(7),
    retry=retry_if_exception_type(Exception)
)
async def call_llm(
    messages: list[dict],
    model: str,
    api_key: str | None = None,
    api_base: str | None = None,
    temperature: float = 0.7,
    max_tokens: int = 4096,
    max_retries: int = 3,
    timeout: int = 60,
) -> str:
    try:
        response = await acompletion(
            model=model,
            messages=messages,
            api_key=api_key,
            api_base=api_base,
            temperature=temperature,
            max_tokens=max_tokens,
            num_retries=0, # Let tenacity handle retries
            timeout=timeout,
        )
        return response.choices[0].message.content
    except Exception as e:
        # Tenacity will catch this and backoff
        raise e
