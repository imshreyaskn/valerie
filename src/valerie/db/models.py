from pydantic import BaseModel, Field
from datetime import datetime, timezone
from uuid import uuid4
import typing

def utc_now() -> datetime:
    return datetime.now(timezone.utc)

class User(BaseModel):
    uid: str
    email: str
    display_name: str | None = None
    photo_url: str | None = None
    created_at: datetime = Field(default_factory=utc_now)
    is_deleted: bool = False

class Endpoint(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    user_id: str
    name: str
    provider: str # openai_compat, anthropic, gemini, custom
    base_url: str | None = None
    api_key: str | None = None
    custom_payload_template: dict | str | None = None
    custom_response_path: str | None = None
    custom_headers: dict | None = None
    created_at: datetime = Field(default_factory=utc_now)

class PipelineRun(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    user_id: str
    endpoint_id: str
    status: str
    domain: str
    harm_types: list[str]
    selected_techniques: list[str]
    target_model: str
    judge_model: str
    attacker_model: str
    total_tasks: int = 0
    successful_attacks: int = 0
    avg_risk_score: float = 0.0
    created_at: datetime = Field(default_factory=utc_now)
    completed_at: datetime | None = None
    error_message: str | None = None

class EvaluationResult(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    user_id: str
    run_id: str
    task_id: str
    original_prompt: str
    harm_type: str
    technique_id: str
    adversarial_prompt: str
    target_response: str
    iterations_used: int
    is_breakthrough: bool
    
    # Judge metrics with strict list typing (D-06)
    pii_leakage: bool = False
    pii_examples: list[str] = Field(default_factory=list, max_length=50)
    bias: str = "none"
    bias_examples: list[str] = Field(default_factory=list, max_length=50)
    toxicity: bool = False
    toxicity_severity: str = "none"
    safety_concern: str = ""
    
    # Multi-objective metrics
    novelty: float = 0.0
    diversity: float = 0.0
    realism: float = 0.0
    transferability: float = 0.0
    semantic_quality: float = 0.0
    overall_risk_score: float = 0.0
    
    created_at: datetime = Field(default_factory=utc_now)

class ExperienceMemory(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    user_id: str
    attack_family: str
    domain: str
    model: str
    score: float
    failure_reason: str | None = None
    successful_pattern: str | None = None
    created_at: datetime = Field(default_factory=utc_now)

class JudgeVerdictPayload(BaseModel):
    """Payload produced by LLM judge."""
    pii_leakage: bool = False
    pii_examples: list[str] = Field(default_factory=list, max_length=50)
    bias: str = "none"
    bias_examples: list[str] = Field(default_factory=list, max_length=50)
    toxicity: bool = False
    toxicity_severity: str = "none"
    safety_concern: str = ""
    overall_risk_score: float = 0.0
    novelty: float = 0.0
    diversity: float = 0.0
    realism: float = 0.0
    transferability: float = 0.0
    semantic_quality: float = 0.0

class ForensicEvidenceDoc(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    evaluation_id: str
    run_id: str
    user_id: str
    endpoint_id: str
    technique_id: str
    payload_hash: str
    adversarial_prompt_hash: str
    target_response_hash: str
    verdict_hash: str
    created_at: datetime = Field(default_factory=utc_now)

class AuditLogEntryDoc(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    sequence_number: int
    entity_type: str
    entity_id: str
    action: str
    current_hash: str
    previous_entry_hash: str
    payload_snapshot: dict
    timestamp: datetime = Field(default_factory=utc_now)

