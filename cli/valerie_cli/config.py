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
    if not CONFIG_FILE.exists():
        return dict(DEFAULTS)
    with open(CONFIG_FILE) as f:
        data = json.load(f)
    # merge with defaults for any missing keys
    merged = dict(DEFAULTS)
    merged.update(data)
    return merged

def save(config: dict) -> None:
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    with open(CONFIG_FILE, "w") as f:
        json.dump(config, f, indent=2)
    os.chmod(CONFIG_FILE, 0o600)  # restrict permissions

def get(key: str, default: Any = None) -> Any:
    cfg = load()
    return cfg.get(key, default)

def set_value(key: str, value: Any) -> None:
    cfg = load()
    cfg[key] = value
    save(cfg)
