import json
import os
from pathlib import Path
from typing import Any

CONFIG_DIR = Path.home() / ".valerie"
CONFIG_FILE = CONFIG_DIR / "config.json"

DEFAULTS = {
    "backend_url": "",
    "api_key": "",
    "defaults": {
        "attacker_model": "mistral/mistral-large-latest",
        "judge_model": "mistral/mistral-large-latest",
        "target_model": "mistral/mistral-small-latest",
        "max_iterations": 3,
        "risk_threshold": 0.7,
        "max_concurrency": 5,
    }
}

def load() -> dict:
    data = dict(DEFAULTS)
    if CONFIG_FILE.exists():
        try:
            with open(CONFIG_FILE) as f:
                file_data = json.load(f)
                data.update(file_data)
        except Exception:
            pass

    # Environment variable overrides take precedence (C-03)
    if os.getenv("VALERIE_BACKEND_URL"):
        data["backend_url"] = os.getenv("VALERIE_BACKEND_URL", "").rstrip("/")
    if os.getenv("VALERIE_API_KEY"):
        data["api_key"] = os.getenv("VALERIE_API_KEY", "")

    return data

def save(config: dict) -> None:
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    try:
        os.chmod(CONFIG_DIR, 0o700)
    except Exception:
        pass
    with open(CONFIG_FILE, "w") as f:
        json.dump(config, f, indent=2)
    try:
        os.chmod(CONFIG_FILE, 0o600)  # restrict file permissions
    except Exception:
        pass

def get(key: str, default: Any = None) -> Any:
    cfg = load()
    return cfg.get(key, default)

def set_value(key: str, value: Any) -> None:
    cfg = load()
    cfg[key] = value
    save(cfg)

