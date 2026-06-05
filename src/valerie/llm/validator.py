import time
from pydantic import BaseModel
from valerie.llm.router import call_llm

class ValidationResult(BaseModel):
    is_valid: bool
    latency_ms: int | None = None
    response_preview: str | None = None
    error: str | None = None

async def validate_endpoint(
    model: str,
    api_key: str | None,
    api_base: str | None = None,
    timeout: int = 15,
) -> ValidationResult:
    try:
        t0 = time.monotonic()
        response = await call_llm(
            messages=[{"role": "user", "content": "Reply with only the word PONG."}],
            model=model, 
            api_key=api_key, 
            api_base=api_base,
            temperature=0, 
            max_tokens=10, 
            timeout=timeout,
        )
        latency = int((time.monotonic() - t0) * 1000)
        return ValidationResult(is_valid=True, latency_ms=latency, response_preview=response[:200])
    except Exception as e:
        return ValidationResult(is_valid=False, error=str(e))
