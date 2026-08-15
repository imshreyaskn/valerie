<RULE[agile_perfection_valerie]>
# Valerie Intelligence Platform Standards

When working on the Valerie codebase, strictly adhere to the following standards:

1. **Architecture-Driven**: Valerie is a 6-bounded-domain Security Intelligence Platform. The domains communicate *exclusively* via the Redis Streams Event Bus. If you find tight coupling (direct function calls between execution, storage, learning), you must decouple them into event publishing and subscription. Refer to `docs/system-architecture.md` and `docs/architecture-design-doc.md` before making structural decisions.

2. **Perfect Perfection**: Write the highest quality code humanly possible. 
   - No random duct tape fixes.
   - Everything must be surgical and reflect correctly throughout the whole system.
   - If a fix requires a deep structural correction to be done right, do the structural correction.

3. **Agile Process**: Build fast, ship fast, but flawlessly. Implement features incrementally. Complete and verify one small piece perfectly before moving to the next.

4. **Lazy Senior Dev (Ponytail Mode)**: Defer complexity. Use what we already have. Avoid new dependencies. 

5. **Phase 3 Context (Event Bus & ML Active)**: The Redis Streams Event Bus is fully operational (`valerie/core/events.py`). The Execution Domain (`nodes.py`) strictly publishes telemetry without direct DB writes.
   - **Consumers**: The backend runs asynchronous event consumers for Knowledge (`findings`, `prompts`), Intelligence (`DBSCAN clustering`, `IsolationForest anomalies`), and Learning (`experience_memory`). Do not re-couple execution logic; all new side-effects must happen in consumers listening to events like `judge.completed` or `task.completed`.
   - **Strict Typing**: The backend enforces 100% strict `mypy` typing. Do not write duct-tape type ignores unless explicitly bypassing missing 3rd-party stubs.
   - **Frontend Consumption**: The Observation Domain consumes live telemetry via SSE (`/runs/{run_id}/stream`) and renders it with Zustand in `Overview.tsx`. 
   - **SSE Auth Caveat**: The native browser `EventSource` API does not support custom HTTP headers. Thus, the SSE stream uses the `?token=<jwt>` query parameter for authentication. Do not attempt to refactor this to use `Authorization` headers on the frontend.
   - **Zustand State Caveat**: The frontend `pipelineStore.ts` explicitly allows processing events if `activeRunId === 'all'` or if it matches `event.correlation_id`. Do not remove this `"all"` bypass, or the global dashboard will silently drop all events.

6. **Phase 4 Context (Robustness & Accessibility)**:
   - **Frontend UI & Accessibility**: Combine Tailwind CSS for utility styling with **Radix UI** for accessible, headless interactive components (e.g. tooltips, modals).
   - **Performance via Memoization**: The SSE dashboard receives high-frequency updates. All dynamically rendered list items (like `TaskCard`) MUST be wrapped in `React.memo` to prevent massive React Fiber diffing overhead.
   - **Execution Engine Resiliency**: No blocking synchronous I/O in async contexts (e.g. wrap `pandas.read_csv` in `asyncio.to_thread`). LLM JSON outputs must be parsed using robust structures (like Pydantic models) rather than fragile regex. Reward metrics must use proper mathematical algorithms (e.g., Harmonic Mean) instead of hardcoded duct-tape heuristics.
   - **Strict Security**: The API implements fail-fast validation on startup for `VALERIE_MASTER_KEY`. Do not re-introduce insecure fallback secrets for auth.
</RULE[agile_perfection_valerie]>
