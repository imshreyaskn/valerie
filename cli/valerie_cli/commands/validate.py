import typer
from rich.console import Console
from ..client import VaelerieClient

console = Console()

def app(
    model: str = typer.Option(..., "--model", "-m", help="LiteLLM model string, e.g. mistral/mistral-small-latest"),
    key: str   = typer.Option(..., "--key", "-k", help="API key for the model provider"),
    base: str  = typer.Option(None, "--base", help="Custom API base URL (for self-hosted models)"),
):
    """Test if a target LLM endpoint is reachable and returns a response."""
    console.print(f"Validating endpoint {model}...")

    client = VaelerieClient()
    payload = {"model": model, "api_key": key}
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
