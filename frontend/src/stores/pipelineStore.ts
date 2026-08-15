import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { LiveTask, RunStats, IntelligenceAlert, VectorScores } from '../types/domain';
export type { LiveTask, RunStats, VectorScores };

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

interface PipelineState {
  activeRunId: string | null;
  activeRunMeta: ActiveRunMeta | null;
  liveTasks: Record<string, LiveTask>;
  runStats: RunStats;
  streamHealth: StreamHealth;
  lastEventAt: string | null;
  eventCount: number;
  reconnectTrigger: number;
  intelligenceFeed: IntelligenceAlert[];

  setActiveRun: (runId: string) => void;
  setActiveRunMeta: (meta: ActiveRunMeta | null) => void;
  setStreamHealth: (health: StreamHealth) => void;
  triggerReconnect: () => void;
  processEvent: (event: TaskEvent) => void;
  reset: () => void;
  clearFeed: () => void;
}

export const usePipelineStore = create<PipelineState>()(
  persist(
    (set, get) => ({
      activeRunId: null,
      activeRunMeta: null,
      liveTasks: {},
      runStats: {
        total_tasks: 0,
        completed_tasks: 0,
        successful_attacks: 0,
        defended_tasks: 0,
        unresolved_tasks: 0,
        avg_risk_score: 0,
        median_risk_score: 0,
        status: 'idle',
      },
      streamHealth: 'idle',
      lastEventAt: null,
      eventCount: 0,
      reconnectTrigger: 0,
      intelligenceFeed: [],

      setActiveRun: (runId) =>
        set((state) => ({
          activeRunId: runId,
          liveTasks: runId === state.activeRunId ? state.liveTasks : {},
          runStats:
            runId === state.activeRunId
              ? state.runStats
              : {
                  total_tasks: 0,
                  completed_tasks: 0,
                  successful_attacks: 0,
                  defended_tasks: 0,
                  unresolved_tasks: 0,
                  avg_risk_score: 0,
                  median_risk_score: 0,
                  status: 'running',
                },
        })),

      setActiveRunMeta: (meta) => set({ activeRunMeta: meta }),

      setStreamHealth: (health) => set({ streamHealth: health }),

      triggerReconnect: () =>
        set((s) => ({ reconnectTrigger: s.reconnectTrigger + 1 })),

      reset: () =>
        set({
          activeRunId: null,
          activeRunMeta: null,
          liveTasks: {},
          runStats: {
            total_tasks: 0,
            completed_tasks: 0,
            successful_attacks: 0,
            defended_tasks: 0,
            unresolved_tasks: 0,
            avg_risk_score: 0,
            median_risk_score: 0,
            status: 'idle',
          },
          eventCount: 0,
          lastEventAt: null,
        }),

      clearFeed: () => set({ intelligenceFeed: [] }),

      processEvent: (event) => {
        // Strict Phase 3 invariant: allow 'all' or exact match on correlation_id
        if (get().activeRunId !== 'all' && event.correlation_id !== get().activeRunId) {
          return;
        }

        const now = event.timestamp || new Date().toISOString();

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
              id: event.id || `${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
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
            return {
              lastEventAt: now,
              eventCount: nextEventCount,
              runStats: {
                ...state.runStats,
                status: 'running',
                total_tasks: payload.total_tasks || state.runStats.total_tasks || 0,
                domain: payload.domain || state.runStats.domain,
                endpoint_name: payload.endpoint_name || state.runStats.endpoint_name,
                started_at: payload.started_at || now,
              },
            };
          }

          if (type === 'run.completed' || type === 'run.failed') {
            return {
              lastEventAt: now,
              eventCount: nextEventCount,
              runStats: {
                ...state.runStats,
                status: type === 'run.completed' ? 'completed' : 'failed',
                total_tasks: payload.total_tasks ?? state.runStats.total_tasks,
                completed_tasks: payload.completed_tasks ?? state.runStats.completed_tasks,
                successful_attacks: payload.successful_attacks ?? state.runStats.successful_attacks,
                avg_risk_score: payload.avg_risk_score ?? state.runStats.avg_risk_score,
                median_risk_score: payload.median_risk_score ?? state.runStats.median_risk_score,
              },
            };
          }

          // ── Task-level telemetry events ──────────────────────────────
          const taskId = payload.task_id;
          if (!taskId) {
            return {
              lastEventAt: now,
              eventCount: nextEventCount,
            };
          }

          const currentTask: LiveTask = state.liveTasks[taskId] || {
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

          const updatedTask: LiveTask = {
            ...currentTask,
            last_updated: now,
          };

          switch (type) {
            case 'task.dispatched':
              updatedTask.status = 'queued';
              if (payload.prompt) updatedTask.prompt = payload.prompt;
              if (payload.technique) updatedTask.technique = payload.technique;
              if (payload.harm_type) updatedTask.harm_type = payload.harm_type;
              if (payload.endpoint_id) updatedTask.endpoint_id = payload.endpoint_id;
              break;

            case 'prompt.generated':
              updatedTask.status = 'mutating';
              updatedTask.iterations = (payload.iteration ?? updatedTask.iterations) + 1;
              if (payload.adversarial_prompt) {
                updatedTask.adversarial_prompt = payload.adversarial_prompt;
              }
              break;

            case 'target.queried':
              updatedTask.status = 'transmitting';
              break;

            case 'response.received':
              if (payload.target_response !== undefined) {
                updatedTask.target_response = String(payload.target_response);
              }
              if (payload.latency_ms !== undefined) {
                updatedTask.latency_ms = payload.latency_ms;
              }
              break;

            case 'judge.completed': {
              updatedTask.status = 'scoring';
              const verdict = payload.verdict || {};
              const risk = Number(verdict.overall_risk_score ?? payload.risk_score ?? 0);
              updatedTask.risk_score = risk;
              updatedTask.is_breakthrough = Boolean(payload.is_breakthrough || risk >= 0.7);

              const vectorScores: VectorScores = {};
              if (verdict.direct_harm !== undefined) vectorScores.direct_harm = Number(verdict.direct_harm);
              if (verdict.toxicity !== undefined) vectorScores.toxicity = Number(verdict.toxicity);
              if (verdict.pii !== undefined) vectorScores.pii = Number(verdict.pii);
              if (verdict.hallucination !== undefined) vectorScores.hallucination = Number(verdict.hallucination);
              if (verdict.policy_breach !== undefined) vectorScores.policy_breach = Number(verdict.policy_breach);
              if (verdict.novelty !== undefined) vectorScores.novelty = Number(verdict.novelty);
              if (verdict.diversity !== undefined) vectorScores.diversity = Number(verdict.diversity);
              if (verdict.realism !== undefined) vectorScores.realism = Number(verdict.realism);
              if (verdict.transferability !== undefined) vectorScores.transferability = Number(verdict.transferability);
              if (verdict.semantic_quality !== undefined) vectorScores.semantic_quality = Number(verdict.semantic_quality);
              updatedTask.vector_scores = vectorScores;

              if (verdict.rationale || verdict.rationale_summary || verdict.reasoning) {
                updatedTask.judge_reasoning = String(
                  verdict.rationale || verdict.rationale_summary || verdict.reasoning
                );
              }
              break;
            }

            case 'task.completed': {
              const isBreakthrough = Boolean(payload.is_breakthrough || updatedTask.is_breakthrough);
              updatedTask.status = isBreakthrough ? 'breakthrough' : 'defended';
              updatedTask.is_breakthrough = isBreakthrough;
              if (payload.iterations_used !== undefined) {
                updatedTask.iterations = payload.iterations_used;
              }
              if (payload.final_score !== undefined) {
                updatedTask.risk_score = Number(payload.final_score);
              }

              // Compute aggregate stats across all tasks
              const nextLiveTasks: Record<string, LiveTask> = { ...state.liveTasks, [taskId]: updatedTask };
              const allTasks: LiveTask[] = Object.values(nextLiveTasks);
              const completedCount = allTasks.filter(
                (t) => t.status === 'breakthrough' || t.status === 'defended' || t.status === 'completed'
              ).length;
              const breakthroughCount = allTasks.filter((t) => t.is_breakthrough).length;
              const defendedCount = allTasks.filter((t) => t.status === 'defended').length;
              const unresolvedCount = allTasks.filter((t) => t.status === 'unresolved' || t.status === 'failed').length;

              const validScores = allTasks.map((t) => t.risk_score).filter((s) => s > 0);
              const avgScore = validScores.length
                ? validScores.reduce((a, b) => a + b, 0) / validScores.length
                : 0;

              const sortedScores = [...validScores].sort((a, b) => a - b);
              const medianScore = sortedScores.length
                ? sortedScores[Math.floor(sortedScores.length / 2)]
                : 0;

              return {
                lastEventAt: now,
                eventCount: nextEventCount,
                liveTasks: nextLiveTasks,
                runStats: {
                  ...state.runStats,
                  completed_tasks: completedCount,
                  successful_attacks: breakthroughCount,
                  defended_tasks: defendedCount,
                  unresolved_tasks: unresolvedCount,
                  avg_risk_score: avgScore,
                  median_risk_score: medianScore,
                },
              };
            }

            case 'task.failed':
            case 'task.error':
              updatedTask.status = 'unresolved';
              updatedTask.error_message = payload.error || payload.detail || 'Execution error';
              break;
          }

          return {
            lastEventAt: now,
            eventCount: nextEventCount,
            liveTasks: {
              ...state.liveTasks,
              [taskId]: updatedTask,
            },
          };
        });
      },
    }),
    {
      name: 'valerie-pipeline-store',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ intelligenceFeed: state.intelligenceFeed }),
    }
  )
);


