/**
 * v2/Inspector.tsx
 * Precision Forensic Inspector Panel for Campaign Graph.
 * Slide-in drawer with resizable border, full mutation history, vector fingerprints,
 * judge reasoning, and deep prompt-diff lineage navigation.
 */
import { memo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  ExternalLink,
  Terminal,
  GitCommit,
} from 'lucide-react';
import { useGraphStore } from './store/graphStore';
import { usePipelineStore } from '../../../stores/pipelineStore';
import { useWorkspaceStore } from '../../../stores/workspaceStore';
import { CodeBlock, VectorScoresChart, JudgeReasoning } from '../../shared/evidence';
import type { LiveTask } from '../../../types/domain';

interface Props {
  className?: string;
}

export const Inspector = memo(function Inspector({ className = '' }: Props) {
  const inspectorOpen = useGraphStore((s) => s.inspectorOpen);
  const inspectorWidth = useGraphStore((s) => s.inspectorWidth);
  const closeInspector = useGraphStore((s) => s.closeInspector);
  const setInspectorWidth = useGraphStore((s) => s.setInspectorWidth);

  const selectedTaskId = useGraphStore((s) => s.selectedTaskId);
  const selectedMutationIter = useGraphStore((s) => s.selectedMutationIter);
  const selectedNodeId = useGraphStore((s) => s.selectedNodeId);

  const liveTasks = usePipelineStore((s) => s.liveTasks);
  const activeRunMeta = usePipelineStore((s) => s.activeRunMeta);
  const activeRunId = usePipelineStore((s) => s.activeRunId);
  const runStats = usePipelineStore((s) => s.runStats);

  const isDragging = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(inspectorWidth);

  // Resize drag handle handlers
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      isDragging.current = true;
      startX.current = e.clientX;
      startWidth.current = inspectorWidth;
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';

      const handleMouseMove = (ev: MouseEvent) => {
        if (!isDragging.current) return;
        const delta = startX.current - ev.clientX;
        setInspectorWidth(startWidth.current + delta);
      };

      const handleMouseUp = () => {
        isDragging.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };

      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    },
    [inspectorWidth, setInspectorWidth]
  );

  const selectedTask = selectedTaskId ? liveTasks[selectedTaskId] : null;

  return (
    <AnimatePresence>
      {inspectorOpen && (
        <motion.aside
          initial={{ x: '100%', opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: '100%', opacity: 0 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          style={{ width: inspectorWidth }}
          className={`absolute top-0 right-0 bottom-0 z-30 bg-ivory border-l border-hairline shadow-2xl flex flex-col pointer-events-auto ${className}`}
        >
          {/* Resize handle */}
          <div
            onMouseDown={handleMouseDown}
            className="absolute top-0 bottom-0 -left-1.5 w-3 cursor-col-resize z-40 group hover:bg-slate/10 transition-colors"
            title="Drag to resize inspector"
          >
            <div className="absolute top-1/2 left-1 -translate-y-1/2 w-0.5 h-8 bg-steel/30 group-hover:bg-slate transition-colors" />
          </div>

          {/* Inspector Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-hairline bg-parchment shrink-0">
            <div className="flex items-center gap-2">
              <Terminal size={13} className="text-slate" />
              <span className="font-mono text-[10px] font-bold tracking-widest text-slate uppercase">
                {selectedTask
                  ? `SPECIMEN #${selectedTask.task_id.slice(0, 8)}`
                  : selectedNodeId === 'campaignRoot'
                  ? 'CAMPAIGN MANIFEST'
                  : selectedNodeId
                  ? selectedNodeId.toUpperCase().replace('-', ' · ')
                  : 'FORENSIC DOSSIER'}
              </span>
            </div>
            <button
              type="button"
              onClick={closeInspector}
              className="p-1 hover:bg-linen text-steel hover:text-slate transition-colors cursor-pointer"
              aria-label="Close Inspector"
            >
              <X size={14} />
            </button>
          </div>

          {/* Content Body */}
          <div className="flex-1 overflow-y-auto divide-y divide-hairline">
            {selectedTask ? (
              <TaskInspectorDetails
                task={selectedTask}
                activeIter={selectedMutationIter}
                runId={activeRunId}
              />
            ) : selectedNodeId === 'campaignRoot' ? (
              <RootInspectorDetails
                runId={activeRunId}
                meta={activeRunMeta}
                stats={runStats}
              />
            ) : selectedNodeId?.startsWith('config-') ? (
              <ConfigInspectorDetails
                nodeKey={selectedNodeId.replace('config-', '')}
                meta={activeRunMeta}
              />
            ) : (
              <div className="p-8 text-center font-mono text-xs text-taupe">
                SELECT A NODE IN THE DAG TO INSPECT FORENSIC EVIDENCE.
              </div>
            )}
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
});

// ── 1. Task Specimen Details ──────────────────────────────────────────────────
function TaskInspectorDetails({
  task,
  activeIter,
  runId,
}: {
  task: LiveTask;
  activeIter: number | null;
  runId: string | null;
}) {
  const openPromptDiff = useWorkspaceStore((s) => s.openPromptDiff);
  const selectMutation = useGraphStore((s) => s.selectMutation);

  const totalIterations = Math.max(1, task.iterations ?? 1);
  const displayedIter = activeIter ?? totalIterations;
  const iterRecord =
    activeIter !== null && task.iterations_history
      ? task.iterations_history[activeIter - 1]
      : undefined;

  const promptText =
    iterRecord?.adversarial_prompt ||
    task.adversarial_prompt ||
    task.prompt ||
    'NO ADVERSARIAL PROMPT RECORDED.';
  const responseText =
    iterRecord?.target_response || task.target_response || 'NO TARGET RESPONSE RECORDED.';
  const judgeRationale = iterRecord?.judge_reasoning || task.judge_reasoning;
  const vectorScores = iterRecord?.vector_scores || task.vector_scores;
  const currentRisk = iterRecord?.risk_score ?? task.risk_score ?? 0;

  const handleOpenDiffModal = () => {
    if (runId && task.task_id) {
      openPromptDiff(runId, task.task_id);
    }
  };

  return (
    <div className="p-4 space-y-5">
      {/* Status & Telemetry Header */}
      <div className="bg-parchment p-3 border border-hairline">
        <div className="flex items-center justify-between mb-2">
          <span className="font-mono text-[9px] font-bold text-taupe uppercase tracking-wider">
            {task.harm_type || 'GENERAL SAFETY'}
          </span>
          <span
            className={`font-mono text-[9px] font-bold uppercase px-2 py-0.5 ${
              task.is_breakthrough
                ? 'bg-maroon-muted text-maroon border border-maroon/30'
                : task.status === 'defended' || task.status === 'completed'
                ? 'bg-olive-muted text-olive border border-olive/30'
                : 'bg-linen text-steel border border-hairline'
            }`}
          >
            {task.status.toUpperCase()}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-hairline/60">
          <div>
            <div className="font-mono text-[7px] text-taupe uppercase">TECHNIQUE</div>
            <div className="font-mono text-[10px] font-bold text-slate truncate">
              {task.technique?.replace(/_/g, ' ') || '—'}
            </div>
          </div>
          <div>
            <div className="font-mono text-[7px] text-taupe uppercase">RISK SCORE</div>
            <div
              className={`font-mono text-[11px] font-bold tabular-nums ${
                currentRisk >= 0.7
                  ? 'text-maroon'
                  : currentRisk >= 0.4
                  ? 'text-camel'
                  : 'text-olive'
              }`}
            >
              {currentRisk.toFixed(2)}
            </div>
          </div>
          <div>
            <div className="font-mono text-[7px] text-taupe uppercase">ITERATIONS</div>
            <div className="font-mono text-[11px] font-bold text-slate">
              {task.iterations ?? 0} / {task.max_iterations ?? 3}
            </div>
          </div>
        </div>
      </div>

      {/* Iteration Selector Pill Strip */}
      {totalIterations > 1 && (
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="font-mono text-[9px] font-bold text-taupe uppercase tracking-wider">
              MUTATION ITERATION SNAPSHOT
            </span>
            <span className="font-mono text-[9px] text-steel">
              VIEWING ITER #{displayedIter}
            </span>
          </div>
          <div className="flex flex-wrap gap-1">
            {Array.from({ length: totalIterations }, (_, i) => i + 1).map((iterNum) => {
              const isSelected = displayedIter === iterNum;
              return (
                <button
                  key={iterNum}
                  type="button"
                  onClick={() => selectMutation(task.task_id, iterNum)}
                  className={`px-2.5 py-1 font-mono text-[9px] font-bold uppercase transition-colors cursor-pointer border ${
                    isSelected
                      ? 'bg-slate text-parchment border-slate'
                      : 'bg-linen text-steel border-hairline hover:border-steel hover:text-slate'
                  }`}
                >
                  ITER {iterNum}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Adversarial Prompt Specimen */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="font-mono text-[9px] font-bold text-slate uppercase tracking-wider">
            ADVERSARIAL PROMPT SPECIMEN
          </span>
          <span className="font-mono text-[8px] text-taupe">ITER #{displayedIter}</span>
        </div>
        <CodeBlock text={promptText} label="adversarial prompt" />
      </div>

      {/* Target Model Response */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="font-mono text-[9px] font-bold text-slate uppercase tracking-wider">
            TARGET MODEL RESPONSE
          </span>
          {task.latency_ms && (
            <span className="font-mono text-[8px] text-taupe">
              {task.latency_ms.toFixed(0)}ms
            </span>
          )}
        </div>
        <CodeBlock text={responseText} label="target response" />
      </div>

      {/* Safety Judge Verdict & Rationale */}
      <div>
        <span className="block font-mono text-[9px] font-bold text-slate uppercase tracking-wider mb-1.5">
          SAFETY JUDGE RATIONALE
        </span>
        <div className="bg-parchment p-3 border border-hairline">
          <JudgeReasoning reasoning={judgeRationale} />
        </div>
      </div>

      {/* Multi-Objective Vector Fingerprint */}
      <div>
        <span className="block font-mono text-[9px] font-bold text-slate uppercase tracking-wider mb-1.5">
          MULTI-OBJECTIVE VECTOR SCORES
        </span>
        <div className="bg-parchment p-3 border border-hairline">
          <VectorScoresChart scores={vectorScores} />
        </div>
      </div>

      {/* Lineage Trace & Prompt Diff Navigation */}
      <div className="pt-2">
        <button
          type="button"
          onClick={handleOpenDiffModal}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-slate text-parchment font-mono text-[10px] font-bold uppercase tracking-wider hover:bg-slate/90 transition-colors cursor-pointer shadow-xs"
        >
          <GitCommit size={13} className="text-powder" />
          <span>VIEW COMPLETE PROMPT EVOLUTION DIFF</span>
          <ExternalLink size={11} className="text-taupe" />
        </button>
      </div>
    </div>
  );
}

// ── 2. Campaign Root Details ──────────────────────────────────────────────────
function RootInspectorDetails({
  runId,
  meta,
  stats,
}: {
  runId: string | null;
  meta: any;
  stats: any;
}) {
  return (
    <div className="p-4 space-y-4 font-sans">
      <div className="bg-parchment p-3 border border-hairline space-y-2">
        <span className="font-mono text-[9px] font-bold text-taupe uppercase tracking-wider">
          CAMPAIGN IDENTIFIERS
        </span>
        <div className="font-mono text-xs text-slate break-all">
          RUN ID: {runId || '—'}
        </div>
        <div className="font-mono text-xs text-slate">
          DOMAIN: {meta?.domain?.toUpperCase() || 'GENERAL'}
        </div>
        <div className="font-mono text-xs text-slate">
          STARTED: {meta?.started_at ? new Date(meta.started_at).toLocaleString() : '—'}
        </div>
      </div>

      <div className="bg-parchment p-3 border border-hairline space-y-2">
        <span className="font-mono text-[9px] font-bold text-taupe uppercase tracking-wider">
          AGGREGATED TELEMETRY
        </span>
        <div className="grid grid-cols-2 gap-3 pt-1">
          <div>
            <div className="font-mono text-[8px] text-taupe">TOTAL TASKS</div>
            <div className="font-mono text-sm font-bold text-slate">{stats.total_tasks}</div>
          </div>
          <div>
            <div className="font-mono text-[8px] text-taupe">SUCCESSFUL BREACHES</div>
            <div className="font-mono text-sm font-bold text-maroon">{stats.successful_attacks}</div>
          </div>
          <div>
            <div className="font-mono text-[8px] text-taupe">DEFENDED SPECIMENS</div>
            <div className="font-mono text-sm font-bold text-olive">{stats.defended_tasks ?? 0}</div>
          </div>
          <div>
            <div className="font-mono text-[8px] text-taupe">MEAN RISK SCORE</div>
            <div className="font-mono text-sm font-bold tabular-nums text-slate">
              {(stats.avg_risk_score ?? 0).toFixed(2)}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-parchment p-3 border border-hairline space-y-1.5">
        <span className="font-mono text-[9px] font-bold text-taupe uppercase tracking-wider">
          TECHNIQUES IN SWEEP
        </span>
        <div className="flex flex-wrap gap-1 pt-1">
          {meta?.selected_techniques?.map((tech: string) => (
            <span
              key={tech}
              className="font-mono text-[9px] bg-linen px-2 py-0.5 border border-hairline uppercase text-slate"
            >
              {tech.replace(/_/g, ' ')}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── 3. Config Node Details ────────────────────────────────────────────────────
function ConfigInspectorDetails({
  nodeKey,
  meta,
}: {
  nodeKey: string;
  meta: any;
}) {
  const isAttacker = nodeKey === 'attacker';
  const isTarget = nodeKey === 'target';
  const isJudge = nodeKey === 'judge';

  return (
    <div className="p-4 space-y-4 font-sans">
      <div className="bg-parchment p-3 border border-hairline space-y-2">
        <span className="font-mono text-[9px] font-bold text-taupe uppercase tracking-wider">
          {nodeKey.toUpperCase()} CONFIGURATION
        </span>
        <div className="font-mono text-sm font-bold text-slate">
          {isAttacker
            ? meta?.attacker_model || 'DEFAULT ATTACKER'
            : isTarget
            ? meta?.endpoint_name || meta?.endpoint_id || 'DEFAULT TARGET'
            : meta?.judge_model || 'DEFAULT JUDGE'}
        </div>
      </div>

      <div className="bg-parchment p-3 border border-hairline space-y-2">
        <span className="font-mono text-[9px] font-bold text-taupe uppercase tracking-wider">
          RUNTIME PARAMETERS
        </span>
        <dl className="space-y-1.5 font-mono text-[10px]">
          {isAttacker && (
            <>
              <div className="flex justify-between">
                <dt className="text-taupe">MAX ITERATIONS:</dt>
                <dd className="text-slate font-bold">{meta?.max_iterations ?? 3}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-taupe">MUTATION STRATEGY:</dt>
                <dd className="text-slate">MULTI-TECHNIQUE SEED</dd>
              </div>
            </>
          )}
          {isTarget && (
            <>
              <div className="flex justify-between">
                <dt className="text-taupe">DOMAIN:</dt>
                <dd className="text-slate font-bold">{meta?.domain?.toUpperCase() ?? 'GENERAL'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-taupe">ENDPOINT ID:</dt>
                <dd className="text-slate truncate max-w-[160px]">{meta?.endpoint_id ?? '—'}</dd>
              </div>
            </>
          )}
          {isJudge && (
            <>
              <div className="flex justify-between">
                <dt className="text-taupe">SCORING METHOD:</dt>
                <dd className="text-slate">HARMONIC MEAN MULTI-OBJECTIVE</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-taupe">RISK THRESHOLD:</dt>
                <dd className="text-slate font-bold">0.70 (BREACH CUTOFF)</dd>
              </div>
            </>
          )}
        </dl>
      </div>
    </div>
  );
}
