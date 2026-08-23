"""
seed_campaigns.py — populate MongoDB with dummy campaign data for UI development.
Run: python seed_campaigns.py
Requires pymongo: pip install pymongo (or already in requirements.txt via motor)
"""

import asyncio
import random
from datetime import datetime, timezone, timedelta
from uuid import uuid4

import motor.motor_asyncio

# ── Connection ────────────────────────────────────────────────────────────────
import os
MONGO_URI = os.getenv(
    "MONGO_URI",
    "mongodb://valerie:localdev@localhost:27017/valerie_db?authSource=admin",
)
DB_NAME   = os.getenv("MONGO_DB", "valerie_db")

# ── Seed identity ─────────────────────────────────────────────────────────────
SEED_USER_ID = "admin_master"

TECHNIQUES = [
    "indirect_prompting", "obfuscation", "role_play", "temporal_framing",
    "semantic_polysemy", "hybrid_framing", "futuristic_projection",
    "metaphorical_framing", "historical_analogy", "esoteric_jargon",
    "emotional_manipulation", "utilitarian_pretext",
]

DOMAINS = ["healthcare", "bfsi", "pharmacy", "legal", "hr", "ecommerce", "general"]

ATTACKER_MODELS = [
    "mistral/mistral-large-latest",
    "openai/gpt-4o",
    "openrouter/google/gemini-2.0-flash-001",
    "mistral/mistral-small-latest",
]

ENDPOINTS = [
    {"name": "GPT-4o Production Agent",     "provider": "openai_compat"},
    {"name": "Mistral Large (BFSI Eval)",   "provider": "openai_compat"},
    {"name": "Gemini 2.0 Flash Sandbox",    "provider": "openai_compat"},
    {"name": "Claude 3.5 Sonnet Eval",      "provider": "anthropic"},
    {"name": "Internal LLaMA-3 Gateway",    "provider": "custom"},
]

def utc_ago(days: int = 0, hours: int = 0) -> datetime:
    return datetime.now(timezone.utc) - timedelta(days=days, hours=hours)

def make_endpoint(name: str, provider: str) -> dict:
    return {
        "id":         str(uuid4()),
        "user_id":    SEED_USER_ID,
        "name":       name,
        "provider":   provider,
        "base_url":   None,
        "api_key":    None,
        "created_at": utc_ago(days=random.randint(1, 30)),
    }

def make_run(endpoint_id: str, endpoint_name: str, daysago: int) -> dict:
    domain        = random.choice(DOMAINS)
    total         = random.randint(5, 30)
    breaches      = random.randint(0, total)
    defended      = total - breaches
    avg_risk      = round(random.uniform(0.0, 0.95), 2)
    status        = random.choice(["completed", "completed", "completed", "failed", "running"])
    techniques    = random.sample(TECHNIQUES, k=random.randint(2, 6))
    attacker      = random.choice(ATTACKER_MODELS)
    judge         = random.choice(ATTACKER_MODELS)
    created       = utc_ago(days=daysago, hours=random.randint(0, 23))
    completed     = created + timedelta(minutes=random.randint(4, 45)) if status != "running" else None

    return {
        "id":                  str(uuid4()),
        "user_id":             SEED_USER_ID,
        "endpoint_id":         endpoint_id,
        "target_model":        endpoint_name,
        "status":              status,
        "domain":              domain,
        "harm_types":          [f"{domain}_harm"],
        "selected_techniques": techniques,
        "attacker_model":      attacker,
        "judge_model":         judge,
        "total_tasks":         total,
        "successful_attacks":  breaches,
        "avg_risk_score":      avg_risk,
        "created_at":          created,
        "completed_at":        completed,
        "error_message":       "Worker timeout" if status == "failed" else None,
    }

async def seed() -> None:
    client = motor.motor_asyncio.AsyncIOMotorClient(MONGO_URI)
    db = client[DB_NAME]

    # ── Endpoints ──────────────────────────────────────────────────────────────
    endpoint_docs = [make_endpoint(e["name"], e["provider"]) for e in ENDPOINTS]
    await db.endpoints.insert_many(endpoint_docs)
    print(f"[+] Inserted {len(endpoint_docs)} endpoints")

    # ── Campaigns ──────────────────────────────────────────────────────────────
    runs: list[dict] = []
    for i in range(20):
        ep = random.choice(endpoint_docs)
        runs.append(make_run(ep["id"], ep["name"], daysago=i))

    await db.pipeline_runs.insert_many(runs)
    print(f"[+] Inserted {len(runs)} campaign runs")

    status_counts = {}
    for r in runs:
        status_counts[r["status"]] = status_counts.get(r["status"], 0) + 1
    print(f"    Status breakdown: {status_counts}")

    client.close()
    print("[✓] Seed complete — reload the Campaigns page.")

if __name__ == "__main__":
    asyncio.run(seed())
