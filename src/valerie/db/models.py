from sqlmodel import SQLModel, Field
from datetime import datetime
from uuid import uuid4

class PipelineRun(SQLModel, table=True):
    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    api_key_hash: str
    status: str
    domain: str
    harm_types: str                # JSON array
    selected_techniques: str       # JSON array
    target_model: str
    judge_model: str
    attacker_model: str
    target_api_base: str | None = None
    total_tasks: int = 0
    successful_attacks: int = 0
    avg_risk_score: float = 0.0
    created_at: datetime = Field(default_factory=datetime.utcnow)
    completed_at: datetime | None = None
    error_message: str | None = None

class EvaluationResult(SQLModel, table=True):
    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    run_id: str = Field(foreign_key="pipelinerun.id")
    task_id: str
    original_prompt: str
    harm_type: str
    technique_id: str
    adversarial_prompt: str
    target_response: str
    iterations_used: int
    is_breakthrough: bool
    pii_leakage: bool
    pii_examples: str              # JSON
    bias: str
    bias_examples: str             # JSON
    toxicity: bool
    toxicity_severity: str
    safety_concern: str
    overall_risk_score: float
    created_at: datetime = Field(default_factory=datetime.utcnow)

class ApiKey(SQLModel, table=True):
    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    key_hash: str = Field(index=True, unique=True)
    label: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    is_active: bool = True
