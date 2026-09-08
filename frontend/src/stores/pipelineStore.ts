import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { LiveTask, RunStats, IntelligenceAlert, VectorScores, HistoricalTaskResult, IterationRecord } from '../types/domain';
export type { LiveTask, RunStats, VectorScores, HistoricalTaskResult, IterationRecord };

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
      if (payload.max_iterations) updated.max_iterations = payload.max_iterations;
      break;

    case 'prompt.generated': {
      updated.status = 'mutating';
      const iterNum = (payload.iteration ?? (updated.iterations ? updated.iterations - 1 : 0)) + 1;
      updated.iterations = iterNum;
      if (payload.adversarial_prompt) updated.adversarial_prompt = payload.adversarial_prompt;

      const history = [...(updated.iterations_history || [])];
      const existingIdx = history.findIndex((h) => h.iteration === iterNum);
      if (existingIdx >= 0) {
        history[existingIdx] = { ...history[existingIdx], adversarial_prompt: payload.adversarial_prompt };
      } else {
        history.push({ iteration: iterNum, adversarial_prompt: payload.adversarial_prompt });
      }
      updated.iterations_history = history;
      break;
    }

    case 'target.queried':
      updated.status = 'transmitting';
      break;

    case 'response.received': {
      const iterNum = (payload.iteration ?? (updated.iterations ? updated.iterations - 1 : 0)) + 1;
      if (payload.target_response !== undefined) updated.target_response = String(payload.target_response);
      if (payload.latency_ms !== undefined) updated.latency_ms = payload.latency_ms;

      const history = [...(updated.iterations_history || [])];
      const existingIdx = history.findIndex((h) => h.iteration === iterNum);
      if (existingIdx >= 0) {
        history[existingIdx] = { ...history[existingIdx], target_response: String(payload.target_response) };
      } else {
        history.push({ iteration: iterNum, target_response: String(payload.target_response) });
      }
      updated.iterations_history = history;
      break;
    }

    case 'judge.completed': {
      updated.status = 'scoring';
      const iterNum = (payload.iteration ?? (updated.iterations ? updated.iterations - 1 : 0)) + 1;
      const verdict = payload.verdict || {};
      const risk = Number(verdict.overall_risk_score ?? payload.risk_score ?? 0);
      updated.risk_score = risk;
      updated.is_breakthrough = Boolean(payload.is_breakthrough || risk >= 0.7);
      const vs: VectorScores = {};
      const dims = ['direct_harm','toxicity','pii','hallucination','policy_breach',
                     'novelty','diversity','realism','transferability','semantic_quality'] as const;
      dims.forEach(d => { if (verdict[d] !== undefined) vs[d] = Number(verdict[d]); });
      updated.vector_scores = vs;
      if (verdict.rationale || verdict.rationale_summary || verdict.reasoning || verdict.safety_concern) {
        updated.judge_reasoning = String(verdict.rationale || verdict.rationale_summary || verdict.reasoning || verdict.safety_concern);
      }

      const history = [...(updated.iterations_history || [])];
      const existingIdx = history.findIndex((h) => h.iteration === iterNum);
      const iterRecord: IterationRecord = {
        iteration: iterNum,
        adversarial_prompt: updated.adversarial_prompt,
        target_response: updated.target_response,
        risk_score: risk,
        vector_scores: vs,
        judge_reasoning: updated.judge_reasoning,
      };
      if (existingIdx >= 0) {
        history[existingIdx] = { ...history[existingIdx], ...iterRecord };
      } else {
        history.push(iterRecord);
      }
      updated.iterations_history = history;
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
  completed_at?: string;
  attacker_model?: string;
  judge_model?: string;
  selected_techniques?: string[];
  max_iterations?: number;
  status?: string;
  error_message?: string;
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
  processEventsBatch: (events: TaskEvent[]) => void;
  hydrateRunResults: (runId: string, results: HistoricalTaskResult[]) => void;
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
  
  const isAllComplete = all.length > 0 && completedCount === all.length;
  const derivedStatus = isAllComplete ? 'completed' : prev.status;

  return {
    ...prev,
    status: derivedStatus,
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

      setStreamHealth: (health) =>
        set((state) => (state.streamHealth === health ? state : { streamHealth: health })),

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

      hydrateRunResults: (runId, results) => {
        const newTasks: Record<string, LiveTask> = {};
        const now = new Date().toISOString();

        results.forEach((r, idx) => {
          const taskId = r.task_id || r.id || `task-${idx}`;
          const isBreakthrough = r.is_breakthrough ?? ((r.overall_risk_score ?? 0) >= 0.7);
          const score = r.overall_risk_score ?? 0;
          const iters = r.iterations ?? (Array.isArray(r.iterations_history) ? r.iterations_history.length : 1);

          newTasks[taskId] = {
            task_id: taskId,
            run_id: runId,
            harm_type: r.harm_type || 'general',
            technique: r.technique_id || r.technique || 'unknown',
            harm_type_group: r.harm_type_group || r.harm_type || r.technique_id || r.technique,
            status: isBreakthrough ? 'breakthrough' : 'defended',
            iterations: iters,
            max_iterations: Math.max(iters, r.max_iterations || 3),
            risk_score: score,
            is_breakthrough: isBreakthrough,
            adversarial_prompt: r.adversarial_prompt || '',
            target_response: r.target_response || '',
            judge_reasoning: r.judge_reasoning || r.evaluator_critique || '',
            vector_scores: r.vector_scores || r.vector,
            iterations_history: r.iterations_history || [],
            lineage_chain: r.lineage_chain || [],
            judge_verdict: r.judge_verdict,
            prompt: r.adversarial_prompt || '',
            created_at: r.created_at || now,
            last_updated: now,
          };
        });

        set((state) => {
          const currentStats = state.statsByRun[runId] ?? freshStats('completed');
          const computed = statsForTasks(newTasks, currentStats);
          const isCurrentActive = state.activeRunId === runId;

          return {
            tasksByRun: { ...state.tasksByRun, [runId]: newTasks },
            statsByRun: { ...state.statsByRun, [runId]: computed },
            liveTasks: isCurrentActive ? newTasks : state.liveTasks,
            runStats: isCurrentActive ? computed : state.runStats,
          };
        });
      },

      processEvent: (event) => {
        get().processEventsBatch([event]);
      },

      processEventsBatch: (events) => {
        if (!events || events.length === 0) return;

        const tracked = get().trackedRuns;
        const validEvents = events.filter((event) => {
          if (tracked === null) return true;
          return tracked.includes('all') || tracked.includes(event.correlation_id);
        });
        if (validEvents.length === 0) return;

        const activeRunId = get().activeRunId;
        const isGlobal = !activeRunId || activeRunId === 'all';

        set((state) => {
          let nextLastEventAt = state.lastEventAt;
          let nextEventCount = state.eventCount;
          let nextActiveRunMeta = state.activeRunMeta;

          let tasksByRun = state.tasksByRun;
          let statsByRun = state.statsByRun;
          let liveTasks = state.liveTasks;
          let runStats = state.runStats;

          let tasksByRunMutated = false;
          let statsByRunMutated = false;
          let liveTasksMutated = false;

          const statusChangingRuns = new Set<string>();
          const newAlerts: IntelligenceAlert[] = [];

          for (const event of validEvents) {
            nextEventCount++;
            const now = event.timestamp || new Date().toISOString();
            nextLastEventAt = now;
            const { type, payload, correlation_id } = event;
            const isActiveRun = isGlobal || correlation_id === activeRunId;

            // Intelligence / Anomaly / Breakthrough Alerts
            const isBreakthroughJudge =
              type === 'judge.completed' &&
              Boolean(payload?.verdict?.is_breakthrough || (payload?.verdict?.overall_risk_score && Number(payload.verdict.overall_risk_score) >= 0.70));

            const isBreakthroughFinding =
              type === 'finding.created' &&
              Boolean(
                payload?.is_breakthrough ||
                (payload?.score !== undefined && Number(payload.score) >= 0.70) ||
                (payload?.verdict?.overall_risk_score !== undefined && Number(payload.verdict.overall_risk_score) >= 0.70) ||
                payload?.severity === 'critical'
              );

            if (
              type === 'anomaly.detected' ||
              type === 'weakness.discovered' ||
              type === 'cluster_formed' ||
              type === 'rate_limit' ||
              type === 'run.failed' ||
              isBreakthroughFinding ||
              isBreakthroughJudge
            ) {
              let message = payload?.message || 'Intelligence update received';
              let severity: 'info' | 'warning' | 'high' | 'critical' = 'info';

              if (type === 'anomaly.detected') {
                message = payload?.message || 'Execution Outlier / Anomaly Detected';
                severity = 'high';
              } else if (type === 'weakness.discovered' || type === 'cluster_formed') {
                message = payload?.message || 'New Weakness Cluster Identified';
                severity = 'info';
              } else if (type === 'rate_limit') {
                message = payload?.message || 'Target Endpoint Rate Limit Reached';
                severity = 'warning';
              } else if (type === 'run.failed') {
                message = `Campaign Failure: ${payload?.error || payload?.error_message || 'Sweep terminated'}`;
                severity = 'critical';
              } else if (isBreakthroughJudge || isBreakthroughFinding) {
                const score = payload?.verdict?.overall_risk_score ?? payload?.score ?? 0.85;
                message = `Confirmed Breakthrough · Risk Score ${Number(score).toFixed(2)}`;
                severity = 'critical';
              }

              newAlerts.push({
                id: event.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                type,
                severity,
                timestamp: now,
                message,
                payload: payload || {},
                task_id: payload?.task_id,
                run_id: correlation_id,
              });
            }

            // Run-level lifecycle events
            if (type === 'run.started') {
              if (!statsByRunMutated) { statsByRun = { ...statsByRun }; statsByRunMutated = true; }
              const prevStats = statsByRun[correlation_id] ?? (isActiveRun ? runStats : freshStats());
              const nextStats: RunStats = {
                ...prevStats,
                status: 'running',
                total_tasks: payload.total_tasks || prevStats.total_tasks || 0,
                domain: payload.domain || prevStats.domain,
                endpoint_name: payload.endpoint_name || prevStats.endpoint_name,
                started_at: payload.started_at || now,
              };
              statsByRun[correlation_id] = nextStats;
              if (isActiveRun) runStats = nextStats;
            }

            if (type === 'run.completed' || type === 'run.failed') {
              if (!statsByRunMutated) { statsByRun = { ...statsByRun }; statsByRunMutated = true; }
              const prevStats = statsByRun[correlation_id] ?? (isActiveRun ? runStats : freshStats());
              const statusVal = type === 'run.completed' ? 'completed' : 'failed';
              const nextStats: RunStats = {
                ...prevStats,
                status: statusVal,
                total_tasks: payload.total_tasks ?? prevStats.total_tasks,
                completed_tasks: payload.completed_tasks ?? prevStats.completed_tasks,
                successful_attacks: payload.successful_attacks ?? prevStats.successful_attacks,
                avg_risk_score: payload.avg_risk_score ?? prevStats.avg_risk_score,
                median_risk_score: payload.median_risk_score ?? prevStats.median_risk_score,
              };
              statsByRun[correlation_id] = nextStats;
              if (isActiveRun) {
                runStats = nextStats;
                if (nextActiveRunMeta) {
                  nextActiveRunMeta = { ...nextActiveRunMeta, status: statusVal };
                }
              }
            }

            // Task-level telemetry events
            const taskId = payload.task_id;
            if (taskId) {
              if (!tasksByRunMutated) { tasksByRun = { ...tasksByRun }; tasksByRunMutated = true; }
              const runTasks = tasksByRun[correlation_id] ? { ...tasksByRun[correlation_id] } : {};
              const prevTask = runTasks[taskId] ?? (isActiveRun ? liveTasks[taskId] : undefined);
              const updatedTask = applyEventToTasks(prevTask, event);
              if (updatedTask) {
                runTasks[taskId] = updatedTask;
                tasksByRun[correlation_id] = runTasks;
                if (isActiveRun) {
                  if (!liveTasksMutated) { liveTasks = { ...liveTasks }; liveTasksMutated = true; }
                  liveTasks[taskId] = updatedTask;
                }
                if (
                  type === 'task.dispatched' ||
                  type === 'task.completed' ||
                  type === 'task.failed' ||
                  type === 'task.error'
                ) {
                  statusChangingRuns.add(correlation_id);
                }
              }
            }
          }

          // Recalculate stats only once per run affected by terminal status changes
          if (statusChangingRuns.size > 0) {
            if (!statsByRunMutated) { statsByRun = { ...statsByRun }; statsByRunMutated = true; }
            for (const runKey of statusChangingRuns) {
              const runTasks = tasksByRun[runKey] ?? {};
              const currentStats = statsByRun[runKey] ?? freshStats();
              const nextStats = statsForTasks(runTasks, currentStats);
              statsByRun[runKey] = nextStats;
              if (activeRunId === 'all' || activeRunId === runKey) {
                runStats = statsForTasks(liveTasks, runStats);
              }
            }
          }

          let nextIntelligenceFeed = state.intelligenceFeed;
          if (newAlerts.length > 0) {
            const alertIds = new Set(newAlerts.map((a) => a.id));
            nextIntelligenceFeed = [...newAlerts, ...state.intelligenceFeed.filter((a) => !alertIds.has(a.id))].slice(0, 150);
          }

          return {
            lastEventAt: nextLastEventAt,
            eventCount: nextEventCount,
            intelligenceFeed: nextIntelligenceFeed,
            activeRunMeta: nextActiveRunMeta,
            tasksByRun,
            statsByRun,
            liveTasks,
            runStats,
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
