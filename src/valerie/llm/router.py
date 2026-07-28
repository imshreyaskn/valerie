from typing import Any, Optional
import litellm
from litellm import acompletion
import asyncio
from tenacity import retry, wait_exponential, stop_after_attempt, retry_if_exception

litellm.drop_params = True   # ignore unsupported params silently

def _is_retryable_exception(exc: BaseException) -> bool:
    """
    Do NOT retry permanent client/auth/format errors (401, 403, 404, 400).
    Only retry transient network, rate-limit (429), or server (5xx) errors.
    """
    # Check LiteLLM specific exception types
    if isinstance(exc, (litellm.AuthenticationError, litellm.PermissionDeniedError, litellm.NotFoundError, litellm.InvalidRequestError)):
        return False
    
    # Check HTTP status codes if available on exception
    status_code = getattr(exc, "status_code", None) or getattr(exc, "code", None)
    if status_code in (400, 401, 403, 404):
        return False

    err_msg = str(exc).lower()
    if any(term in err_msg for term in ["unauthorized", "invalid_api_key", "invalid api key", "authentication error", "model not found"]):
        return False

    return True

@retry(
    wait=wait_exponential(multiplier=1.5, min=2, max=20),
    stop=stop_after_attempt(5),
    retry=retry_if_exception(_is_retryable_exception)
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
    response_format: dict | None = None,
) -> str:
    try:
        kwargs: dict[str, Any] = {
            "model": model,
            "messages": messages,
            "api_key": api_key,
            "api_base": api_base,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "num_retries": 0, # Let tenacity handle retries
            "timeout": timeout,
        }
        if response_format:
            kwargs["response_format"] = response_format
            
        response = await acompletion(**kwargs)
        return response.choices[0].message.content
    except Exception as e:
        # Tenacity will catch this and backoff if retryable
        raise e
