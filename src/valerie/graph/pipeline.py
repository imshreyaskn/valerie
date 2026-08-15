from pydantic import BaseModel, Field
from langgraph.graph import StateGraph, END
from valerie.graph.state import PipelineState
from valerie.graph.nodes import load_domain_prompts, dispatch_attacks, attack_worker, aggregate_and_persist

class PipelineRunConfig(BaseModel):
    run_id: str
    user_id: str
    endpoint_id: str
    domain: str
    harm_types: list[str] = Field(default_factory=list)
    selected_techniques: list[str] = Field(..., min_length=1)
    judge_model: str
    attacker_model: str

    target_api_key: str | None = None
    attacker_api_key: str | None = None
    judge_api_key: str | None = None
    max_iterations: int = Field(default=3, ge=1, le=20)
    risk_threshold: float = Field(default=0.7, ge=0.0, le=1.0)
    max_concurrency: int = Field(default=10, ge=1, le=50)

builder = StateGraph(PipelineState)
builder.add_node("load_prompts",  load_domain_prompts)  # type: ignore
builder.add_node("attack_worker", attack_worker)  # type: ignore
builder.add_node("aggregate",     aggregate_and_persist)  # type: ignore

builder.set_entry_point("load_prompts")

builder.add_conditional_edges("load_prompts", dispatch_attacks, ["attack_worker"])  # type: ignore

builder.add_edge("attack_worker", "aggregate")
builder.add_edge("aggregate", END)

graph = builder.compile()

async def run_pipeline(config: dict) -> list[dict]:
    # Fail-fast pipeline configuration validation (B-24)
    validated = PipelineRunConfig(**config)
    validated_dict = validated.model_dump()

    result = await graph.ainvoke(
        validated_dict,
        config={"configurable": {"max_concurrency": validated.max_concurrency}}  # type: ignore
    )
    return result.get("results", [])

