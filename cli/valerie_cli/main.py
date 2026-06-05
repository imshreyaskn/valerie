import typer
from rich.console import Console
from . import __version__

app = typer.Typer(
    name="valerie",
    help="[bold magenta]Valerie[/] — BYOK LLM Red-Teaming CLI",
    rich_markup_mode="rich",
    no_args_is_help=True,
)
console = Console()

# ── Import and register sub-command groups ──
from .commands.init import app as init_app
from .commands.config_cmd import app as config_app
from .commands.validate import app as validate_app
from .commands.run import app as run_app
from .commands.results import app as results_app

app.add_typer(config_app,   name="config",   help="Manage CLI configuration")
app.add_typer(results_app,  name="runs",     help="List and inspect past runs")

app.command("init")(init_app)
app.command("validate")(validate_app)
app.command("run")(run_app)

@app.callback(invoke_without_command=True)
def version_callback(version: bool = typer.Option(False, "--version", "-v", help="Show version")):
    if version:
        console.print(f"valerie-cli [bold]{__version__}[/]")
        raise typer.Exit()

if __name__ == "__main__":
    app()
