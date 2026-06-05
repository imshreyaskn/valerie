import typer
import httpx
from rich.console import Console
from rich.prompt import Prompt, Confirm
from .. import config

console = Console()

def app():
    """Interactive setup wizard — configure backend URL and API key."""
    console.print()
    console.print("[bold magenta]✨ Valerie CLI Setup Wizard[/]", justify="center")
    console.print()

    current = config.load()

    backend_url = Prompt.ask(
        "[bold]Backend URL[/] (e.g. https://valerie-api-xxxx-uc.a.run.app)",
        default=current.get("backend_url") or ""
    ).rstrip("/")

    api_key = Prompt.ask(
        "[bold]API Key[/]",
        default=current.get("api_key") or "",
        password=True
    )

    console.print()
    console.print("[dim]Verifying connection...[/]", end=" ")

    try:
        r = httpx.get(f"{backend_url}/domains/", headers={"X-API-Key": api_key}, timeout=10)
        if r.status_code == 200:
            domains = [d["id"] for d in r.json().get("domains", [])]
            console.print("[bold green]✓ Connected[/]")
            console.print(f"  Available domains: [cyan]{', '.join(domains)}[/]")
        elif r.status_code == 403:
            console.print("[bold red]✗ Invalid API key[/]")
            raise typer.Exit(1)
        else:
            console.print(f"[yellow]? Server responded {r.status_code}[/]")
    except httpx.ConnectError:
        console.print("[bold red]✗ Cannot reach backend[/]")
        raise typer.Exit(1)

    cfg = config.load()
    cfg["backend_url"] = backend_url
    cfg["api_key"] = api_key
    config.save(cfg)

    console.print()
    console.print(f"[bold green]✓ Config saved[/] to [dim]~/.valerie/config.json[/]")
    console.print()
    console.print("Next steps:")
    console.print("  [cyan]valerie validate[/] [dim]--model mistral/mistral-small-latest --key $MISTRAL_KEY[/]")
    console.print("  [cyan]valerie run[/] [dim]--domain bfsi --target-model mistral/mistral-small-latest --target-key $MISTRAL_KEY[/]")
