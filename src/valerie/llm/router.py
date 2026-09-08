import asyncio
import logging
import random
import re
import time
from typing import Any
import litellm
from litellm import acompletion

litellm.drop_params = True   # ignore unsupported params silently

logger = logging.getLogger("valerie.llm.router")


def _is_permanent_client_error(exc: BaseException) -> bool:
    """
    Returns True for permanent client errors (400, 401, 403, 404) that should NEVER be retried.
    """
    if isinstance(exc, (litellm.AuthenticationError, litellm.PermissionDeniedError, litellm.NotFoundError, litellm.InvalidRequestError)):
        return True
    
    status_code = getattr(exc, "status_code", None) or getattr(exc, "code", None)
    if status_code in (400, 401, 403, 404):
        return True

    err_msg = str(exc).lower()
    if any(term in err_msg for term in ["unauthorized", "invalid_api_key", "invalid api key", "authentication error", "model not found", "model_not_found"]):
        return True

    return False


def _is_retryable_exception(exc: BaseException) -> bool:
    """
    Returns True if an exception is transient / retryable (e.g. rate limit, 500, timeout).
    Returns False for permanent client errors (400, 401, 403, 404).
    """
    return not _is_permanent_client_error(exc)


def _parse_retry_after(exc: BaseException) -> float | None:
    """
    Extracts dynamic Retry-After header or delay hints from exception.
    Handles response headers, exception attributes, and error message regexes.
    """
    # 1. Check direct attribute
    retry_attr = getattr(exc, "retry_after", None)
    if retry_attr is not None:
        try:
            return float(retry_attr)
        except (ValueError, TypeError):
            pass

    # 2. Check HTTP response headers if attached
    response = getattr(exc, "response", None)
    if response is not None:
        headers = getattr(response, "headers", {})
        if headers and hasattr(headers, "get"):
            header_val = headers.get("retry-after") or headers.get("Retry-After") or headers.get("x-ratelimit-reset-requests")
            if header_val:
                try:
                    return float(header_val)
                except (ValueError, TypeError):
                    pass

    # 3. Parse error message string with regex patterns (e.g. "try again in 4.5s", "retry after 10s")
    msg = str(exc).lower()
    
    m = re.search(r"try again in (\d+(?:\.\d+)?)\s*(?:s|sec|seconds)?", msg)
    if m:
        try:
            return float(m.group(1))
        except ValueError:
            pass

    m = re.search(r"retry after (\d+(?:\.\d+)?)\s*(?:s|sec|seconds)?", msg)
    if m:
        try:
            return float(m.group(1))
        except ValueError:
            pass

    m = re.search(r"reset in (\d+(?:\.\d+)?)\s*(?:s|sec|seconds)?", msg)
    if m:
        try:
            return float(m.group(1))
        except ValueError:
            pass

    return None


class AdaptiveProviderLimiter:
    """
    Intelligent per-model / per-provider Adaptive Rate Limiter.
    - Tracks shared cooldown timestamps across concurrent tasks so parallel workers
      do not send doomed requests during provider cooldown windows.
    - Paces concurrent requests with per-model semaphores to eliminate instantaneous burst spikes.
    """
    def __init__(self, max_concurrency_per_model: int = 5):
        self._cooldowns: dict[str, float] = {}  # key -> monotonic expiry timestamp
        self._semaphores: dict[str, asyncio.Semaphore] = {}
        self._max_concurrency_per_model = max_concurrency_per_model

    def _get_key(self, model: str, api_base: str | None = None) -> str:
        provider = model.split("/")[0] if "/" in model else "default"
        base = api_base or ""
        return f"{provider}:{model}:{base}"

    def get_semaphore(self, model: str, api_base: str | None = None) -> asyncio.Semaphore:
        key = self._get_key(model, api_base)
        if key not in self._semaphores:
            self._semaphores[key] = asyncio.Semaphore(self._max_concurrency_per_model)
        return self._semaphores[key]

    async def wait_if_cooling_down(self, model: str, api_base: str | None = None) -> None:
        key = self._get_key(model, api_base)
        now = time.monotonic()
        cooldown_until = self._cooldowns.get(key, 0.0)
        if cooldown_until > now:
            wait_time = cooldown_until - now
            logger.info(f"AdaptiveLimiter: Provider '{model}' in cooldown. Pacing task for {wait_time:.2f}s.")
            await asyncio.sleep(wait_time)

    def record_rate_limit(self, model: str, api_base: str | None, retry_after: float | None = None) -> float:
        key = self._get_key(model, api_base)
        # Dynamic parsed retry-after or jittered exponential default (5-15s)
        delay = retry_after if (retry_after is not None and retry_after > 0) else random.uniform(5.0, 15.0)
        # Add slight safety jitter (200-500ms) to prevent thundering herd
        delay += random.uniform(0.2, 0.5)
        
        self._cooldowns[key] = time.monotonic() + delay
        logger.warning(f"AdaptiveLimiter: Rate limit encountered on '{model}'. Global cooldown imposed for {delay:.2f}s.")
        return delay


# Global rate limiter singleton shared across all task workers in process
limiter = AdaptiveProviderLimiter()


async def call_llm(
    messages: list[dict],
    model: str,
    api_key: str | None = None,
    api_base: str | None = None,
    temperature: float = 0.7,
    max_tokens: int = 4096,
    max_retries: int = 6,
    timeout: int = 60,
    response_format: dict | None = None,
) -> str:
    """
    Resilient LLM caller with adaptive rate-limit backoff, provider cooldown tracking,
    and structured retry handling.
    """
    sem = limiter.get_semaphore(model, api_base)
    attempt = 0
    last_error: Exception | None = None

    while attempt < max_retries:
        attempt += 1

        # 1. Pacing & Cooldown Check (holds back parallel tasks if provider is in 429 cooldown)
        await limiter.wait_if_cooling_down(model, api_base)

        async with sem:
            try:
                kwargs: dict[str, Any] = {
                    "model": model,
                    "messages": messages,
                    "api_key": api_key,
                    "api_base": api_base,
                    "temperature": temperature,
                    "max_tokens": max_tokens,
                    "num_retries": 0,
                    "timeout": timeout,
                }
                if response_format:
                    kwargs["response_format"] = response_format

                response = await acompletion(**kwargs)
                return response.choices[0].message.content

            except Exception as e:
                last_error = e
                err_msg = str(e).lower()
                is_rate_limit = (
                    isinstance(e, litellm.RateLimitError) or
                    "rate_limit" in err_msg or
                    "ratelimit" in err_msg or
                    "429" in err_msg or
                    "too many requests" in err_msg or
                    "quota exceeded" in err_msg
                )

                if is_rate_limit:
                    parsed_retry = _parse_retry_after(e)
                    cooldown = limiter.record_rate_limit(model, api_base, parsed_retry)
                    
                    if attempt >= max_retries:
                        logger.error(f"Rate limit retries exhausted ({attempt}/{max_retries}) on '{model}': {e}")
                        raise e

                    logger.warning(
                        f"Rate limited on '{model}' (attempt {attempt}/{max_retries}). "
                        f"Backing off for {cooldown:.2f}s..."
                    )
                    await asyncio.sleep(cooldown)
                    continue

                if _is_permanent_client_error(e):
                    # Fail fast on 400/401/403/404 — retrying these is wasteful
                    logger.error(f"Non-retryable client error on '{model}': {type(e).__name__}: {e}")
                    raise e

                # Transient errors (5xx server errors, connection timeouts, disconnects)
                if attempt >= max_retries:
                    logger.error(f"Transient error retries exhausted ({attempt}/{max_retries}) on '{model}': {e}")
                    raise e

                # Jittered exponential backoff for transient network/server hiccups
                backoff = random.uniform(1.2, 1.8) * min(20.0, (1.8 ** attempt))
                logger.warning(
                    f"Transient failure on '{model}' ({type(e).__name__}: {e}). "
                    f"Retrying in {backoff:.2f}s (attempt {attempt}/{max_retries})..."
                )
                await asyncio.sleep(backoff)

    if last_error:
        raise last_error
    raise RuntimeError(f"call_llm failed for model '{model}' without a response.")
