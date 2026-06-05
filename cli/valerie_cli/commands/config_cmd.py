import typer
from rich.console import Console
from rich.table import Table
from .. import config

console = Console()
app = typer.Typer(help="Manage CLI configuration", no_args_is_help=True)

@app.command("show")
def show():
    """Print current configuration."""
    cfg = config.load()
    table = Table(title="Valerie CLI Config", show_header=True, header_style="bold magenta")
    table.add_column("Key", style="cyan")
    table.add_column("Value")
    table.add_row("backend_url", cfg.get("backend_url", "[red]not set[/]"))
    table.add_row("api_key", "***" if cfg.get("api_key") else "[red]not set[/]")
    defaults = cfg.get("defaults", {})
    for k, v in defaults.items():
        table.add_row(f"defaults.{k}", str(v))
    console.print(table)

@app.command("set")
def set_cmd(
    key: str = typer.Argument(help="Config key (e.g. defaults.max_iterations)"),
    value: str = typer.Argument(help="Value to set"),
):
    """Set a configuration value."""
    cfg = config.load()
    if key.startswith("defaults."):
        sub = key.split(".", 1)[1]
        defaults = cfg.get("defaults", {})
        # auto-cast numbers
        try:
            defaults[sub] = float(value) if "." in value else int(value)
        except ValueError:
            defaults[sub] = value
        cfg["defaults"] = defaults
    else:
        cfg[key] = value
    config.save(cfg)
    console.print(f"[green]✓[/] Set [cyan]{key}[/] = [bold]{value}[/]")
