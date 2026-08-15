# Valerie — Architecture & Technology Design Document

**Version:** 1.0  
**Last Updated:** 2026-07-17  
**Status:** Living document — update per sprint as decisions evolve  
**Research Basis:** [technology-research-catalogue.md](./technology-research-catalogue.md)

---

## 1. System Overview

Valerie is an automated LLM red-teaming framework. The system has three interfaces:

1. **CLI** — `valerie run` dispatches attacks, `valerie runs results` renders terminal UI
2. **Web Dashboard** — React SPA for configuring, launching, and monitoring pipeline runs
3. **API** — FastAPI backend orchestrating the LangGraph pipeline

### Current Architecture (What Exists)

```
┌────────────┐     ┌────────────┐     ┌──────────────────┐
│  CLI        │────▶│  FastAPI    │────▶│  LangGraph       │
│  (Typer)    │     │  (Uvicorn) │     │  Pipeline        │
└────────────┘     │            │     │                  │
                   │  Routers:  │     │  load_prompts    │
┌────────────┐     │  runs      │     │  ↓ fan-out       │
│  React SPA  │────▶│  results   │     │  attack_worker×N │
│  (Vite)    │     │  endpoints │     │  ↓ aggregate     │
└────────────┘     │  keys      │     └──────────────────┘
                   │  users     │              │
                   └─────┬──────┘              │
                         │                     ▼
                   ┌─────┴──────┐     ┌──────────────────┐
                   │  MongoDB   │◀────│  Motor (async)   │
                   │  (Atlas)   │     └──────────────────┘
                   ├────────────┤
                   │  Redis     │  ← session/cache layer
                   └────────────┘
```

### Target Architecture (What We're Building Toward)

```
┌────────────┐     ┌────────────────────────────────────┐
│  React SPA  │◀──▶│  FastAPI + WebSocket /ws/runs/{id} │
│  Vite+TW   │ SSE │                                    │
│  Zustand   │────▶│  Routers + SSE stream endpoint     │
│  Recharts  │     └────────────┬───────────────────────┘
│  D3 (bespoke)│                │
└────────────┘                  │
                         ┌──────┴──────┐
                         │  LangGraph  │──▶ Redis Pub/Sub
                         │  Pipeline   │     (live task events)
                         └──────┬──────┘
                                │
                         ┌──────┴──────┐
                         │  MongoDB    │
                         │  + pgvector │  ← if/when semantic search needed
                         └─────────────┘
```

---

## 2. Technology Decisions

### Decision Framework

Each decision follows this logic (ponytail ladder):
1. Does the current stack already handle it? → Keep it.
2. Can a stdlib/native API cover it? → Use it.
3. Can an already-installed dep do it? → Use it.
4. Only then: add something new, and pick the smallest viable option.

---

## 3. Backend Stack — Decisions

### 3.1 Runtime & Framework

| Component | Decision | Rationale |
|-----------|----------|-----------|
| **Language** | Python 3.10+ | Already in use. No reason to change. |
| **Framework** | FastAPI + Uvicorn | Already in use. Async-native, Pydantic validation, great perf. Keep. |
| **Pipeline** | LangGraph | Already in use. Handles fan-out/fan-in via `Send()`, conditional edges. Keep. |
| **LLM Router** | LiteLLM | Already in use. Provider-agnostic. Keep. |

> No changes needed. The backend runtime stack is sound.

### 3.2 Database

| Component | Decision | Rationale |
|-----------|----------|-----------|
| **Primary DB** | **MongoDB (via Motor)** | Already in use. Document model fits the semi-structured EvaluationResult data well. Pydantic models serialize naturally. Keep. |
| **Cache/Pub-Sub** | **Redis** | Already in use. Add Redis Pub/Sub for live pipeline event broadcasting (see §4.2). No new dependency. |
| **Vector Search** | **MongoDB Atlas Vector Search** | If/when semantic-similarity search is needed for experience memory or finding similar prompts. Avoid adding pgvector + Postgres as a second DB when Atlas has native vector search. Evaluate only when the feature is prioritized. |

> [!IMPORTANT]
> The docker-compose.yml currently includes a Postgres container, but the actual application code uses MongoDB via Motor exclusively. The Postgres container appears to be vestigial. Remove it from docker-compose.yml to avoid confusion, or keep it only if Alembic migrations target a separate Postgres for some other purpose.

### 3.3 Realtime — Live Pipeline Monitoring

**Decision: Server-Sent Events (SSE) for live task status, not WebSockets.**

| Why SSE | Why not WebSockets |
|---------|--------------------|
| Pipeline monitoring is **server→client** only (client watches, doesn't push) | WebSockets add bidirectional complexity we don't need |
| SSE has **built-in browser reconnection** with `Last-Event-ID` resumption | WebSocket reconnect logic must be hand-rolled |
| SSE works through standard HTTP infra (proxies, load balancers, Cloud Run) without upgrade headaches | WebSocket upgrade can be finicky on some infra |
| `EventSource` API is tiny — ~5 lines client-side | Socket.IO/raw WS adds a dependency |

**Implementation pattern:**

```
1. attack_worker publishes events → Redis Pub/Sub channel `run:{run_id}`
2. New SSE endpoint: GET /runs/{run_id}/stream
3. Endpoint subscribes to Redis channel, yields text/event-stream
4. Client uses native EventSource API
```

**Event schema (NDJSON):**
```json
{"event": "task_started", "task_id": "...", "harm_type": "...", "technique": "..."}
{"event": "task_completed", "task_id": "...", "risk_score": 0.82, "is_breakthrough": true}
{"event": "run_completed", "total_tasks": 42, "successful_attacks": 7, "avg_risk_score": 0.61}
```

### 3.4 Task Dispatch

| Component | Decision | Rationale |
|-----------|----------|-----------|
| **Production** | Google Cloud Tasks | Already implemented. Dispatches to worker service on Cloud Run. Keep. |
| **Local dev** | FastAPI BackgroundTasks | Already implemented as fallback. Keep. |

### 3.5 Auth

| Component | Decision | Rationale |
|-----------|----------|-----------|
| **User auth** | Firebase Auth (Google Sign-In) | Already configured. Keep. |
| **API auth** | API key (hashed, stored in MongoDB) | Already implemented. Keep. |

### 3.6 Infrastructure

| Component | Decision | Rationale |
|-----------|----------|-----------|
| **Compute** | Google Cloud Run | Already deployed via Terraform. Keep. |
| **IaC** | Terraform | Already in `infra/`. Keep. |
| **CI/CD** | Cloud Build | Already configured via `cloudbuild.yaml`. Keep. |
| **Container** | Docker + docker-compose (local) | Already configured. Keep. |

### 3.7 Backend — What NOT to Add

| Rejected | Why |
|----------|-----|
| GraphQL | REST + SSE covers all current needs. Adding GraphQL for subscriptions alone is over-engineering. |
| Kafka/Redpanda | Redis Pub/Sub is sufficient for the event volume (tens to low-hundreds of concurrent tasks per run). Kafka's operational complexity is unjustified. |
| Postgres alongside MongoDB | One DB is enough. Don't split writes across two database engines. |
| Separate vector DB (Pinecone/Qdrant) | MongoDB Atlas Vector Search covers modest-scale semantic search if needed. Evaluate later. |
| Edge computing (Cloudflare Workers) | Already on GCP/Cloud Run. Don't split across two cloud vendors for this. |

---

## 4. Frontend Stack — Decisions

### 4.1 Core Framework

| Component | Decision | Rationale |
|-----------|----------|-----------|
| **Framework** | **React 19** | Already in use. Massive ecosystem, team familiarity. Keep. |
| **Build** | **Vite 8** | Already in use. Near-instant dev server, native ESM. Keep. |
| **Language** | **TypeScript 6** | Already in use. Type safety across the full frontend. Keep. |
| **Routing** | **React Router 7** | Already in use. Keep. |
| **Styling** | **Tailwind CSS 4** | Already in use. Keep. |
| **Icons** | **Lucide React** | Already in use. Keep. |
| **Animation** | **Framer Motion 12** | Already in use. Declarative, React-idiomatic, spring physics. Keep. |

> No framework changes. The frontend core is modern and appropriate.

### 4.2 State Management

**Decision: Zustand** (new addition, replacing ad-hoc Context)

| Why Zustand | Why not alternatives |
|-------------|---------------------|
| Minimal API, hook-based, no provider nesting | Redux — too much boilerplate for this app's scale |
| External store — usable outside React (e.g., in an SSE event handler callback) | Jotai — atomic model adds complexity for a dashboard with mostly global pipeline state |
| Selector-based subscriptions = fine-grained re-render control | Context API — everything re-renders, poor for a live-updating dashboard |
| Built-in middleware for Redux DevTools (time-travel debugging) | XState — overkill unless we explicitly need statechart modeling per-task |

**Store structure:**

```typescript
// stores/pipelineStore.ts
interface PipelineStore {
  runs: Record<string, PipelineRun>
  activeRunId: string | null
  liveTaskEvents: Record<string, TaskEvent[]>  // keyed by run_id
  
  // Actions
  setActiveRun: (id: string) => void
  addTaskEvent: (runId: string, event: TaskEvent) => void
  updateRun: (run: PipelineRun) => void
}
```

### 4.3 Data Fetching

**Decision: Native `fetch` + lightweight wrapper** (no TanStack Query yet)

| Approach | Rationale |
|----------|-----------|
| Plain `fetch` with a thin `api.ts` utility | The app has ~6 API endpoints. TanStack Query's caching/invalidation/retry is powerful but YAGNI at this endpoint count. |
| SSE via native `EventSource` | Zero-dep live streaming. Pipe events into Zustand store. |

> [!TIP]
> Revisit TanStack Query when the API surface exceeds ~15 endpoints or when cache invalidation logic starts getting complex. It's an easy incremental adoption — doesn't require an upfront architectural commitment.

### 4.4 Charts & Visualization

| Component | Decision | Use Case |
|-----------|----------|----------|
| **Recharts** (already installed) | Standard charts: bar charts of risk distribution, line charts of score trends, pie charts of harm-type breakdown | Overview dashboard, run summary |
| **D3.js** (add when needed) | Bespoke visualizations: attack-technique × harm-type heatmap, risk-score matrix reordering, force-directed technique-similarity graph | Deep analysis views — add only when building those specific features |

> [!IMPORTANT]
> Do NOT add D3 preemptively. Recharts covers 80% of chart needs. Only pull in D3 for the genuinely custom visualizations (heatmaps, force-directed graphs) when those sprint stories are active.

### 4.5 Virtualization

**Decision: TanStack Virtual** (add when the results table exceeds ~200 rows in testing)

A single pipeline run with 7 harm types × 6 techniques × 10 prompts = 420 EvaluationResults. At that scale, naive DOM rendering starts to lag. TanStack Virtual is headless (framework-agnostic positioning logic), pairs well with the existing Tailwind styling, and is from the same ecosystem as the React community's most trusted data tooling.

### 4.6 Client-Side Search

**Decision: MiniSearch** (add when historical results browsing is built)

For searching across judge rationales, adversarial prompts, and target responses client-side. Tiny footprint, fuzzy/typo-tolerant, no server round-trip. Load the current run's results into a MiniSearch index on the client.

### 4.7 Accessibility

**Decision: Radix UI primitives for complex interactive widgets**

| Component | Rationale |
|-----------|-----------|
| Radix UI (headless, unstyled) | Correct ARIA patterns for dropdowns, dialogs, comboboxes out of the box. Pairs with Tailwind (no style conflicts). Powers shadcn/ui if we want to adopt that pattern later. |
| `aria-live="polite"` regions | For the live task-status feed — summarized announcements, not per-task spam. |

### 4.8 Testing

| Layer | Tool | Rationale |
|-------|------|-----------|
| **Unit** | Vitest | Vite-native, fast, Jest-compatible API. Natural fit since we're already on Vite. |
| **E2E** | Playwright | Real multi-browser testing (Chromium + Firefox + WebKit). Auto-waiting reduces flake. Trace Viewer for debugging. |
| **Accessibility** | axe-core (via @axe-core/playwright) | Automated a11y auditing in CI. |

### 4.9 Frontend — What NOT to Add

| Rejected | Why |
|----------|-----|
| Solid.js / Svelte / Qwik | React is already in use, team knows it, ecosystem is largest. Switching frameworks for marginal perf gains on a dashboard is not worth the rewrite. |
| Redux / Redux Toolkit | Overkill boilerplate for this app's state complexity. Zustand covers it with 1/10th the code. |
| RxJS | Steep learning curve, SSE + Zustand handles the actual event-stream-to-UI problem simpler. |
| DuckDB-Wasm / Apache Arrow | YAGNI. Client-side SQL analytics over historical results sounds cool but plain JS `Array.filter/sort/reduce` handles the actual data volumes (hundreds to low-thousands of results per run) fine. Revisit if/when cross-run corpus analytics at 100K+ results becomes a real feature. |
| GSAP | Framer Motion already installed and covers all current animation needs. |
| IndexedDB / OPFS / RxDB | No offline-first requirement. Dashboard is always-online. |
| CRDTs (Yjs/Automerge) | No multi-user collaborative editing requirement. |
| WebGPU / WebGL / deck.gl | No visualization at the scale (millions of points) that demands GPU rendering. Recharts + D3 SVG handles the actual element counts. |
| Service Workers / Workbox | No offline requirement. PWA is not a goal currently. |

---

## 5. Agile Sprint Reference — Feature → Technology Mapping

Use this table during sprint planning to know which technologies are needed for each feature area.

### Sprint-Ready Feature Map

| Feature | Backend Changes | Frontend Changes | New Dependencies | Priority |
|---------|----------------|-------------------|-------------------|----------|
| **Live run monitoring** | Add SSE endpoint (`GET /runs/{id}/stream`), Redis Pub/Sub publish in `attack_worker` | Native `EventSource` → Zustand store, live task grid component | None (Redis already installed) | **P0** |
| **Run overview dashboard** | None (existing endpoints) | Recharts bar/pie/line charts for run summary stats | None (Recharts already installed) | **P0** |
| **Results table with sorting/filtering** | Add pagination/filter params to `GET /results` | Sortable/filterable table, Framer Motion row transitions | None | **P0** |
| **Results table virtualization** | None | TanStack Virtual for 400+ row tables | `@tanstack/react-virtual` | **P1** |
| **Risk heatmap (technique × harm type)** | Add aggregation endpoint | D3.js heatmap with matrix reordering | `d3` | **P1** |
| **Client-side search across findings** | None | MiniSearch index over loaded results | `minisearch` | **P1** |
| **Accessible interactive widgets** | None | Radix UI for dropdowns, dialogs, comboboxes | `@radix-ui/*` | **P1** |
| **Unit + E2E testing** | Pytest (already implied) | Vitest + Playwright setup | `vitest`, `playwright` | **P1** |
| **Semantic similarity search** | MongoDB Atlas Vector Search, embedding generation | "Find similar prompts" UI | Possibly `openai` (for embeddings) | **P2** |
| **Force-directed technique graph** | Graph-query aggregation endpoint | D3 force simulation or Cytoscape.js | `d3` or `cytoscape` | **P2** |
| **Time-travel run replay** | Store per-task events in MongoDB (not just final results) | Scrub/playback UI with Framer Motion | None | **P2** |
| **CSP headers** | Add `Content-Security-Policy` headers in FastAPI middleware | Audit inline scripts/styles for CSP compliance | None | **P2** |

### Implementation Order (Recommended)

```
Sprint 1-2:  Live run monitoring (SSE + Zustand)
             Run overview dashboard (Recharts)
             Results table (sorting, filtering)

Sprint 3-4:  Virtualized results table (TanStack Virtual)
             Accessible widgets (Radix UI)
             Testing infrastructure (Vitest + Playwright)

Sprint 5-6:  Risk heatmap (D3)
             Client-side search (MiniSearch)
             CSP headers

Sprint 7+:   Semantic search (Atlas Vector Search)
             Technique graph visualization
             Time-travel replay
```

---

## 6. Key Architecture Patterns

### 6.1 SSE Live Event Flow

```
attack_worker (LangGraph node)
    │
    ▼ publish JSON event
Redis Pub/Sub channel: "run:{run_id}"
    │
    ▼ subscribe
FastAPI SSE endpoint: GET /runs/{run_id}/stream
    │
    ▼ yield text/event-stream
Browser EventSource
    │
    ▼ onmessage callback
Zustand store.addTaskEvent(runId, event)
    │
    ▼ selector subscription
React component re-renders only the changed task cell
```

### 6.2 Frontend Data Flow

```
API fetch ──────────▶ Zustand store ──────────▶ React components
                          ▲                         │
SSE EventSource ──────────┘                         │
                                                    ▼
                                          Recharts / D3 / Table
```

### 6.3 Branded TypeScript Types

Use branded types to prevent ID confusion across the many entity types:

```typescript
type RunId = string & { readonly __brand: 'RunId' }
type TaskId = string & { readonly __brand: 'TaskId' }
type EndpointId = string & { readonly __brand: 'EndpointId' }
```

---

## 7. Performance Budget

| Metric | Target | Measurement |
|--------|--------|-------------|
| LCP (Largest Contentful Paint) | < 2.5s | Lighthouse |
| INP (Interaction to Next Paint) | < 200ms | Web Vitals |
| CLS (Cumulative Layout Shift) | < 0.1 | Lighthouse |
| SSE event → UI update | < 100ms | Manual measurement |
| Results table scroll (500 rows) | 60fps | Chrome DevTools |
| Bundle size (gzipped) | < 200KB initial | `vite build` stats |

---

## 8. Security Checklist

| Item | Status | Notes |
|------|--------|-------|
| Firebase Auth for user sessions | ✅ Done | Google Sign-In configured |
| API key auth (hashed) for programmatic access | ✅ Done | `keys.py` router |
| CORS restricted to known origins | ✅ Done | `main.py` middleware — expand for production domain |
| CSP headers | ⬜ TODO | Add `Content-Security-Policy` header, start in report-only mode |
| Input sanitization on adversarial prompt display | ⬜ TODO | Critical — this app displays adversarial content by design. Use DOMPurify or React's default JSX escaping (which handles most cases) but audit any `dangerouslySetInnerHTML` usage. |
| Rate limiting | ⬜ TODO | Add per-user rate limiting on run creation (Redis-backed) |
| Secrets management | ✅ Done | GCP Secret Manager via Terraform |

> [!CAUTION]
> Valerie displays adversarial prompts and model responses that may contain malicious payloads (attempted XSS, prompt injection artifacts, etc.). Never render user-controlled or model-generated content via `dangerouslySetInnerHTML`. React's default JSX escaping handles most cases, but audit thoroughly.

---

## 9. File Structure — Target State

```
Valerie/
├── docs/
│   ├── architecture-design-doc.md      ← this file
│   └── technology-research-catalogue.md ← raw research reference
├── src/valerie/
│   ├── api/
│   │   ├── main.py
│   │   ├── auth.py
│   │   └── routers/
│   │       ├── runs.py        ← add SSE stream endpoint here
│   │       ├── results.py
│   │       ├── endpoints.py
│   │       ├── keys.py
│   │       └── users.py
│   ├── graph/
│   │   ├── pipeline.py
│   │   ├── state.py
│   │   └── nodes.py           ← add Redis Pub/Sub publish here
│   ├── db/
│   │   ├── engine.py
│   │   └── models.py
│   └── llm/
│       └── router.py
├── frontend/
│   ├── src/
│   │   ├── stores/            ← NEW: Zustand stores
│   │   │   └── pipelineStore.ts
│   │   ├── hooks/             ← NEW: custom hooks
│   │   │   └── useRunStream.ts  (EventSource → Zustand)
│   │   ├── lib/               ← NEW: api client, utilities
│   │   │   └── api.ts
│   │   ├── components/
│   │   ├── pages/
│   │   └── main.tsx
│   ├── package.json
│   └── vite.config.ts
├── infra/                      ← Terraform (existing)
├── cli/                        ← Typer CLI (existing)
└── docker-compose.yml
```

---

## 10. Decision Log

Track significant tech decisions here as they happen in sprint retros.

| Date | Decision | Context | Alternatives Considered |
|------|----------|---------|------------------------|
| 2026-07-17 | SSE over WebSockets for live monitoring | Monitoring is server→client only; SSE has built-in reconnection | WebSockets (unnecessary bidirectional), GraphQL Subscriptions (no existing GraphQL) |
| 2026-07-17 | Zustand over Redux/Jotai for state | Minimal API, external store works with SSE callbacks, selector-based re-render | Redux (too much boilerplate), Jotai (atomic model adds complexity), Context (re-render issues) |
| 2026-07-17 | Keep MongoDB, don't add Postgres | Code exclusively uses Motor/MongoDB. docker-compose Postgres appears vestigial | Dual-DB (operational complexity for no gain) |
| 2026-07-17 | Recharts for standard charts, D3 only for bespoke | Recharts already installed, covers 80% of chart needs | Vega-Lite (JSON spec overhead), Chart.js (less React-native) |
| 2026-07-17 | No offline/PWA features | Dashboard is always-online by nature; red-team ops require connectivity for LLM calls | Service Workers + Workbox (complexity for no real user benefit) |

---

## Appendix: Research Catalogue Quick-Reference

For deeper evaluation of any technology listed above, see the full [technology-research-catalogue.md](./technology-research-catalogue.md) which covers 23 layers:

| Layer | What It Covers | Most Relevant To Valerie |
|-------|---------------|--------------------------|
| 1. Frontend Rendering | React, Solid, Svelte, Qwik, Astro, RSC | React (already chosen) |
| 2. Animation | WAAPI, GSAP, Framer Motion, Rive/Lottie | Framer Motion (already installed) |
| 3. State Management | Redux, Zustand, Jotai, XState | **Zustand** (chosen) |
| 4. Client Data Processing | Arrow, DuckDB-Wasm, RxJS | Deferred — YAGNI currently |
| 5. Realtime | WebSockets, **SSE**, GraphQL Subs, PartyKit | **SSE** (chosen) |
| 6. Client Storage | IndexedDB, OPFS, Dexie, RxDB | Not needed (always-online) |
| 7. Search | FlexSearch, **MiniSearch**, Meilisearch, pgvector | **MiniSearch** (when needed) |
| 8. Graph DBs | Neo4j, Kuzu | Deferred — evaluate if technique-graph analysis becomes real |
| 9. Visualization | **D3**, Vega-Lite, deck.gl, Sigma/Cytoscape/G6 | **Recharts** (standard) + **D3** (bespoke) |
| 10. GPU/Canvas/SVG | WebGPU, Canvas, SVG | SVG (via Recharts/D3), Canvas if perf needed |
| 11. WebAssembly | Wasm, AssemblyScript | Not needed currently |
| 12. Offline | Service Workers, Workbox | Not needed |
| 13. Edge Computing | Cloudflare Workers | Not needed (on GCP) |
| 14. Streaming | ReadableStream, Kafka | **SSE** (chosen), Redis Pub/Sub (backend) |
| 15. CRDTs | Yjs, Automerge | Not needed |
| 16. Collaborative Editing | Liveblocks | Not needed |
| 17. AI SDKs | Vercel AI SDK, Transformers.js | Not needed (LLM orchestration is backend-side via LiteLLM) |
| 18. Browser APIs | Observers, WebCodecs/Transport | IntersectionObserver for lazy loading (use when needed) |
| 19. Virtualization | **TanStack Virtual** | **Chosen** (when results table grows) |
| 20. Accessibility | ARIA, axe-core, **Radix UI** | **Chosen** |
| 21. Performance | Web Vitals, Lighthouse, **Vite** | **Vite** (already in use), Lighthouse for auditing |
| 22. Security | **CSP**, Trusted Types | **CSP** (add in report-only mode) |
| 23. Developer Experience | **TypeScript**, **Vitest**, **Playwright** | All chosen |
