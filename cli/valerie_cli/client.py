import httpx
from typing import Any
from . import config

class VaelerieClient:
    def __init__(self):
        cfg = config.load()
        self.base_url = cfg.get("backend_url", "").rstrip("/")
        self.api_key = cfg.get("api_key", "")
        if not self.base_url:
            raise RuntimeError("No backend URL configured. Run: valerie init")

    @property
    def headers(self) -> dict:
        return {"X-API-Key": self.api_key}

    def get(self, path: str, **kwargs) -> httpx.Response:
        with httpx.Client(timeout=30) as client:
            return client.get(f"{self.base_url}{path}", headers=self.headers, **kwargs)

    def post(self, path: str, json: Any = None, **kwargs) -> httpx.Response:
        with httpx.Client(timeout=60) as client:
            return client.post(f"{self.base_url}{path}", json=json, headers=self.headers, **kwargs)

    def ping(self) -> bool:
        try:
            r = httpx.get(f"{self.base_url}/health", timeout=10)
            return r.status_code in (200, 404)  # 404 means server is up, just no /health yet
        except Exception:
            return False
