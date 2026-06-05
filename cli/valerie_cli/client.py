import requests
from typing import Any, Optional
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
            
        from requests.adapters import HTTPAdapter
        from urllib3.util.retry import Retry
        
        self.session = requests.Session()
        self.session.headers.update({"X-API-Key": self.api_key})
        
        retries = Retry(
            total=5,
            backoff_factor=1,
            status_forcelist=[502, 503, 504],
            allowed_methods=["GET", "POST"]
        )
        self.session.mount("https://", HTTPAdapter(max_retries=retries))
        self.session.mount("http://", HTTPAdapter(max_retries=retries))

    def _handle_response(self, response: requests.Response) -> requests.Response:
        try:
            response.raise_for_status()
        except requests.exceptions.HTTPError as e:
            try:
                error_detail = response.json().get("detail", str(e))
            except Exception:
                error_detail = response.text or str(e)
            console.print(f"\n[red]API Error ({response.status_code}):[/] {error_detail}")
            raise typer.Exit(1)
        return response

    def get(self, path: str, suppress_errors: bool = False, **kwargs) -> Optional[requests.Response]:
        try:
            r = self.session.get(f"{self.base_url}{path}", timeout=30, **kwargs)
            return self._handle_response(r)
        except requests.exceptions.RequestException as e:
            if suppress_errors:
                return None
            console.print(f"\n[red]Network Error:[/] {e}")
            raise typer.Exit(1)

    def post(self, path: str, json: Any = None, **kwargs) -> requests.Response:
        try:
            r = self.session.post(f"{self.base_url}{path}", json=json, timeout=60, **kwargs)
            return self._handle_response(r)
        except requests.exceptions.RequestException as e:
            console.print(f"\n[red]Network Error:[/] {e}")
            raise typer.Exit(1)

    def ping(self) -> bool:
        try:
            r = requests.get(f"{self.base_url}/health", timeout=10)
            return r.status_code in (200, 404)  # 404 means server is up, just no /health yet
        except Exception:
            return False
