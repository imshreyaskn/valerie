import typer
import requests
from rich.console import Console
from rich.prompt import Prompt, Confirm
from .. import config

console = Console()

def app():
    """Interactive setup wizard - configure backend URL and API key."""
    console.print()
    console.print("Valerie CLI Setup Wizard", justify="center")
    console.print()

    current = config.load()

    backend_url = Prompt.ask(
        "Backend URL (e.g. https://valerie-api-xxxx-uc.a.run.app)",
        default=current.get("backend_url") or ""
    ).rstrip("/")

    api_key = Prompt.ask(
        "API Key",
        default=current.get("api_key") or "",
        password=True
    )

    console.print()
    console.print("Verifying connection...", end=" ")

    try:
        r = requests.get(f"{backend_url}/domains/", headers={"X-API-Key": api_key}, timeout=30)
        if r.status_code == 200:
            domains = [d["id"] for d in r.json().get("domains", [])]
            console.print("Connected")
            console.print(f"  Available domains: {', '.join(domains)}")
        elif r.status_code == 403:
            console.print("Invalid API key")
            raise typer.Exit(1)
        else:
            console.print(f"Server responded {r.status_code}")
    except requests.exceptions.RequestException as e:
        console.print(f"[red]Cannot reach backend (or it timed out).[/] Ensure the URL is correct and the server is running.")
        raise typer.Exit(1)

    cfg = config.load()
    cfg["backend_url"] = backend_url
    cfg["api_key"] = api_key
    config.save(cfg)

    console.print()
    console.print("Config saved to ~/.valerie/config.json")
    console.print()
    console.print("Next steps:")
    console.print("  valerie validate --model mistral/mistral-small-latest --key $MISTRAL_KEY")
    console.print("  valerie run --domain bfsi --target-model mistral/mistral-small-latest --target-key $MISTRAL_KEY")
