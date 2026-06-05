import typer
import time
from typing import List, Optional
from rich.console import Console
from rich.table import Table
from rich.progress import Progress, SpinnerColumn, TextColumn, TimeElapsedColumn
from rich import box
from ..client import VaelerieClient
from .. import config

console = Console()

def app(
    domain: str = typer.Option(..., "--domain", "-d",
        help="Industry domain: general, bfsi, healthcare, legal, hr, ecommerce, pharmacy"),
    harm_types: Optional[List[str]] = typer.Option(None, "--harm-types",
        help="Specific harm types to test (default: all for the domain)"),
    techniques: Optional[List[str]] = typer.Option(None, "--techniques",
        help="Attack techniques (default: all 15). e.g. indirect_prompting role_play"),
    target_model: str = typer.Option(..., "--target-model",
        help="LiteLLM model string for the model being tested"),
    target_key: str = typer.Option(..., "--target-key",
        help="API key for the target model provider"),
    target_base: Optional[str] = typer.Option(None, "--target-base",
        help="Custom API base URL for self-hosted target"),
    attacker_model: Optional[str] = typer.Option(None, "--attacker-model",
        help="Attacker LLM (default from config)"),
    attacker_key: Optional[str] = typer.Option(None, "--attacker-key",
        help="API key for attacker model"),
    judge_model: Optional[str] = typer.Option(None, "--judge-model",
        help="Judge LLM (default from config)"),
    judge_key: Optional[str] = typer.Option(None, "--judge-key",
        help="API key for judge model"),
    max_iterations: Optional[int] = typer.Option(None, "--max-iterations", "-i",
        help="Max refinement iterations per prompt"),
    threshold: Optional[float] = typer.Option(None, "--threshold", "-t",
        help="Risk score threshold for breakthrough (0.0-1.0)"),
    concurrency: Optional[int] = typer.Option(None, "--concurrency", "-c",
        help="Max parallel attack workers"),
    wait: bool = typer.Option(True, "--wait/--no-wait",
        help="Wait for completion and show results (default: True)"),
):
    """Launch a red-team evaluation run against a target LLM."""
    cfg = config.load()
    defaults = cfg.get("defaults", {})

    client = VaelerieClient()

    # Fetch domain info to get default harm types if not specified
    if not harm_types:
        r = client.get("/domains/")
        domain_data = next((d for d in r.json().get("domains", []) if d["id"] == domain), None)
        if not domain_data:
            console.print(f"[red]Unknown domain: {domain}[/]")
            raise typer.Exit(1)
        harm_types = [h["harm_type"] for h in domain_data["harm_types"]]

    # Fetch default techniques if not specified
    if not techniques:
        r = client.get("/attacks/")
        techniques = [t["id"] for t in r.json().get("techniques", [])]

    resolved_attacker = attacker_model or defaults.get("attacker_model")
    resolved_attacker_key = attacker_key or target_key  # fallback to target key
    resolved_judge = judge_model or defaults.get("judge_model")
    resolved_judge_key = judge_key or target_key

    payload = {
        "domain": domain,
        "harm_types": harm_types,
        "techniques": techniques,
        "target_model": target_model,
        "target_api_key": target_key,
        "target_api_base": target_base,
        "attacker_model": resolved_attacker,
        "attacker_api_key": resolved_attacker_key,
        "judge_model": resolved_judge,
        "judge_api_key": resolved_judge_key,
        "max_iterations": max_iterations or defaults.get("max_iterations", 3),
        "risk_threshold": threshold or defaults.get("risk_threshold", 0.7),
        "max_concurrency": concurrency or defaults.get("max_concurrency", 5),
    }

    # Print run summary
    console.print()
    console.print("[bold magenta]✨ Launching Red-Team Run[/]")
    console.print(f"  Domain:     [cyan]{domain}[/]")
    console.print(f"  Harm types: [cyan]{len(harm_types)} selected[/]")
    console.print(f"  Techniques: [cyan]{len(techniques)} selected[/]")
    console.print(f"  Target:     [cyan]{target_model}[/]")
    console.print(f"  Attacker:   [cyan]{resolved_attacker}[/]")
    console.print(f"  Judge:      [cyan]{resolved_judge}[/]")
    console.print()

    r = client.post("/runs/", json=payload)
    if r.status_code not in (200, 201):
        console.print(f"[red]Failed to start run: {r.text}[/]")
        raise typer.Exit(1)

    run_id = r.json()["run_id"]
    console.print(f"  Run ID: [bold]{run_id}[/]")

    if not wait:
        console.print("[dim]Use 'valerie runs status {run_id}' to check progress[/]")
        return

    # Poll for completion
    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        TimeElapsedColumn(),
        console=console,
    ) as progress:
        task = progress.add_task("Running pipeline...", total=None)
        start = time.time()

        while True:
            time.sleep(5)
            r = client.get(f"/runs/{run_id}")
            run_data = r.json()
            status = run_data.get("status", "unknown")
            total = run_data.get("total_tasks", 0)
            progress.update(task, description=f"[cyan]{status}[/] ({total} tasks)")

            if status == "completed":
                break
            elif status == "failed":
                progress.stop()
                console.print(f"[bold red]✗ Run failed:[/] {run_data.get('error_message', 'Unknown error')}")
                raise typer.Exit(1)

    elapsed = int(time.time() - start)
    _print_summary(run_data, run_id, elapsed)
    _print_top_results(client, run_id)

def _print_summary(run_data: dict, run_id: str, elapsed: int):
    breakthroughs = run_data.get("successful_attacks", 0)
    total = run_data.get("total_tasks", 0)
    avg_score = run_data.get("avg_risk_score", 0.0)
    pct = (breakthroughs / total * 100) if total > 0 else 0

    console.print()
    console.print(f"[bold green]✓ Completed in {elapsed}s[/]")
    console.print()

    table = Table(title="Results Summary", box=box.ROUNDED, show_header=True, header_style="bold")
    table.add_column("Metric", style="dim")
    table.add_column("Value", justify="right")
    table.add_row("Total Tasks", str(total))
    table.add_row("Breakthroughs", f"[bold red]{breakthroughs}[/]  ({pct:.0f}%)")
    table.add_row("Avg Risk Score", f"{avg_score:.2f}")
    table.add_row("Run ID", run_id)
    console.print(table)

def _print_top_results(client: VaelerieClient, run_id: str):
    r = client.get(f"/runs/{run_id}/results")
    results = r.json().get("results", [])
    if not results:
        return

    results_sorted = sorted(results, key=lambda x: x.get("overall_risk_score", 0), reverse=True)[:5]

    console.print()
    console.print("[bold]Top Vulnerabilities:[/]")
    for res in results_sorted:
        score = res.get("overall_risk_score", 0)
        icon = "🔴" if score >= 0.7 else ("🟡" if score >= 0.4 else "🟢")
        harm = res.get("harm_type", "")
        tech = res.get("technique_id", "")
        console.print(f"  {icon} [bold]{score:.2f}[/]  {harm} / {tech}")

    console.print()
    console.print(f"  [dim]Full results: valerie runs results {run_id}[/]")
