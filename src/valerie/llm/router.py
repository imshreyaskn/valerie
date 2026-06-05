import litellm
from litellm import acompletion

litellm.drop_params = True   # ignore unsupported params silently

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
    response = await acompletion(
        model=model,
        messages=messages,
        api_key=api_key,
        api_base=api_base,
        temperature=temperature,
        max_tokens=max_tokens,
        num_retries=max_retries,
        timeout=timeout,
    )
    return response.choices[0].message.content
