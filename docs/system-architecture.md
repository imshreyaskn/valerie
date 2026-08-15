# Valerie — System Architecture

**From Pipeline to Intelligence Platform**

**Version:** 1.0  
**Last Updated:** 2026-07-17  
**Companion Documents:**
- [product-vision.md](./product-vision.md) — What Valerie becomes (interaction paradigms)
- [architecture-design-doc.md](./architecture-design-doc.md) — Implementation stack decisions
- [technology-research-catalogue.md](./technology-research-catalogue.md) — Raw technology research

---

## The Core Shift

Valerie today is a pipeline. You create a run. It executes attacks. It stores results. You look at the results. Done.

```
Current: Valerie is a verb. You "run Valerie."
Target:  Valerie is a noun. Valerie "knows things."
```

The architectural change is this: **execution becomes one subsystem of a larger system whose primary purpose is building, maintaining, and reasoning over a security knowledge base.**

Runs don't disappear. They become one source of evidence flowing into a knowledge graph that continuously grows, connects, and generates intelligence. The knowledge graph — not the run — is the primary entity.

---

## Part I — Domain Architecture

Six bounded contexts. Each owns its data, defines its interfaces, and communicates with others exclusively through events.

```
┌───────────────────────────────────────────────────────────────────┐
│                                                                   │
│                        PLATFORM DOMAIN                            │
│         (Event Bus · Storage · Auth · Config · Search)            │
│                                                                   │
├──────────┬──────────┬──────────┬──────────┬──────────┬────────────┤
│          │          │          │          │          │            │
│EXECUTION │KNOWLEDGE │INTEL-    │OBSER-    │EXPERIENCE│ LEARNING   │
│ DOMAIN   │ DOMAIN   │LIGENCE   │VATION    │ DOMAIN   │ DOMAIN     │
│          │          │ DOMAIN   │ DOMAIN   │          │            │
│Runs      │Entities  │Patterns  │Events    │CLI       │Experience  │
│Tasks     │Relations │Clusters  │Metrics   │Web App   │Memory      │
│Workers   │Evidence  │Anomalies │Timelines │API       │Adaptation  │
│Scheduling│Findings  │Forecasts │Alerts    │Reports   │Transfer    │
│          │Mitigations│Recs     │Telemetry │Invest-   │Genome      │
│          │          │          │          │igations  │Library     │
│          │          │          │          │          │            │
└──────────┴──────────┴──────────┴──────────┴──────────┴────────────┘
```

### What changed from today

| Today | Tomorrow | Why |
|-------|----------|-----|
| `api/` handles everything | Platform Domain owns cross-cutting infrastructure | Routers shouldn't contain storage logic, auth logic, and business logic |
| `graph/` IS the system | Execution Domain is one of six domains | Execution is important but it's not the product |
| `db/models.py` defines flat documents | Knowledge Domain defines entities with typed relationships | Documents are storage. Entities are meaning. |
| `experience_memory` is a flat collection | Learning Domain continuously refines attack strategies from accumulated knowledge | Memory should be a system, not a collection |
| Nothing happens after `aggregate_and_persist` | Intelligence + Observation Domains react to every event | The pipeline ends. The intelligence never stops. |
| The frontend polls for results | Experience Domain subscribes to live events | Push, not pull |

---

## Part II — The Event Bus

Everything communicates through events. No domain calls another domain directly. Redis Streams (not Pub/Sub — Streams have persistence, consumer groups, and replay) is the backbone.

### Why Events, Not Function Calls

Today, `attack_worker` in `nodes.py` does everything: calls the LLM, evaluates, stores experience memory, persists results. That's one 200-line function containing execution logic, knowledge logic, learning logic, and persistence logic all tangled together.

With events:

```
attack_worker does ONE thing: execute the attack.
It publishes what happened.
Everything else reacts.
```

### Event Schema

Every event shares a common envelope:

```python
class Event:
    id: str                    # UUID
    type: str                  # e.g. "attack.completed"
    source: str                # e.g. "execution.attack_worker"
    timestamp: datetime        # when it happened
    correlation_id: str        # the run_id — ties related events together
    causation_id: str | None   # the event that caused this event
    payload: dict              # event-type-specific data
```

### Event Catalogue

These are the events the system produces and consumes. Organized by the domain that **emits** them.

#### Execution Domain Emits

| Event | Payload | Meaning |
|-------|---------|---------|
| `run.created` | run config, user, endpoint, techniques, domain | A new run was requested |
| `run.started` | run_id, total_tasks | Pipeline execution began |
| `task.dispatched` | task_id, technique, harm_type, prompt | A single attack task was dispatched to a worker |
| `prompt.generated` | task_id, iteration, adversarial_prompt, mutation_strategy | The attacker LLM produced a prompt |
| `prompt.mutated` | task_id, iteration, parent_prompt, child_prompt, diff_summary | A prompt was mutated from a previous iteration |
| `target.queried` | task_id, iteration, adversarial_prompt, endpoint_id | The target model was called |
| `response.received` | task_id, iteration, target_response, latency_ms | The target model responded |
| `judge.completed` | task_id, iteration, verdict (full JSON), is_breakthrough | The judge evaluated the response |
| `task.completed` | task_id, final_result, iterations_used | A single attack task finished (all iterations) |
| `run.completed` | run_id, summary stats | All tasks in a run finished |
| `run.failed` | run_id, error | A run failed |

Notice: **the execution domain emits events for every intermediate step, not just the final result.** `prompt.generated`, `prompt.mutated`, `response.received` — these are the events that make the Time Machine possible. Without them, you only have endpoints, never the journey.

#### Knowledge Domain Emits

| Event | Payload | Meaning |
|-------|---------|---------|
| `finding.created` | finding_id, weakness_id, evidence[], severity | A new security finding was extracted from a verdict |
| `weakness.discovered` | weakness_id, description, affected_endpoints[] | A new weakness category was identified |
| `weakness.updated` | weakness_id, new evidence, updated severity | Existing weakness gained new evidence |
| `entity.linked` | source_entity, target_entity, relationship_type | A new relationship was discovered between entities |
| `knowledge.enriched` | entity_id, enrichment_type, new_data | An entity gained new computed attributes (e.g., embedding) |

#### Intelligence Domain Emits

| Event | Payload | Meaning |
|-------|---------|---------|
| `pattern.detected` | pattern_id, description, supporting_evidence[] | A cross-run pattern was identified |
| `cluster.updated` | cluster_id, member_count, centroid_shift | An attack cluster changed |
| `anomaly.detected` | anomaly_id, description, severity, evidence | Something unusual was found |
| `coverage.gap` | domain, technique, endpoint, reasoning | An untested area was identified |
| `recommendation.generated` | rec_id, action, reasoning, confidence | The system suggests an action |
| `forecast.updated` | endpoint_id, technique_id, predicted_risk, confidence | Risk prediction was updated |

#### Observation Domain Emits

| Event | Payload | Meaning |
|-------|---------|---------|
| `metric.computed` | metric_name, value, dimensions | A metric was calculated |
| `alert.triggered` | alert_id, severity, message, evidence | A threshold was crossed |
| `timeline.recorded` | run_id, event_sequence | A timeline snapshot was persisted |

#### Learning Domain Emits

| Event | Payload | Meaning |
|-------|---------|---------|
| `strategy.learned` | strategy_id, technique, success_pattern, confidence | A new effective attack strategy was learned |
| `genome.computed` | prompt_id, genome_vector | An attack's genome fingerprint was calculated |
| `transfer.discovered` | source_endpoint, target_endpoint, technique, predicted_effectiveness | A strategy effective against one model is predicted to work against another |

#### Experience Domain Emits

| Event | Payload | Meaning |
|-------|---------|---------|
| `investigation.created` | investigation_id, user_id, title | A researcher started an investigation |
| `annotation.added` | entity_id, user_id, text | A researcher annotated a finding |
| `report.generated` | report_id, format, content | A report was produced |

### Who Listens To What

```
                         Event Bus (Redis Streams)
                                │
         ┌──────────┬───────────┼───────────┬──────────┬──────────┐
         │          │           │           │          │          │
         ▼          ▼           ▼           ▼          ▼          ▼
    KNOWLEDGE  INTELLIGENCE  OBSERVATION  LEARNING  EXPERIENCE  PLATFORM
     DOMAIN      DOMAIN       DOMAIN      DOMAIN     DOMAIN    (search
                                                                index)
```

| Consumer Domain | Subscribes To | What It Does |
|-----------------|---------------|--------------|
| Knowledge | `judge.completed`, `task.completed`, `run.completed` | Extracts findings, creates/updates entities, discovers relationships |
| Intelligence | `finding.created`, `weakness.updated`, `knowledge.enriched` | Mines patterns, detects anomalies, generates recommendations |
| Observation | ALL execution events | Records timelines, computes metrics, triggers alerts |
| Learning | `task.completed`, `pattern.detected`, `genome.computed` | Updates experience memory, learns strategies, computes transfer predictions |
| Experience | `alert.triggered`, `recommendation.generated`, `run.completed` | Pushes notifications, updates live UI, feeds the intelligence briefing |
| Platform (Search) | `finding.created`, `knowledge.enriched`, `annotation.added` | Updates search indexes (both keyword and vector) |

### The Critical Property: No Circular Dependencies

```
Execution → emits events → Knowledge consumes
Knowledge → emits events → Intelligence consumes
Intelligence → emits events → Experience consumes (for display)
Learning → emits events → Execution consumes (for better attacks)
```

The only cycle is intentional: **Learning feeds back into Execution** (experience memory improves future attacks). This is the system's core feedback loop — it gets smarter over time.

---

## Part III — The Knowledge Graph

### Why Not Just Documents

Today, an `EvaluationResult` in MongoDB is a flat document:

```python
# Current: a bag of fields
{
    "run_id": "abc",
    "technique_id": "role_play",
    "adversarial_prompt": "...",
    "target_response": "...",
    "is_breakthrough": True,
    "pii_leakage": True,
    "overall_risk_score": 0.94,
    ...
}
```

You can query: "show me all results from run abc." You can filter: "show me all breakthroughs." You cannot ask: "what weakness does this exploit, and what other techniques also exploit that same weakness, and which models are affected, and what defenses exist?"

That question requires **entities and relationships**, not flat documents.

### Entity Model

```
┌─────────────────────────────────────────────────────────────────┐
│                     KNOWLEDGE GRAPH ENTITIES                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────┐    generates    ┌──────────┐    targets           │
│  │Technique │───────────────▶│  Prompt  │──────────────┐       │
│  │          │                │          │              │       │
│  │id        │                │id        │              ▼       │
│  │name      │                │text      │         ┌─────────┐ │
│  │family    │                │embedding │         │Endpoint │ │
│  │genome_sig│                │lineage[] │         │         │ │
│  └──────────┘                │iteration │         │model    │ │
│       │                      │parent_id │         │provider │ │
│       │                      └────┬─────┘         │config   │ │
│       │                           │               └────┬────┘ │
│       │ effective_against         │ produces           │      │
│       │                           ▼                    │      │
│       │                      ┌──────────┐              │      │
│       └─────────────────────▶│ Finding  │◀─────────────┘      │
│                              │          │                      │
│                              │severity  │                      │
│                              │verdict{} │                      │
│                              │evidence[]│                      │
│                              └────┬─────┘                      │
│                                   │                            │
│                                   │ proves                     │
│                                   ▼                            │
│                              ┌──────────┐                      │
│                              │ Weakness │                      │
│                              │          │                      │
│                              │name      │                      │
│                              │desc      │                      │
│                              │category  │ ◀── mitigated_by     │
│                              │cwe_id    │         │            │
│                              └──────────┘         │            │
│                                                   │            │
│                                              ┌────┴─────┐      │
│                                              │ Defense  │      │
│                                              │          │      │
│                                              │strategy  │      │
│                                              │effective │      │
│                                              │verified  │      │
│                                              └──────────┘      │
│                                                                 │
│  ── Organizational Entities ──────────────────────────────────  │
│                                                                 │
│  ┌──────────┐    contains    ┌──────────┐                      │
│  │ Campaign │───────────────▶│   Run    │                      │
│  │          │                │          │                      │
│  │objective │                │status    │                      │
│  │target    │                │config    │                      │
│  │timeline  │                │stats     │                      │
│  └──────────┘                └──────────┘                      │
│                                                                 │
│  ┌──────────┐    references  ┌──────────┐                      │
│  │Investig- │───────────────▶│Annotation│                      │
│  │ation     │                │          │                      │
│  │          │                │text      │                      │
│  │user_id   │                │entity_ref│                      │
│  │canvas{}  │                │user_id   │                      │
│  └──────────┘                └──────────┘                      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Entity Definitions

```python
# --- Core Entities ---

class Technique:
    id: str
    name: str                     # "Role Play"
    family: str                   # "social_engineering"
    description: str
    genome_signature: list[float] # quantified strategy fingerprint
    # Computed (materialized from events):
    efficacy: dict[str, float]    # endpoint_id → breakthrough_rate
    total_uses: int
    total_breakthroughs: int

class Prompt:
    id: str
    text: str
    embedding: list[float]        # vector embedding of the prompt text
    technique_id: str             # which technique generated this
    seed_prompt_id: str | None    # the original seed (null if this IS the seed)
    parent_prompt_id: str | None  # the prompt this was mutated from
    iteration: int                # which iteration of the attack loop
    mutation_strategy: str | None # what the attacker changed and why
    genome: list[float]           # attack genome fingerprint
    run_id: str
    task_id: str
    created_at: datetime

class Endpoint:
    id: str
    model_name: str               # "gpt-4o", "claude-4-sonnet"
    provider: str                 # "openai", "anthropic", "google"
    config: dict                  # base_url, api params, etc.
    user_id: str
    # Computed (materialized):
    vulnerability_profile: dict[str, float]  # technique_id → breakthrough_rate
    total_attacks_received: int
    total_breakthroughs: int
    weakness_ids: list[str]

class Finding:
    id: str
    prompt_id: str
    endpoint_id: str
    technique_id: str
    run_id: str
    task_id: str
    severity: str                 # critical, high, medium, low, info
    verdict: dict                 # full judge output (risk scores, flags)
    evidence: list[Evidence]
    weakness_id: str | None       # linked after pattern mining
    is_breakthrough: bool
    created_at: datetime

class Evidence:
    id: str
    finding_id: str
    type: str                     # "pii_leakage", "toxicity", "bias", "safety_bypass"
    description: str
    tokens: str | None            # the exact tokens in the response
    token_positions: tuple[int, int] | None  # start, end positions
    confidence: float

class Weakness:
    id: str
    name: str                     # "Fictional authority override"
    description: str              # human-readable explanation
    category: str                 # "instruction_following", "refusal_bypass", etc.
    cwe_id: str | None            # cross-reference to CWE if applicable
    affected_endpoint_ids: list[str]
    finding_ids: list[str]        # all findings that prove this weakness
    defense_ids: list[str]        # known mitigations
    # Computed:
    severity_aggregate: float     # weighted average across all findings
    first_seen: datetime
    last_seen: datetime
    trend: str                    # "worsening", "stable", "improving"

class Defense:
    id: str
    weakness_id: str
    strategy: str                 # "system prompt hardening", "input filtering", etc.
    description: str
    effectiveness: float | None   # measured, if tested
    verified: bool                # has this been tested?
    source: str                   # "manual", "ai_suggested", "literature"

# --- Organizational Entities ---

class Campaign:
    id: str
    user_id: str
    name: str
    objective: str                # "Evaluate GPT-4o safety for BFSI deployment"
    target_endpoint_ids: list[str]
    run_ids: list[str]
    status: str                   # active, paused, completed
    created_at: datetime

class Run:
    id: str
    campaign_id: str | None
    user_id: str
    endpoint_id: str
    config: dict                  # full run configuration
    status: str
    # Computed (materialized from events):
    total_tasks: int
    completed_tasks: int
    breakthroughs: int
    avg_risk_score: float
    duration_ms: int | None
    created_at: datetime
    completed_at: datetime | None

class Investigation:
    id: str
    user_id: str
    title: str
    canvas: dict                  # spatial layout of pinned entities
    entity_refs: list[str]        # IDs of all entities referenced
    annotations: list[Annotation]
    created_at: datetime
    updated_at: datetime

class Annotation:
    id: str
    investigation_id: str
    user_id: str
    entity_id: str                # what entity this annotates
    entity_type: str              # "finding", "prompt", "weakness", etc.
    text: str
    created_at: datetime
```

### Relationships (Edges)

In MongoDB, relationships are stored as references (foreign keys) on the entities. For traversal queries, MongoDB's `$graphLookup` aggregation stage handles multi-hop graph queries without needing a separate graph database. If graph query complexity outgrows `$graphLookup`, Kuzu (embeddable graph DB) can be added as a read-side projection without changing the write-side storage.

| Relationship | From | To | Stored On | Meaning |
|-------------|------|-----|-----------|---------|
| `generates` | Technique | Prompt | Prompt.technique_id | This technique generated this prompt |
| `mutated_from` | Prompt | Prompt | Prompt.parent_prompt_id | This prompt was mutated from that prompt |
| `descends_from` | Prompt | Prompt | Prompt.seed_prompt_id | This prompt's original seed |
| `targets` | Prompt | Endpoint | Finding.endpoint_id | This prompt was tested against this endpoint |
| `produced` | (Prompt, Endpoint) | Finding | Finding.prompt_id + Finding.endpoint_id | This prompt against this endpoint produced this finding |
| `proves` | Finding | Weakness | Finding.weakness_id | This finding is evidence of this weakness |
| `affects` | Weakness | Endpoint | Weakness.affected_endpoint_ids | This weakness affects this endpoint |
| `mitigated_by` | Weakness | Defense | Defense.weakness_id | This defense mitigates this weakness |
| `part_of` | Run | Campaign | Run.campaign_id | This run belongs to this campaign |
| `similar_to` | Prompt | Prompt | Computed via embedding distance | These prompts are semantically similar |

---

## Part IV — Domain Internals

### 4.1 Execution Domain

**Owns:** Runs, Tasks, Workers, Orchestration, Scheduling  
**Current code:** `graph/pipeline.py`, `graph/nodes.py`, `graph/state.py`, `worker/`, `api/routers/runs.py`

**What changes:**

The `attack_worker` function in `nodes.py` currently does six things:
1. Fetch experience memory
2. Fetch target endpoint
3. Generate/mutate adversarial prompt (LLM call)
4. Query target model (LLM call)
5. Judge the response (LLM call)
6. Store experience memory if breakthrough

In the new architecture, it does steps 1-5 and **publishes events** for each step. It no longer writes to experience memory, knowledge, or anything else directly. It emits facts. Other domains react.

```python
# Execution Domain — attack_worker (simplified)

async def attack_worker(state: dict) -> dict:
    task = state["current_task"]
    bus = get_event_bus()

    # Ask Learning Domain for relevant strategies (via a read API, not direct DB access)
    strategies = await learning_client.get_strategies(
        technique=task["attack_family"],
        domain=task["domain"],
        endpoint_id=state["endpoint_id"]
    )

    for i in range(state["max_iterations"]):

        # Generate prompt
        adversarial_prompt = await call_llm(...)

        await bus.publish(Event(
            type="prompt.generated",
            payload={"task_id": task["task_id"], "iteration": i,
                     "prompt": adversarial_prompt, "parent_prompt": prev_prompt}
        ))

        # Query target
        target_response = await call_llm(...)

        await bus.publish(Event(
            type="response.received",
            payload={"task_id": task["task_id"], "iteration": i,
                     "response": target_response, "latency_ms": latency}
        ))

        # Judge
        verdict = await call_llm(...)

        await bus.publish(Event(
            type="judge.completed",
            payload={"task_id": task["task_id"], "iteration": i,
                     "verdict": parsed_verdict, "is_breakthrough": is_breakthrough}
        ))

        if is_breakthrough:
            break

    await bus.publish(Event(
        type="task.completed",
        payload={"task_id": task["task_id"], "final_result": result}
    ))

    return {"results": [result]}
```

The function got **simpler**, not more complex. It does less. It knows less about the rest of the system. The six concerns collapsed to one: execute the attack and report what happened.

### 4.2 Knowledge Domain

**Owns:** Entities, Relationships, Evidence, Findings, Weaknesses, Defenses, Semantic Search  
**Current code:** Does not exist as a separate domain. Knowledge is scattered across `db/models.py` (flat documents) and `aggregate_and_persist` in `nodes.py`.

**What it does:**

Subscribes to execution events. For each `judge.completed` event:

1. Creates a `Finding` entity with structured evidence extracted from the verdict
2. Creates or updates a `Prompt` entity with embedding, lineage, and genome
3. Updates the `Endpoint` entity's vulnerability profile
4. Attempts to link the finding to an existing `Weakness` (by similarity to past findings)
5. If no matching weakness exists and enough similar findings accumulate, creates a new `Weakness`
6. Publishes `finding.created` and/or `weakness.updated` events

```python
# Knowledge Domain — event handler (simplified)

async def on_judge_completed(event: Event):
    verdict = event.payload["verdict"]
    task_id = event.payload["task_id"]

    # Create Finding entity
    finding = Finding(
        prompt_id=...,
        endpoint_id=...,
        technique_id=...,
        severity=compute_severity(verdict),
        verdict=verdict,
        evidence=extract_evidence(verdict),
        is_breakthrough=event.payload["is_breakthrough"],
    )
    await knowledge_store.save(finding)

    # Create/update Prompt entity with embedding
    prompt_text = ...  # from correlated prompt.generated event
    embedding = await compute_embedding(prompt_text)
    prompt_entity = Prompt(
        text=prompt_text,
        embedding=embedding,
        technique_id=...,
        parent_prompt_id=...,  # from prompt.mutated event
        genome=compute_genome(prompt_text),
    )
    await knowledge_store.save(prompt_entity)

    # Link finding to weakness (if similar findings exist)
    similar_findings = await knowledge_store.find_similar_findings(finding)
    if weakness := detect_common_weakness(similar_findings):
        finding.weakness_id = weakness.id
        weakness.finding_ids.append(finding.id)
        await knowledge_store.save(weakness)
        await bus.publish(Event(type="weakness.updated", payload=...))
    
    await bus.publish(Event(type="finding.created", payload=...))
```

**Key design choice:** Weakness detection is not a simple category label. It's computed by clustering findings based on:
- Which judge evaluation criteria were triggered (PII, toxicity, bias)
- The semantic similarity of the prompts that caused them
- The mutation strategies that led to breakthroughs
- Which endpoints were affected

This means weaknesses **emerge from the data**, not from a pre-defined taxonomy. "Fictional authority override" becomes a weakness because the system observes that multiple breakthroughs across multiple techniques and endpoints share the pattern of wrapping requests in fictional authority frames.

### 4.3 Intelligence Domain

**Owns:** Pattern mining, clustering, anomaly detection, forecasting, recommendations  
**Current code:** Does not exist.

**What it does:**

Subscribes to Knowledge Domain events. Performs higher-order analysis:

| Capability | Input Events | Output | How |
|-----------|-------------|--------|-----|
| **Pattern Mining** | `finding.created`, `weakness.updated` | `pattern.detected` | Cluster similar findings across runs. When a cluster exceeds a threshold, surface it as a named pattern. |
| **Anomaly Detection** | `finding.created`, `metric.computed` | `anomaly.detected` | Flag findings that deviate significantly from historical distributions (e.g., sudden spike in breakthrough rate for a previously-resistant endpoint) |
| **Coverage Analysis** | `run.completed` | `coverage.gap` | Cross-reference the matrix of (techniques × endpoints × domains) against what has actually been tested. Surface untested cells. |
| **Risk Forecasting** | `finding.created`, `pattern.detected` | `forecast.updated` | Given accumulated data, predict which technique-endpoint combinations are likely vulnerable but untested. |
| **Recommendations** | `coverage.gap`, `pattern.detected`, `forecast.updated` | `recommendation.generated` | "You should test authority_claim against Gemini in the healthcare domain — similar models showed 34% breakthrough rate." |

Most of these are **AI-powered.** Pattern mining uses embeddings and clustering. Anomaly detection uses statistical baselines. Risk forecasting uses the accumulated corpus as training signal. The LLM layer (`call_llm`) isn't just for attack generation — it's a reasoning tool across the entire intelligence domain.

### 4.4 Observation Domain

**Owns:** Metrics, live event streaming, timelines, alerts, telemetry  
**Current code:** Does not exist as a domain. The frontend polls `GET /runs/{id}` for status.

**What it does:**

Subscribes to ALL execution events. Provides:

1. **Live Event Stream** — SSE endpoint that proxies execution events to the frontend in real-time. This is the mechanism that powers live run monitoring, the Time Machine (scrubbing through recorded events), and the live task grid.

2. **Metrics Computation** — Materializes aggregate metrics from the event stream:
   - Per-run: completion %, breakthrough rate, avg risk score, duration
   - Per-endpoint: historical vulnerability trends
   - Per-technique: efficacy rates across endpoints
   - System-wide: total findings, total weaknesses, coverage %

3. **Timeline Recording** — Stores the full ordered event sequence for every run. This is what the Time Machine replays. Not reconstructed from final results — recorded as it happened.

4. **Alerting** — Configurable threshold-based alerts:
   - Breakthrough rate exceeds X% for a run
   - A new high-severity finding against a production endpoint
   - An endpoint's vulnerability profile worsened since last test

```python
# Observation Domain — SSE endpoint (simplified)

@router.get("/runs/{run_id}/stream")
async def stream_run_events(run_id: str):
    async def event_generator():
        async for event in event_bus.subscribe(f"run:{run_id}"):
            yield f"event: {event.type}\ndata: {json.dumps(event.payload)}\n\n"
    
    return StreamingResponse(event_generator(), media_type="text/event-stream")
```

### 4.5 Learning Domain

**Owns:** Experience memory, attack strategy adaptation, genome computation, transfer learning  
**Current code:** The crude `experience_memory` collection in MongoDB, and the 3-line memory lookup in `attack_worker`.

**What it becomes:**

| Capability | What It Does | Current Equivalent |
|-----------|-------------|-------------------|
| **Experience Memory** | Stores successful attack patterns with structured metadata (not just the prompt string, but which genome dimensions were present, which mutation strategy worked, against which endpoint class) | `db.experience_memory.insert_one({...})` — flat, unstructured |
| **Strategy Selection** | Given a new task (technique + domain + endpoint), selects the most promising attack strategy from accumulated experience | 3-line Mongo query in `attack_worker` |
| **Genome Computation** | Quantifies each prompt's adversarial strategy fingerprint — a vector of scores across dimensions like roleplay, authority, encoding, emotional appeal | Does not exist |
| **Transfer Prediction** | Predicts whether an attack effective against Endpoint A will also work against Endpoint B, based on similarity of their vulnerability profiles | Does not exist |
| **Adaptation** | Learns which mutation strategies are most effective at increasing risk scores across iterations, and biases future mutations accordingly | Does not exist — mutations are entirely LLM-improvised |

### 4.6 Experience Domain

**Owns:** CLI, Web App, API, Notifications, Reports, Investigations  
**Current code:** `api/routers/*`, `frontend/`, `cli/`

This domain is the **consumer** of everything the other five domains produce. It doesn't generate knowledge — it presents it, navigates it, and lets researchers interact with it.

The interaction paradigms from [product-vision.md](./product-vision.md) live here:
- Investigation Canvas → Investigation entity + canvas renderer
- Knowledge Graph Explorer → reads Knowledge Domain entities/relationships
- Time Machine → reads Observation Domain recorded timelines
- Intelligence Feed → subscribes to Intelligence Domain events
- Semantic Search → queries Knowledge Domain's vector indexes

### 4.7 Platform Domain

**Owns:** Event Bus, Storage, Auth, Config, Search Indexing, Plugin System  
**Current code:** `db/engine.py`, `api/auth.py`, `core/settings.py`

**Components:**

| Component | Implementation | Purpose |
|-----------|---------------|---------|
| **Event Bus** | Redis Streams | Durable, replayable event backbone with consumer groups |
| **Document Store** | MongoDB (Motor) | Primary storage for all entities |
| **Vector Index** | MongoDB Atlas Vector Search | Embedding similarity queries for prompts, findings |
| **Cache** | Redis | Session cache, computed metric cache, rate limiting |
| **Auth** | Firebase Auth + API Keys | User authentication and API authorization |
| **Search** | MongoDB Atlas Search (full-text) + Vector Search (semantic) | Hybrid keyword + semantic search across all entities |
| **Config** | Pydantic Settings | Centralized, validated configuration |

---

## Part V — The Compiler Analogy

The user's insight that Valerie resembles a compiler is architecturally precise. A compiler has clearly separated passes, each transforming a representation into a richer one. Valerie should too.

```
CURRENT PIPELINE (3 stages):
  Prompt → Attack → Judge → Store

TARGET PIPELINE (9 stages):

┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  1. SOURCING                                                    │
│     Select seed prompts from domain corpus                      │
│     Input: domain config                                        │
│     Output: list[SeedPrompt]                                    │
│                                                                 │
│  2. STRATEGY                                                    │
│     Select attack strategy from experience memory               │
│     Input: SeedPrompt + Technique + EndpointProfile             │
│     Output: AttackPlan (strategy, predicted risk, suggested     │
│             mutations)                                          │
│                                                                 │
│  3. GENERATION                                                  │
│     Generate adversarial prompt using attacker LLM              │
│     Input: AttackPlan                                           │
│     Output: AdversarialPrompt                                   │
│                                                                 │
│  4. EXECUTION                                                   │
│     Query target model                                          │
│     Input: AdversarialPrompt + Endpoint                         │
│     Output: TargetResponse                                      │
│                                                                 │
│  5. JUDGEMENT                                                    │
│     Evaluate response for safety violations                     │
│     Input: AdversarialPrompt + TargetResponse                   │
│     Output: Verdict (structured)                                │
│                                                                 │
│  6. NORMALIZATION                                               │
│     Extract structured findings and evidence from verdict       │
│     Input: Verdict                                              │
│     Output: Finding + Evidence[]                                │
│                                                                 │
│  7. ENRICHMENT                                                  │
│     Compute embeddings, genome fingerprint, diff from parent    │
│     Input: AdversarialPrompt + Finding                          │
│     Output: EnrichedPrompt + EnrichedFinding                    │
│                                                                 │
│  8. LINKING                                                     │
│     Connect finding to weakness, similar findings, similar      │
│     prompts. Discover relationships.                            │
│     Input: EnrichedFinding + Knowledge Graph                    │
│     Output: Relationship edges                                  │
│                                                                 │
│  9. MINING                                                      │
│     Detect patterns, update clusters, generate intelligence     │
│     Input: New edges + updated graph                            │
│     Output: Patterns, anomalies, recommendations                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

Stages 1-5:  Execution Domain (synchronous, per-task)
Stage  6:    Knowledge Domain (event-driven, reacts to judge.completed)
Stage  7:    Knowledge Domain + Learning Domain (event-driven)
Stage  8:    Knowledge Domain (event-driven, reacts to knowledge.enriched)
Stage  9:    Intelligence Domain (event-driven, reacts to entity.linked)
```

Stages 1-5 happen during the run. Stages 6-9 happen continuously, asynchronously, **after and between** runs. The intelligence layer never stops processing — a finding from Run #1 might get linked to a weakness that's only discovered in Run #47.

---

## Part VI — Migration Path

### From Current to Target — In Phases

This is not a rewrite. Each phase adds capability without breaking what exists.

### Phase 0: Event Infrastructure (1-2 weeks)

**Add the event bus. Change nothing else.**

1. Add a thin `EventBus` class wrapping Redis Streams (not Pub/Sub — Streams persist events and support consumer groups for replay)
2. Make `attack_worker` publish events **in addition to** its current behavior (dual-write). No existing functionality changes.
3. Add the SSE endpoint in the API. The frontend can subscribe to live events immediately.

```python
# platform/event_bus.py — the entire event bus implementation

class EventBus:
    def __init__(self, redis_client):
        self.redis = redis_client

    async def publish(self, stream: str, event: Event):
        await self.redis.xadd(stream, event.to_dict())

    async def subscribe(self, stream: str, last_id: str = "$"):
        while True:
            events = await self.redis.xread({stream: last_id}, block=5000, count=10)
            for stream_name, messages in events:
                for msg_id, data in messages:
                    last_id = msg_id
                    yield Event.from_dict(data)
```

**Result:** Live run monitoring works. Timeline recording becomes possible. Nothing broke.

### Phase 1: Knowledge Entities (2-4 weeks)

**Introduce the entity model alongside existing documents.**

1. Create the entity classes (`Technique`, `Prompt`, `Finding`, `Evidence`, `Weakness`, `Endpoint`)
2. Create a Knowledge Domain consumer that subscribes to `judge.completed` and `task.completed` events
3. The consumer creates entities **in addition to** the existing `evaluation_results` documents — dual-write, read from whichever is appropriate
4. Add embedding computation (via the LLM layer, or a dedicated embedding model) for prompts and findings
5. Create the prompt lineage graph (`parent_prompt_id` tracked from `prompt.mutated` events)

**Result:** The knowledge graph starts accumulating. Existing endpoints and documents remain unchanged. New query capabilities (graph traversal, semantic similarity) become available.

### Phase 2: Intelligence Layer (4-8 weeks)

**Add pattern mining, anomaly detection, and recommendations.**

1. Create the Intelligence Domain consumer
2. Implement clustering over prompt embeddings (identifies attack families empirically, not just by technique label)
3. Implement coverage analysis (technique × endpoint × domain matrix with gap detection)
4. Implement the Intelligence Feed API — Intelligence Domain events surfaced to the frontend
5. Create the Attack Genome computation in the Learning Domain

**Result:** Valerie starts having opinions. "You should test this." "These 17 findings are related." "This model got weaker."

### Phase 3: Decouple Execution (4-8 weeks)

**Remove direct database writes from `attack_worker`.**

1. Move `aggregate_and_persist` logic into the Knowledge Domain consumer (it's already handling this via events at this point)
2. Remove the experience memory read/write from `attack_worker` — replace with a Learning Domain read API
3. The Execution Domain now only: receives run config, dispatches tasks, calls LLMs, publishes events
4. Remove the old `evaluation_results` dual-write (Knowledge Domain entities are now the source of truth)

**Result:** Full domain separation. Execution is clean. Knowledge accumulates through events. Each domain can be deployed, scaled, and tested independently.

### Phase 4: Advanced Intelligence (Ongoing)

**Build the paradigms from the product vision.**

- Causal Explorer (requires accumulated corpus)
- Transfer prediction (requires enough cross-endpoint data)
- AI Investigation Copilot (requires the knowledge graph + a conversational interface)
- Risk forecasting (requires temporal data across many runs)

These are built on the foundation of Phases 0-3 and activated as the accumulated data reaches sufficient scale.

---

## Part VII — Mapping Current Code to Domains

| Current File | Current Domain | Target Domain | What Changes |
|-------------|---------------|--------------|--------------|
| `api/main.py` | Monolith | Platform | CORS, startup hooks, router mounting. Stays similar. |
| `api/auth.py` | Monolith | Platform | Auth logic. No change. |
| `api/routers/runs.py` | Monolith | Execution | Run creation + dispatch. Add event publishing. Remove direct DB read for results (delegate to Knowledge Domain API). |
| `api/routers/results.py` | Monolith | Experience | Results querying. Reads from Knowledge Domain entities instead of flat `evaluation_results`. |
| `api/routers/endpoints.py` | Monolith | Knowledge | Endpoint CRUD. Becomes a Knowledge Domain entity. |
| `api/routers/keys.py` | Monolith | Platform | API key management. No change. |
| `api/routers/users.py` | Monolith | Platform | User management. No change. |
| `graph/pipeline.py` | Pipeline | Execution | LangGraph pipeline definition. No structural change — nodes publish events. |
| `graph/nodes.py` | Pipeline (does everything) | Execution (does less) | The big change. `attack_worker` stops writing to DB directly. Publishes events instead. |
| `graph/state.py` | Pipeline | Execution | Pipeline state. Minor additions for event context (correlation_id). |
| `db/engine.py` | Monolith | Platform | MongoDB + Redis clients. Add Redis Streams client. |
| `db/models.py` | Monolith | Knowledge | Flat Pydantic models → rich entity classes with relationships. |
| `db/indexes.py` | Monolith | Platform + Knowledge | Add indexes for new entities, vector search indexes. |
| `attacks/techniques.py` | Monolith | Knowledge | Static technique registry → `Technique` entities in the knowledge graph. |
| `llm/router.py` | Monolith | Platform | LLM call routing. Shared by all domains that need LLM calls. No change. |
| `core/settings.py` | Monolith | Platform | Config. No change. |
| `worker/executor.py` | Monolith | Execution | Cloud Tasks worker entry point. No change structurally. |
| *Does not exist* | — | Knowledge Domain | NEW: Event consumers, entity management, weakness detection, embedding computation |
| *Does not exist* | — | Intelligence Domain | NEW: Pattern mining, anomaly detection, coverage analysis, recommendations |
| *Does not exist* | — | Learning Domain | NEW: Genome computation, strategy selection, transfer prediction |
| *Does not exist* | — | Observation Domain | NEW: SSE streaming, timeline recording, metrics, alerting |

---

## Part VIII — Target Directory Structure

```
src/valerie/
├── platform/                    # Cross-cutting infrastructure
│   ├── event_bus.py             # Redis Streams event bus
│   ├── events.py                # Event envelope + catalogue
│   ├── storage.py               # MongoDB client (was db/engine.py)
│   ├── auth.py                  # Firebase Auth + API key (was api/auth.py)
│   ├── search.py                # Full-text + vector search client
│   ├── config.py                # Settings (was core/settings.py)
│   └── llm.py                   # LLM routing (was llm/router.py)
│
├── execution/                   # Runs attacks
│   ├── pipeline.py              # LangGraph graph definition
│   ├── nodes.py                 # Pipeline nodes (attack_worker, etc.)
│   ├── state.py                 # Pipeline state types
│   ├── worker.py                # Cloud Tasks worker (was worker/executor.py)
│   └── api.py                   # POST /runs, GET /runs/{id}, GET /runs/{id}/stream
│
├── knowledge/                   # Entities, relationships, evidence
│   ├── entities.py              # Entity class definitions
│   ├── consumers.py             # Event handlers (judge.completed → Finding)
│   ├── weakness_detector.py     # Clusters findings into weaknesses
│   ├── embedding.py             # Embedding computation
│   ├── graph.py                 # Relationship queries ($graphLookup)
│   └── api.py                   # GET /findings, GET /weaknesses, search endpoints
│
├── intelligence/                # Pattern mining, anomalies, recs
│   ├── consumers.py             # Event handlers (finding.created → patterns)
│   ├── clustering.py            # Prompt/finding clustering
│   ├── coverage.py              # Coverage gap analysis
│   ├── anomaly.py               # Anomaly detection
│   ├── forecast.py              # Risk forecasting
│   └── api.py                   # GET /intelligence/feed, GET /patterns
│
├── learning/                    # Experience memory, genomes, adaptation
│   ├── consumers.py             # Event handlers (task.completed → memory)
│   ├── memory.py                # Experience memory (was inline in nodes.py)
│   ├── genome.py                # Attack genome computation
│   ├── strategy.py              # Strategy selection for new tasks
│   └── api.py                   # GET /strategies (called by execution domain)
│
├── observation/                 # Metrics, timelines, alerts, live streaming
│   ├── consumers.py             # Event handlers (all execution events)
│   ├── metrics.py               # Metric computation and materialization
│   ├── timeline.py              # Timeline recording and replay
│   ├── alerting.py              # Threshold-based alerts
│   └── api.py                   # SSE stream endpoint, GET /metrics
│
├── experience/                  # API surface + frontend-facing endpoints
│   ├── api.py                   # Aggregate API router (mounts domain APIs)
│   ├── investigations.py        # Investigation CRUD
│   └── reports.py               # Report generation
│
└── main.py                      # FastAPI app entry point
```

---

## Part IX — What This Architecture Enables

| Capability | Why It's Possible Now | Why It Wasn't Before |
|-----------|----------------------|---------------------|
| **Time Machine** | Every intermediate step is recorded as an event with timestamps | Only final results were stored |
| **Attack Evolution Tree** | Prompt lineage (`parent_prompt_id`) tracked via `prompt.mutated` events | No lineage tracking — each result was a flat, disconnected document |
| **Risk Universe** | Prompts have embeddings stored on the entity | No embeddings computed or stored |
| **Intelligence Feed** | Intelligence Domain publishes `pattern.detected`, `anomaly.detected`, `recommendation.generated` events | No pattern mining existed |
| **Weakness Discovery** | Knowledge Domain clusters findings and extracts common weaknesses automatically | Weaknesses were never extracted — you had flat verdict JSONs |
| **Cross-run learning** | Learning Domain accumulates structured experience memory across all runs | Experience memory was a crude 3-line query |
| **Semantic Search** | Prompt and Finding entities have embeddings + Atlas Vector Search | No embeddings, no vector search |
| **Model Comparison** | Endpoint entities have materialized vulnerability profiles | Would require ad-hoc aggregation queries across flat results |
| **Investigation Canvas** | Investigation is a first-class entity referencing other entities | No investigation concept existed |
| **Causal Explorer** | Accumulated structured data across (technique, endpoint, config, finding) enables statistical causal analysis | Flat result documents made cross-dimensional analysis impractical |

---

## Part X — The One-Sentence Reframe

**Valerie's primary output is not a list of evaluation results. It's an ever-growing, ever-deepening understanding of how language models fail — and what to do about it.**

The run is how you gather evidence.
The knowledge graph is where evidence becomes understanding.
The intelligence layer is where understanding becomes action.

That's the system.
