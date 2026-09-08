import os
import typer
from typing import Optional
from rich.console import Console
from ..client import ValerieClient

console = Console()

def app(
    model: str = typer.Option(..., "--model", "-m", help="LiteLLM model string, e.g. mistral/mistral-small-latest"),
    key: Optional[str] = typer.Option(None, "--key", "-k", help="API key for the model provider (defaults to env var)"),
    base: Optional[str] = typer.Option(None, "--base", help="Custom API base URL (for self-hosted models)"),
):
    """Test if a target LLM endpoint is reachable and returns a response."""
    # Environment variable resolution for API key (C-04)
    resolved_key = (
        key
        or os.getenv("MISTRAL_API_KEY")
        or os.getenv("OPENAI_API_KEY")
        or os.getenv("ANTHROPIC_API_KEY")
        or os.getenv("VALERIE_TARGET_KEY")
        or ""
    )
    if not resolved_key:
        console.print("[red]Target API key is required.[/] Pass --key or set MISTRAL_API_KEY environment variable.")
        raise typer.Exit(1)

    console.print(f"Validating endpoint {model}...")

    client = ValerieClient()
    payload = {"model": model, "api_key": resolved_key}
    if base:
        payload["api_base"] = base

    r = client.post("/validate/endpoint", json=payload)
    data = r.json()

    if data.get("is_valid"):
        console.print("Endpoint accessible")
        console.print(f"  Model: {model}")
        sample = data.get("response_preview", "")
        if sample:
            console.print(f"  Sample: {sample[:120]}...")
    else:
        console.print("Validation failed")
        console.print(f"  Error: {data.get('error', 'Unknown error')}")
        raise typer.Exit(1)

