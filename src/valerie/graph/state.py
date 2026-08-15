from typing import Annotated, TypedDict
import operator

class AttackTask(TypedDict):
    task_id: str
    original_prompt: str
    harm_type: str
    attack_family: str
    domain: str

class AttackResult(TypedDict):
    task_id: str
    original_prompt: str
    harm_type: str
    attack_family: str
    adversarial_prompt: str
    target_response: str
    iterations_used: int
    is_breakthrough: bool
    pii_leakage: bool
    pii_examples: list
    bias: str
    bias_examples: list
    toxicity: bool
    toxicity_severity: str
    safety_concern: str
    novelty: float
    diversity: float
    realism: float
    transferability: float
    semantic_quality: float
    overall_risk_score: float

class PipelineState(TypedDict):
    run_id: str
    user_id: str
    endpoint_id: str
    domain: str
    harm_types: list[str]
    selected_techniques: list[str]  # now maps to attack_families
    judge_model: str
    judge_api_key: str | None
    attacker_model: str
    attacker_api_key: str | None
    max_iterations: int
    risk_threshold: float
    max_concurrency: int

    domain_prompts: list[dict]
    attack_tasks: list[AttackTask]
    results: Annotated[list[AttackResult], operator.add]
