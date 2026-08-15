from pydantic import BaseModel, Field
from datetime import datetime, UTC
from uuid import uuid4
from typing import Any

class Technique(BaseModel):
    id: str
    name: str
    family: str
    description: str = ""
    genome_signature: list[float] = []
    # Computed (materialized from events):
    efficacy: dict[str, float] = {}  # endpoint_id -> breakthrough_rate
    total_uses: int = 0
    total_breakthroughs: int = 0

class PromptEntity(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    text: str
    embedding: list[float] | None = None
    technique_id: str
    seed_prompt_id: str | None = None
    parent_prompt_id: str | None = None
    iteration: int
    mutation_strategy: str | None = None
    genome: list[float] = []
    run_id: str
    task_id: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))

class Evidence(BaseModel):
    type: str # "pii_leakage", "toxicity", "bias", "safety_bypass", etc.
    description: str
    tokens: str | None = None
    token_positions: tuple[int, int] | None = None
    confidence: float = 1.0

class Finding(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    prompt_id: str
    endpoint_id: str
    technique_id: str
    run_id: str
    task_id: str
    severity: str # critical, high, medium, low, info
    verdict: dict[str, Any]
    evidence: list[Evidence] = []
    weakness_id: str | None = None
    is_breakthrough: bool
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))

class Weakness(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    name: str
    description: str
    category: str
    cwe_id: str | None = None
    affected_endpoint_ids: list[str] = []
    finding_ids: list[str] = []
    defense_ids: list[str] = []
    # Computed:
    severity_aggregate: float = 0.0
    first_seen: datetime = Field(default_factory=lambda: datetime.now(UTC))
    last_seen: datetime = Field(default_factory=lambda: datetime.now(UTC))
    trend: str = "stable"

class Defense(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    weakness_id: str
    strategy: str
    description: str
    effectiveness: float | None = None
    verified: bool = False
    source: str = "ai_suggested"
