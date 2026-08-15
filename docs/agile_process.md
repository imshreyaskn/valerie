# Valerie Agile Development Process

**Version:** 1.0
**Last Updated:** 2026-07-17

This document outlines the strict Agile engineering principles for the Valerie Security Intelligence Platform.

## 1. Perfect Perfection (No Duct Tape)
Every commit and feature must represent the highest quality code humanly possible. 
- **No temporary hacks**: If a feature requires an architectural change to be done correctly, make the architectural change. Do not bolt things onto the side.
- **Surgical precision**: Understand the entire flow before changing one line. Ensure the change reflects elegantly throughout the whole system.

## 2. Small Features, Build Fast, Ship Fast
We iterate rapidly, but without compromising quality.
- Break large domains into component tasks.
- Ship a small, flawless feature. Verify it fully. Then move to the next.

## 3. The Ponytail Rule (Lazy Senior Dev)
The best code is the code never written. Before adding complexity:
1. Does this need to be built at all? (YAGNI)
2. Can a standard library feature cover it?
3. Can an already-installed dependency solve it?
4. Can this be one line?
5. Deletion over addition. Boring over clever. Fewest files possible.

## 4. Architecture-Driven
All changes must strictly adhere to the 6 Bounded Domains (Platform, Execution, Knowledge, Intelligence, Observation, Learning) communicating over the Redis Streams Event Bus, as defined in `system-architecture.md`. Any deviation from this event-driven model must be explicitly debated and documented in the architecture docs first.

## Implementation Log

### Phase 1: Core Telemetry & Execution Decoupling (Completed)
We achieved foundational decoupling by moving from a monolithic graph execution to an event-driven flow:
- **Platform Domain**: Implemented `EventPublisher` and `EventSubscriber` via Redis Streams (`valerie/core/events.py`). Universal Pydantic `Event` schema enforces strict payload contracts.
- **Execution Domain**: Surgically refactored `attack_worker` in `nodes.py` to stop writing direct DB updates. It now strictly publishes standard events (`task.dispatched`, `prompt.generated`, `response.received`, `judge.completed`, `task.completed`).
- **Networking**: Built a lightweight FastAPI Server-Sent Events (SSE) endpoint (`GET /runs/{run_id}/stream`) that seamlessly pipes Redis Streams to connected clients.
- **Observation Domain (Frontend)**: Replaced heavy contexts with a highly optimized `Zustand` store (`usePipelineStore`) and `EventSource` hook (`useRunStream`). Engineered a dynamic real-time dashboard UI in `Overview.tsx` that builds tasks and updates risk scores on the fly as telemetry streams in.
- **Cleanup**: Stripped all vestigial dependencies, including Firebase Admin SDKs and PostgreSQL Docker containers, fully aligning with the MongoDB & Redis data layer blueprint.
### Phase 2: Knowledge Domain Integration & API Refactoring (Completed)
We moved from manual direct-DB inserts in execution logic to a dedicated Knowledge Consumer that builds our entity graph dynamically from the event stream:
- **Knowledge Domain**: Implemented `valerie/knowledge/consumers.py` to listen for `judge.completed` events and construct `Finding` and `PromptEntity` records.
- **REST API Overhaul**: Replaced the legacy `evaluation_results` endpoints in `/runs/{run_id}/results` to instead aggregate data intelligently by joining `db.findings` and `db.prompts`.
- **Strict Typing (mypy)**: Eliminated technical debt by enforcing strict static analysis across the entire application stack.

### Phase 3: Intelligence & Learning (Completed)
As explicitly directed, this phase temporarily bypassed the "YAGNI" (Ponytail) rule to build a sophisticated, ML-heavy Intelligence Layer.
- **Data Science Stack**: Integrated `scikit-learn`, `pandas`, and `numpy` to support advanced numerical computations.
- **Clustering & Anomaly Detection**: 
  - `clustering.py`: Uses `DBSCAN` to cluster semantic embeddings of successful attacks to automatically synthesize `Weakness` entities.
  - `anomaly.py`: Employs `IsolationForest` across run metrics to spot outlier behaviors.
- **Coverage Analytics**: `coverage.py` uses `pandas` multi-dimensional grouping to perform gap analysis across endpoints and domains.
- **Learning Domain (Experience Memory)**: Implemented `valerie/learning/consumers.py` to parse `task.completed` events. It retroactively inspects stream histories to identify high-scoring prompts, extracting structural patterns via LLM analysis, and upserting them into `db.experience_memory` to feed future generation.
- **Architectural Purity**: All Intelligence and Learning computations occur completely decoupled from the Execution loop. They operate as asynchronous stream consumers managed dynamically by FastAPI.

### Phase 5: LLM Pipeline Dashboard (Completed)
We constructed the highly scalable live monitoring dashboard while adhering to strict High-ROI constraints and bypassing over-engineered solutions.
- **Accessible Live Regions**: Integrated Radix UI primitives and added `aria-live="polite"` regions to the global stats container, allowing screen readers to seamlessly parse high-frequency telemetry.
- **Stream Resiliency**: Upgraded the `GET /runs/{run_id}/stream` endpoint to read the `Last-Event-ID` header. The SSE stream now robustly handles reconnection and safely replays dropped events from Redis Streams.
- **State Management & Memoization**: Verified the `Zustand` store preserves the `activeRunId === 'all'` bypass for global fan-in. Wrapped `TaskCard` and dynamic list items in `React.memo` to eliminate massive Virtual DOM diffing overhead during intense event ingestion.
- **Documentation**: Finalized design decisions in `phase5-dashboard-architecture.md`.
