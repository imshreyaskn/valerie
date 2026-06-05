import typer
import json
from pathlib import Path
from typing import Optional
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich import box
from ..client import VaelerieClient

console = Console()
app = typer.Typer(help="List and inspect past runs", no_args_is_help=True)

@app.command("list")
def list_runs(limit: int = typer.Option(20, "--limit", "-n", help="Number of runs to show")):
    """List past pipeline runs."""
    client = VaelerieClient()
    r = client.get(f"/runs/?limit={limit}")
    runs = r.json().get("runs", [])

    if not runs:
        console.print("No runs found.")
        return

    table = Table(title="Pipeline Runs", box=box.ROUNDED)
    table.add_column("Run ID", max_width=12)
    table.add_column("Domain")
    table.add_column("Status")
    table.add_column("Tasks", justify="right")
    table.add_column("Breakthroughs", justify="right")
    table.add_column("Avg Score", justify="right")
    table.add_column("Created")

    for run in runs:
        status = run.get("status", "")
        status_fmt = status

        table.add_row(
            run.get("id", "")[:8] + "...",
            run.get("domain", ""),
            status_fmt,
            str(run.get("total_tasks", 0)),
            str(run.get("successful_attacks", 0)),
            f"{run.get('avg_risk_score', 0):.2f}",
            (run.get("created_at", "") or "")[:16],
        )

    console.print(table)

@app.command("status")
def status(
    run_id: str = typer.Argument(help="Run ID"),
):
    """Show current status of a run."""
    client = VaelerieClient()
    r = client.get(f"/runs/{run_id}")
    if r.status_code == 404:
        console.print(f"Run not found: {run_id}")
        raise typer.Exit(1)
    run = r.json()
    console.print(f"Status:      {run.get('status')}")
    console.print(f"Domain:      {run.get('domain')}")
    console.print(f"Total tasks: {run.get('total_tasks', 0)}")
    console.print(f"Breakthroughs: {run.get('successful_attacks', 0)}")
    console.print(f"Avg score:   {run.get('avg_risk_score', 0.0):.2f}")
    if run.get("error_message"):
        console.print(f"Error: {run['error_message']}")

@app.command("results")
def results(
    run_id: str = typer.Argument(help="Run ID"),
    export: Optional[Path] = typer.Option(None, "--export", "-e", help="Export results to JSON file"),
    show_prompts: bool = typer.Option(False, "--show-prompts", help="Print adversarial prompts"),
    min_score: float = typer.Option(0.0, "--min-score", help="Filter results by minimum risk score"),
):
    """Show detailed results for a completed run."""
    client = VaelerieClient()
    r = client.get(f"/runs/{run_id}/results")
    if r.status_code == 404:
        console.print(f"Run not found: {run_id}")
        raise typer.Exit(1)

    results_data = r.json().get("results", [])
    filtered = [x for x in results_data if x.get("overall_risk_score", 0) >= min_score]
    filtered_sorted = sorted(filtered, key=lambda x: x.get("overall_risk_score", 0), reverse=True)

    if export:
        export.write_text(json.dumps(filtered_sorted, indent=2))
        console.print(f"Exported {len(filtered_sorted)} results to {export}")
        return

    table = Table(title=f"Results: {run_id[:8]}...", box=box.ROUNDED)
    table.add_column("Score", justify="right")
    table.add_column("Harm Type")
    table.add_column("Technique")
    table.add_column("Breakthrough")
    table.add_column("Iters", justify="center")
    table.add_column("PII", justify="center")
    table.add_column("Toxic", justify="center")

    for res in filtered_sorted:
        score = res.get("overall_risk_score", 0)
        score_str = f"{score:.2f}"
        table.add_row(
            score_str,
            res.get("harm_type", ""),
            res.get("technique_id", ""),
            "Y" if res.get("is_breakthrough") else "N",
            str(res.get("iterations_used", 1)),
            "Y" if res.get("pii_leakage") else "N",
            "Y" if res.get("toxicity") else "N",
        )

    console.print(table)

    if show_prompts:
        for res in filtered_sorted[:3]:
            console.print()
            console.print(Panel(
                f"Adversarial Prompt:\n{res.get('adversarial_prompt', '')}\n\n"
                f"Target Response:\n{res.get('target_response', '')}\n\n"
                f"Safety Concern:\n{res.get('safety_concern', '')}",
                title=f"{res.get('harm_type')} / {res.get('technique_id')} — Score: {res.get('overall_risk_score', 0):.2f}",
            ))
