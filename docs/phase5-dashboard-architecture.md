# Phase 5: LLM Pipeline Dashboard Architecture (ROI Optimized)

This document outlines the architectural decisions for Phase 5 of Valerie. Our goal is to build a "live, fan-out/fan-in, multi-agent LLM pipeline monitoring system" that handles massive asynchronous event streams gracefully.

*Note: This architecture strictly adheres to the Phase 3 & 4 development constraints outlined in `AGENTS.md` and prioritizes high-ROI solutions over theoretical architectural purity.*

---

## 1. System Context & Architectural Goals

The dashboard must observe a complex, asynchronous LangGraph execution environment. The execution domain (Phase 3) publishes telemetry strictly via the Redis Streams Event Bus. The dashboard must consume this stream, render live updates, and remain highly responsive.

**Core Goals:**
1. **Live High-Frequency Rendering:** Process 1000s of events/sec without React DOM thrashing.
2. **Accessibility (a11y):** Ensure screen readers can digest live pipeline statuses logically.
3. **Resilience:** Handle connection constraints (SSE auth limitations) properly.

---

## 2. Frontend Technological Decisions

### 2.1 Rendering & State Management (High ROI)
- **Framework:** **React (Vite)**
- **Global State:** **Zustand** (`pipelineStore.ts`)
  - *Critical Constraint:* The `pipelineStore.ts` explicitly allows processing events if `activeRunId === 'all'` or if it matches `event.correlation_id`. This `"all"` bypass MUST remain to ensure the global dashboard does not silently drop events.
- **Performance via Memoization:** 
  - *Strategy:* The SSE dashboard receives high-frequency updates. All dynamically rendered list items (like `TaskCard` or graph nodes) MUST be wrapped in `React.memo`.
  - *Why:* This is a high-ROI solution that prevents massive React Fiber diffing overhead without requiring complex transient update architectures or Web Workers.

### 2.2 Client-Side Storage
- **Technology:** Standard Browser Memory / Zustand
- *Why:* While IndexedDB (Dexie.js) was considered for caching massive historical runs offline, its immediate ROI is low compared to simply fetching historical data efficiently from the backend MongoDB when requested. We will avoid this complexity initially.

### 2.3 Accessibility (a11y)
- **Component Library:** **Radix UI** + **Tailwind CSS**
  - *Why:* Phase 5 explicitly mandates combining Tailwind for utility styling with Radix UI for accessible, headless interactive components (e.g., tooltips, modals).
- **Live Regions:**
  - *Implementation:* We will use `aria-live="polite"` for the global dashboard summary to prevent screen reader denial-of-service from high-frequency updates.

---

## 3. Backend Technological Decisions

### 3.1 Realtime Broadcast (SSE Bridge)
- **Technology:** **FastAPI Server-Sent Events (SSE)**
- **Auth Strategy (Critical Constraint):** 
  - *Implementation:* The native browser `EventSource` API does not support custom HTTP headers. Thus, the SSE stream (`/runs/{run_id}/stream`) MUST use the `?token=<jwt>` query parameter for authentication. 
  - *Why:* Do not attempt to refactor this to use `Authorization` headers on the frontend, as it will break native `EventSource`.

### 3.2 Execution Engine Resiliency
- No blocking synchronous I/O in async contexts (e.g. wrap `pandas.read_csv` in `asyncio.to_thread`).
- LLM JSON outputs must be parsed using robust structures (Pydantic models) rather than fragile regex.
- Reward metrics must use proper mathematical algorithms (e.g., Harmonic Mean) instead of hardcoded duct-tape heuristics.
