import requests
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

    def get(self, path: str, **kwargs) -> requests.Response:
        return requests.get(f"{self.base_url}{path}", headers=self.headers, timeout=30, **kwargs)

    def post(self, path: str, json: Any = None, **kwargs) -> requests.Response:
        return requests.post(f"{self.base_url}{path}", json=json, headers=self.headers, timeout=60, **kwargs)

    def ping(self) -> bool:
        try:
            r = requests.get(f"{self.base_url}/health", timeout=10)
            return r.status_code in (200, 404)  # 404 means server is up, just no /health yet
        except Exception:
            return False
