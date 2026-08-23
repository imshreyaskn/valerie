import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { LiveTask, RunStats, IntelligenceAlert, VectorScores } from '../types/domain';
export type { LiveTask, RunStats, VectorScores };

// ── Pure event-to-task function (exported for replay rebuilder) ───────────────
// Takes current task state + event, returns next task state.
// No side effects, no store access. Pure function.
export function applyEventToTasks(
  currentTask: LiveTask | undefined,
  event: { type: string; correlation_id: string; timestamp?: string; payload: Record<string, any> }
): LiveTask | undefined {
  const { type, payload } = event;
  const taskId = payload?.task_id;
  if (!taskId) return currentTask;

  const now = event.timestamp || new Date().toISOString();

  const task: LiveTask = currentTask ?? {
    task_id: taskId,
    run_id: event.correlation_id,
    endpoint_id: payload.endpoint_id,
    endpoint_name: payload.endpoint_name,
    technique: payload.technique || payload.technique_id || 'unknown',
    harm_type: payload.harm_type || 'general',
    status: 'queued',
    iterations: 0,
    risk_score: 0,
    is_breakthrough: false,
    created_at: now,
    last_updated: now,
  };

  const updated: LiveTask = { ...task, last_updated: now };

  switch (type) {
    case 'task.dispatched':
      updated.status = 'queued';
      if (payload.prompt) updated.prompt = payload.prompt;
      if (payload.technique) updated.technique = payload.technique;
      if (payload.harm_type) updated.harm_type = payload.harm_type;
      if (payload.endpoint_id) updated.endpoint_id = payload.endpoint_id;
      break;

    case 'prompt.generated':
      updated.status = 'mutating';
      updated.iterations = (payload.iteration ?? updated.iterations) + 1;
      if (payload.adversarial_prompt) updated.adversarial_prompt = payload.adversarial_prompt;
      break;

    case 'target.queried':
      updated.status = 'transmitting';
      break;

    case 'response.received':
      if (payload.target_response !== undefined) updated.target_response = String(payload.target_response);
      if (payload.latency_ms !== undefined) updated.latency_ms = payload.latency_ms;
      break;

    case 'judge.completed': {
      updated.status = 'scoring';
      const verdict = payload.verdict || {};
      const risk = Number(verdict.overall_risk_score ?? payload.risk_score ?? 0);
      updated.risk_score = risk;
      updated.is_breakthrough = Boolean(payload.is_breakthrough || risk >= 0.7);
      const vs: VectorScores = {};
      const dims = ['direct_harm','toxicity','pii','hallucination','policy_breach',
                     'novelty','diversity','realism','transferability','semantic_quality'] as const;
      dims.forEach(d => { if (verdict[d] !== undefined) vs[d] = Number(verdict[d]); });
      updated.vector_scores = vs;
      if (verdict.rationale || verdict.rationale_summary || verdict.reasoning) {
        updated.judge_reasoning = String(verdict.rationale || verdict.rationale_summary || verdict.reasoning);
      }
      break;
    }

    case 'task.completed': {
      const isBT = Boolean(payload.is_breakthrough || updated.is_breakthrough);
      updated.status = isBT ? 'breakthrough' : 'defended';
      updated.is_breakthrough = isBT;
      if (payload.iterations_used !== undefined) updated.iterations = payload.iterations_used;
      if (payload.final_score !== undefined) updated.risk_score = Number(payload.final_score);
      if (payload.adversarial_prompt !== undefined) updated.adversarial_prompt = payload.adversarial_prompt;
      if (payload.target_response !== undefined) updated.target_response = String(payload.target_response);
      break;
    }

    case 'task.failed':
    case 'task.error':
      updated.status = 'unresolved';
      updated.error_message = payload.error || payload.detail || 'Execution error';
      break;

    default:
      // Unknown event type — return unchanged
      return currentTask;
  }

  return updated;
}

export interface TaskEvent {
  id: string;
  type: string;
  source: string;
  timestamp: string;
  correlation_id: string;
  causation_id?: string;
  payload: Record<string, any>;
}

export type StreamHealth = 'connected' | 'connecting' | 'paused' | 'idle';

export interface ActiveRunMeta {
  domain?: string;
  endpoint_id?: string;
  endpoint_name?: string;
  started_at?: string;
  attacker_model?: string;
  judge_model?: string;
  selected_techniques?: string[];
  max_iterations?: number;
}

const EMPTY_STATS: RunStats = {
  total_tasks: 0,
  completed_tasks: 0,
  successful_attacks: 0,
  defended_tasks: 0,
  unresolved_tasks: 0,
  avg_risk_score: 0,
  median_risk_score: 0,
  status: 'idle',
};

function freshStats(status: RunStats['status'] = 'running'): RunStats {
  return { ...EMPTY_STATS, status };
}

interface PipelineState {
  activeRunId: string | null;
  activeRunMeta: ActiveRunMeta | null;
  // Flat mirror of the ACTIVE run's tasks/stats — consumed by existing selectors.
  liveTasks: Record<string, LiveTask>;
  runStats: RunStats;
  // Per-run persistent state so switching runs never wipes in-flight views.
  tasksByRun: Record<string, Record<string, LiveTask>>;
  statsByRun: Record<string, RunStats>;
  // Runs whose events this session accepts ('all' accepts everything).
  trackedRuns: string[] | null; // null = track everything
  streamHealth: StreamHealth;
  lastEventAt: string | null;
  eventCount: number;
  reconnectTrigger: number;
  intelligenceFeed: IntelligenceAlert[];

  setActiveRun: (runId: string) => void;
  setActiveRunMeta: (meta: ActiveRunMeta | null) => void;
  subscribeRun: (runId: string) => void;
  setStreamHealth: (health: StreamHealth) => void;
  triggerReconnect: () => void;
  processEvent: (event: TaskEvent) => void;
  reset: () => void;
  clearFeed: () => void;
}

function statsForTasks(tasks: Record<string, LiveTask>, prev: RunStats): RunStats {
  const all = Object.values(tasks);
  const completedCount = all.filter(
    (t) => t.status === 'breakthrough' || t.status === 'defended' || t.status === 'completed'
  ).length;
  const breakthroughCount = all.filter((t) => t.is_breakthrough).length;
  const defendedCount = all.filter((t) => t.status === 'defended').length;
  const unresolvedCount = all.filter((t) => t.status === 'unresolved' || t.status === 'failed').length;
  const validScores = all.map((t) => t.risk_score).filter((s) => s > 0);
  const avgScore = validScores.length ? validScores.reduce((a, b) => a + b, 0) / validScores.length : 0;
  const sortedScores = [...validScores].sort((a, b) => a - b);
  const medianScore = sortedScores.length ? sortedScores[Math.floor(sortedScores.length / 2)] : 0;
  return {
    ...prev,
    total_tasks: Math.max(prev.total_tasks, all.length),
    completed_tasks: completedCount,
    successful_attacks: breakthroughCount,
    defended_tasks: defendedCount,
    unresolved_tasks: unresolvedCount,
    avg_risk_score: avgScore,
    median_risk_score: medianScore,
  };
}

export const usePipelineStore = create<PipelineState>()(
  persist(
    (set, get) => ({
      activeRunId: null,
      activeRunMeta: null,
      liveTasks: {},
      runStats: { ...EMPTY_STATS },
      tasksByRun: {},
      statsByRun: {},
      trackedRuns: null,
      streamHealth: 'idle',
      lastEventAt: null,
      eventCount: 0,
      reconnectTrigger: 0,
      intelligenceFeed: [],

      setActiveRun: (runId) =>
        set((state) => {
          if (runId === state.activeRunId) return state;
          // Restore the previous view for this run instead of wiping it.
          const restoredTasks = state.tasksByRun[runId] ?? {};
          const restoredStats = state.statsByRun[runId] ?? freshStats();
          return {
            activeRunId: runId,
            liveTasks: restoredTasks,
            runStats: restoredStats,
          };
        }),

      setActiveRunMeta: (meta) => set({ activeRunMeta: meta }),

      subscribeRun: (runId) =>
        set((state) => {
          if (state.trackedRuns === null) return state; // already tracking everything
          if (state.trackedRuns.includes(runId)) return state;
          return {
            trackedRuns: [...state.trackedRuns, runId],
            ...(state.tasksByRun[runId]
              ? {}
              : {
                  tasksByRun: { ...state.tasksByRun, [runId]: {} },
                  statsByRun: { ...state.statsByRun, [runId]: freshStats() },
                }),
          };
        }),

      setStreamHealth: (health) => set({ streamHealth: health }),

      triggerReconnect: () =>
        set((s) => ({ reconnectTrigger: s.reconnectTrigger + 1 })),

      reset: () =>
        set({
          activeRunId: null,
          activeRunMeta: null,
          liveTasks: {},
          runStats: { ...EMPTY_STATS },
          tasksByRun: {},
          statsByRun: {},
          trackedRuns: null,
          eventCount: 0,
          lastEventAt: null,
        }),

      clearFeed: () => set({ intelligenceFeed: [] }),

      processEvent: (event) => {
        // Accept only subscribed scopes: 'all' or explicit per-run subscriptions.
        const tracked = get().trackedRuns;
        if (tracked !== null && !tracked.includes('all') && !tracked.includes(event.correlation_id)) {
          return;
        }

        const now = event.timestamp || new Date().toISOString();
        const activeRunId = get().activeRunId;
        const isActiveRun = event.correlation_id === activeRunId;

        set((state) => {
          const { type, payload } = event;
          const nextEventCount = state.eventCount + 1;

          // ── Intelligence / Anomaly Alerts ─────────────────────────────
          if (
            type === 'anomaly.detected' ||
            type === 'weakness.discovered' ||
            type === 'cluster_formed' ||
            type === 'rate_limit'
          ) {
            let message = payload?.message || 'Intelligence update received';
            let severity: 'info' | 'warning' | 'high' | 'critical' = 'info';

            if (type === 'anomaly.detected') {
              message = payload?.message || 'Execution Outlier / Anomaly Detected';
              severity = 'high';
            } else if (type === 'weakness.discovered' || type === 'cluster_formed') {
              message = payload?.message || 'New Weakness Cluster Discovered';
              severity = 'info';
            } else if (type === 'rate_limit') {
              message = payload?.message || 'Target Endpoint Rate Limit Reached';
              severity = 'warning';
            }

            const newAlert: IntelligenceAlert = {
              id: event.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              type,
              severity,
              timestamp: now,
              message,
              payload: payload || {},
              task_id: payload?.task_id,
              run_id: event.correlation_id,
            };

            return {
              lastEventAt: now,
              eventCount: nextEventCount,
              intelligenceFeed: [newAlert, ...state.intelligenceFeed].slice(0, 150),
            };
          }

          // ── Run-level lifecycle events ────────────────────────────────
          if (type === 'run.started') {
            const prevStats = state.statsByRun[event.correlation_id] ?? state.runStats;
            const nextStats: RunStats = {
              ...prevStats,
              status: 'running',
              total_tasks: payload.total_tasks || prevStats.total_tasks || 0,
              domain: payload.domain || prevStats.domain,
              endpoint_name: payload.endpoint_name || prevStats.endpoint_name,
              started_at: payload.started_at || now,
            };
            return {
              lastEventAt: now,
              eventCount: nextEventCount,
              statsByRun: { ...state.statsByRun, [event.correlation_id]: nextStats },
              ...(isActiveRun ? { runStats: nextStats } : {}),
            };
          }

          if (type === 'run.completed' || type === 'run.failed') {
            const prevStats = state.statsByRun[event.correlation_id] ?? state.runStats;
            const nextStats: RunStats = {
              ...prevStats,
              status: type === 'run.completed' ? 'completed' : 'failed',
              total_tasks: payload.total_tasks ?? prevStats.total_tasks,
              completed_tasks: payload.completed_tasks ?? prevStats.completed_tasks,
              successful_attacks: payload.successful_attacks ?? prevStats.successful_attacks,
              avg_risk_score: payload.avg_risk_score ?? prevStats.avg_risk_score,
              median_risk_score: payload.median_risk_score ?? prevStats.median_risk_score,
            };
            return {
              lastEventAt: now,
              eventCount: nextEventCount,
              statsByRun: { ...state.statsByRun, [event.correlation_id]: nextStats },
              ...(isActiveRun ? { runStats: nextStats } : {}),
            };
          }

          // ── Task-level telemetry events ──────────────────────────────
          const taskId = payload.task_id;
          if (!taskId) {
            return { lastEventAt: now, eventCount: nextEventCount };
          }

          const runKey = event.correlation_id;
          const runTasks = state.tasksByRun[runKey] ?? {};
          const prevGlobalTask = isActiveRun ? state.liveTasks[taskId] : runTasks[taskId];
          const updatedTask = applyEventToTasks(prevGlobalTask ?? runTasks[taskId], event);
          if (!updatedTask) return { lastEventAt: now, eventCount: nextEventCount };

          const nextRunTasks: Record<string, LiveTask> = { ...runTasks, [taskId]: updatedTask };
          // Only terminal/status-changing events affect aggregates — skip the
          // O(n) rescan for streaming noise like prompt.generated/target.queried.
          const statusChanging =
            type === 'task.dispatched' || type === 'task.completed' || type === 'task.failed' || type === 'task.error';
          const nextStats = statusChanging
            ? statsForTasks(nextRunTasks, state.statsByRun[runKey] ?? freshStats())
            : state.statsByRun[runKey] ?? freshStats();

          return {
            lastEventAt: now,
            eventCount: nextEventCount,
            tasksByRun: { ...state.tasksByRun, [runKey]: nextRunTasks },
            statsByRun: { ...state.statsByRun, [runKey]: nextStats },
            // Mirror to the flat active-run view only for the active scope.
            ...(isActiveRun
              ? { liveTasks: nextRunTasks, runStats: nextStats }
              : {}),
          };
        });
      },
    }),
    {
      name: 'valerie-pipeline-store',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        intelligenceFeed: state.intelligenceFeed,
        tasksByRun: state.tasksByRun,
        statsByRun: state.statsByRun,
      }),
    }
  )
);
