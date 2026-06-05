import requests
from typing import Any
import typer
from rich.console import Console
from . import config

console = Console()

class VaelerieClient:
    def __init__(self):
        cfg = config.load()
        self.base_url = cfg.get("backend_url", "").rstrip("/")
        self.api_key = cfg.get("api_key", "")
        if not self.base_url:
            console.print("[red]No backend URL configured.[/] Run: valerie init")
            raise typer.Exit(1)

    @property
    def headers(self) -> dict:
        return {"X-API-Key": self.api_key}

    def _handle_response(self, response: requests.Response) -> requests.Response:
        try:
            response.raise_for_status()
        except requests.exceptions.HTTPError as e:
            try:
                error_detail = response.json().get("detail", str(e))
            except Exception:
                error_detail = response.text or str(e)
            console.print(f"[red]API Error ({response.status_code}):[/] {error_detail}")
            raise typer.Exit(1)
        return response

    def get(self, path: str, **kwargs) -> requests.Response:
        r = requests.get(f"{self.base_url}{path}", headers=self.headers, timeout=30, **kwargs)
        return self._handle_response(r)

    def post(self, path: str, json: Any = None, **kwargs) -> requests.Response:
        r = requests.post(f"{self.base_url}{path}", json=json, headers=self.headers, timeout=60, **kwargs)
        return self._handle_response(r)

    def ping(self) -> bool:
        try:
            r = requests.get(f"{self.base_url}/health", timeout=10)
            return r.status_code in (200, 404)  # 404 means server is up, just no /health yet
        except Exception:
            return False
