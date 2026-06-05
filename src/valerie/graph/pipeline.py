from langgraph.graph import StateGraph, END
from valerie.graph.state import PipelineState
from valerie.graph.nodes import load_domain_prompts, dispatch_attacks, attack_worker, aggregate_and_persist

builder = StateGraph(PipelineState)
builder.add_node("load_prompts",  load_domain_prompts)
builder.add_node("attack_worker", attack_worker)
builder.add_node("aggregate",     aggregate_and_persist)

builder.set_entry_point("load_prompts")

builder.add_conditional_edges("load_prompts", dispatch_attacks, ["attack_worker"])

builder.add_edge("attack_worker", "aggregate")
builder.add_edge("aggregate", END)

graph = builder.compile()

async def run_pipeline(config: dict) -> list[dict]:
    result = await graph.ainvoke(
        config,
        config={"configurable": {"max_concurrency": config.get("max_concurrency", 10)}}
    )
    return result.get("results", [])
