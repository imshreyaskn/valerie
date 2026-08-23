"""
Shared pytest bootstrap.

- Puts ./src on sys.path so `import valerie` works regardless of how pytest
  is invoked (no PYTHONPATH juggling).
- Provides hermetic placeholder secrets when none are configured, so the
  fail-fast settings validation never blocks unit tests.
"""

import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "src")
if SRC not in sys.path:
    sys.path.insert(0, SRC)

_PLACEHOLDERS = {
    "VALERIE_MASTER_KEY": "unittest-master-key-0123456789abcdef0123456789abcdef",
    "JWT_SECRET_KEY": "unittest-jwt-key-0123456789abcdef0123456789abcdef01234567",
    "WORKER_SECRET": "unittest-worker-secret-0123456789abcdef0123456789abcdef",
}

for name, value in _PLACEHOLDERS.items():
    if not os.getenv(name):
        os.environ[name] = value

# Never let a local .env enable the SSRF dev bypass during tests.
os.environ.setdefault("ALLOW_LOCAL_LLM_TARGETS", "false")

# Hermetic datastores: a developer's .env often points at docker-compose
# hostnames (mongodb://mongodb..., redis://redis...) that resolve slowly or
# not at all outside compose. Real environment variables take precedence over
# the .env file, so pinning these keeps unit tests fast and offline-safe.
os.environ.setdefault("MONGO_URI", "mongodb://localhost:27017/valerie_test_db")
os.environ.setdefault("REDIS_URI", "redis://localhost:6379/0")
