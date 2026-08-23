/**
 * v2/Inspector.tsx
 * Xcode-style variable inspector panel (right side).
 * Collapsible sections with localStorage-persisted expansion state.
 * Slide-in animation via framer-motion. Resize handle on left edge.
 *
 * Store reads: graphStore.selectedTaskId, graphStore.selectedMutationIter,
 *              graphStore.selectedNodeId, graphStore.inspectorOpen,
 *              graphStore.inspectorWidth, graphStore.sectionExpansion,
 *              pipelineStore.liveTasks, pipelineStore.activeRunMeta, pipelineStore.runStats
 * Store writes: graphStore.closeInspector, graphStore.toggleSection, graphStore.setInspectorWidth
 */
import { memo, useCallback, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { X, ChevronDown, ChevronRight } from 'lucide-react';
import { useGraphStore } from './store/graphStore';
import { usePipelineStore } from '../../../stores/pipelineStore';
import type { LiveTask } from '../../../types/domain';
import { CodeBlock, VectorScoresChart } from '../../shared/evidence';

// ── Section animation ─────────────────────────────────────────────────────────
const sectionExpand = {
  collapsed: { height: 0, opacity: 0, overflow: 'hidden', transition: { duration: 0.2 } },
  expanded: { height: 'auto', opacity: 1, overflow: 'hidden', transition: { duration: 0.25 } },
};

// ── Section component ─────────────────────────────────────────────────────────
function Section({
  sectionKey, title, defaultOpen = false, children,
}: {
  sectionKey: string; title: string; defaultOpen?: boolean; children: React.ReactNode;
}) {
  const sectionExpansion = useGraphStore(s => s.sectionExpansion);
  const toggleSection = useGraphStore(s => s.toggleSection);
  const isOpen = sectionKey in sectionExpansion ? sectionExpansion[sectionKey] : defaultOpen;

  return (
    <div className="border-b border-hairline">
      <button
        onClick={() => toggleSection(sectionKey)}
        className="w-full flex items-center gap-2 px-4 py-2 hover:bg-parchment transition-colors text-left"
        aria-expanded={isOpen}
      >
        {isOpen
          ? <ChevronDown size={10} className="text-taupe flex-shrink-0" />
          : <ChevronRight size={10} className="text-taupe flex-shrink-0" />
        }
        <span className="font-mono text-[10px] font-bold tracking-widest uppercase text-taupe">
          {title}
        </span>
      </button>
      <motion.div
        variants={sectionExpand}
        initial={isOpen ? 'expanded' : 'collapsed'}
        animate={isOpen ? 'expanded' : 'collapsed'}
      >
        <div className="px-4 pb-3">
          {children}
        </div>
      </motion.div>
    </div>
  );
}

// ── Task Inspector sections ───────────────────────────────────────────────────
function TaskInspector({ task, iter }: { task: LiveTask; iter?: number | null }) {
  const iterRecord = iter !== null && iter !== undefined
    ? task.iterations_history?.[iter - 1]
    : undefined;

  const prompt = iterRecord?.adversarial_prompt ?? task.adversarial_prompt;
  const response = iterRecord?.target_response ?? task.target_response;
  const reasoning = iterRecord?.judge_reasoning ?? task.judge_reasoning;
  const vectorScores = iterRecord?.vector_scores ?? task.vector_scores;

  return (
    <>
      <Section sectionKey="task.status" title="Status" defaultOpen>
        <div className="space-y-1">
          <div className={`inline-block font-mono text-[10px] font-bold tracking-wider px-2 py-0.5 ${
            task.status === 'breakthrough' ? 'bg-maroon-muted text-maroon' :
            task.status === 'defended' || task.status === 'completed' ? 'bg-olive-muted text-olive' :
            'bg-linen text-steel'
          }`}>
            {task.status.toUpperCase()}
          </div>
          {task.is_breakthrough && (
            <div className="font-mono text-[9px] text-maroon tracking-wider mt-1">◆ BREAKTHROUGH</div>
          )}
          {iter !== null && iter !== undefined && (
            <div className="font-mono text-[9px] text-taupe mt-1">
              ITERATION {iter} OF {task.iterations}
            </div>
          )}
        </div>
      </Section>

      <Section sectionKey="task.params" title="Parameters">
        <dl className="space-y-1.5">
          {([
            ['Technique', task.technique.replace(/_/g, ' ')],
            ['Harm Type', task.harm_type.replace(/_/g, ' ')],
            ['Max Iter', String(task.max_iterations ?? '—')],
            ['Risk Score', task.risk_score ? task.risk_score.toFixed(3) : '—'],
            ['Iterations', String(task.iterations)],
            ...(task.latency_ms ? [['Latency', `${task.latency_ms}ms`]] : []),
          ] as [string, string][]).map(([k, v]) => (
            <div key={k} className="flex justify-between gap-2">
              <dt className="font-mono text-[9px] text-taupe">{k}</dt>
              <dd className="font-mono text-[10px] text-slate font-medium text-right">{v}</dd>
            </div>
          ))}
        </dl>
      </Section>

      {prompt && (
        <Section sectionKey="task.adversarial_prompt" title="Adversarial Prompt" defaultOpen>
          <CodeBlock text={prompt} label="prompt" />
        </Section>
      )}

      {response && (
        <Section sectionKey="task.target_response" title="Target Response">
          <CodeBlock text={response} label="response" />
        </Section>
      )}

      {vectorScores && Object.keys(vectorScores).length > 0 && (
        <Section sectionKey="task.vector_scores" title="Vector Scores" defaultOpen>
          <VectorScoresChart scores={vectorScores} />
        </Section>
      )}

      {reasoning && (
        <Section sectionKey="task.judge_reasoning" title="Judge Reasoning">
          <blockquote className="font-sans text-xs text-slate italic leading-relaxed border-l-2 border-camel pl-3">
            {reasoning}
          </blockquote>
        </Section>
      )}

      <Section sectionKey="task.timing" title="Timing">
        <dl className="space-y-1">
          {([
            ['Created', task.created_at ? new Date(task.created_at).toLocaleTimeString() : '—'],
            ['Updated', new Date(task.last_updated).toLocaleTimeString()],
            ...(task.latency_ms ? [['Latency', `${task.latency_ms}ms`]] : []),
          ] as [string, string][]).map(([k, v]) => (
            <div key={k} className="flex justify-between">
              <dt className="font-mono text-[9px] text-taupe">{k}</dt>
              <dd className="font-mono text-[9px] text-slate">{v}</dd>
            </div>
          ))}
        </dl>
      </Section>

      {task.lineage_chain && task.lineage_chain.length > 0 && (
        <Section sectionKey="task.lineage" title="Lineage">
          <div className="flex items-center gap-1 flex-wrap">
            {task.lineage_chain.map((node, i) => (
              <span key={i} className="font-mono text-[9px] text-steel">
                {node.label}{i < task.lineage_chain!.length - 1 ? ' → ' : ''}
              </span>
            ))}
          </div>
        </Section>
      )}
    </>
  );
}

// ── Root inspector ────────────────────────────────────────────────────────────
function RootInspector() {
  const meta = usePipelineStore(s => s.activeRunMeta);
  const runStats = usePipelineStore(s => s.runStats);

  return (
    <>
      <Section sectionKey="root.config" title="Configuration" defaultOpen>
        <dl className="space-y-1.5">
          {([
            ['Domain', meta?.domain?.toUpperCase() ?? '—'],
            ['Attacker', meta?.attacker_model ?? '—'],
            ['Judge', meta?.judge_model ?? '—'],
            ['Target', meta?.endpoint_name ?? meta?.endpoint_id ?? '—'],
            ['Max Iter', String(meta?.max_iterations ?? '—')],
            ['Techniques', String(meta?.selected_techniques?.length ?? '—')],
          ] as [string, string][]).map(([k, v]) => (
            <div key={k} className="flex justify-between gap-2">
              <dt className="font-mono text-[9px] text-taupe">{k}</dt>
              <dd className="font-mono text-[10px] text-slate font-medium text-right break-all">{v}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section sectionKey="root.summary" title="Summary Statistics" defaultOpen>
        <div className="grid grid-cols-2 gap-2">
          {([
            ['TOTAL', runStats.total_tasks, 'text-slate'],
            ['BREACHES', runStats.successful_attacks, 'text-maroon'],
            ['DEFENDED', runStats.defended_tasks ?? 0, 'text-olive'],
            ['AVG RISK', (runStats.avg_risk_score ?? 0).toFixed(2), 'text-camel'],
          ] as [string, number | string, string][]).map(([label, val, cls]) => (
            <div key={label}>
              <div className="font-mono text-[7px] text-taupe tracking-wider">{label}</div>
              <div className={`font-mono text-base font-bold ${cls}`}>{val}</div>
            </div>
          ))}
        </div>
      </Section>
    </>
  );
}

// ── Config inspector ──────────────────────────────────────────────────────────
function ConfigInspector({ nodeId }: { nodeId: string }) {
  const meta = usePipelineStore(s => s.activeRunMeta);
  const key = nodeId.replace('config-', '') as 'attacker' | 'judge' | 'target';
  const value = key === 'attacker' ? meta?.attacker_model :
                key === 'judge' ? meta?.judge_model :
                meta?.endpoint_name ?? meta?.endpoint_id;

  return (
    <Section sectionKey={`config.${key}`} title="Model Info" defaultOpen>
      <dl className="space-y-1.5">
        <div className="flex justify-between">
          <dt className="font-mono text-[9px] text-taupe">Role</dt>
          <dd className="font-mono text-[10px] text-slate font-bold">{key.toUpperCase()}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="font-mono text-[9px] text-taupe">Model</dt>
          <dd className="font-mono text-[10px] text-slate break-all text-right">{value ?? '—'}</dd>
        </div>
      </dl>
    </Section>
  );
}

// ── Multi-select view ─────────────────────────────────────────────────────────
function MultiSelectInspector() {
  const multiSelectedIds = useGraphStore(s => s.multiSelectedIds);
  const selectTask = useGraphStore(s => s.selectTask);

  return (
    <div className="px-4 pt-4">
      <p className="font-mono text-[10px] text-taupe tracking-wider mb-3">
        {multiSelectedIds.length} NODES SELECTED
      </p>
      <div className="space-y-1">
        {multiSelectedIds.map(id => (
          <button
            key={id}
            onClick={() => selectTask(id)}
            className="w-full text-left font-mono text-[10px] text-slate hover:text-maroon transition-colors py-1 border-b border-hairline"
          >
            {id.slice(0, 16)}…
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Main Inspector ────────────────────────────────────────────────────────────
export const Inspector = memo(function Inspector() {
  const selectedTaskId = useGraphStore(s => s.selectedTaskId);
  const selectedMutationIter = useGraphStore(s => s.selectedMutationIter);
  const selectedNodeId = useGraphStore(s => s.selectedNodeId);
  const multiSelectedIds = useGraphStore(s => s.multiSelectedIds);
  const inspectorOpen = useGraphStore(s => s.inspectorOpen);
  const inspectorWidth = useGraphStore(s => s.inspectorWidth);
  const closeInspector = useGraphStore(s => s.closeInspector);
  const setInspectorWidth = useGraphStore(s => s.setInspectorWidth);
  const liveTasks = usePipelineStore(s => s.liveTasks);
  const reducedMotion = useReducedMotion();

  const selectedTask = selectedTaskId ? liveTasks[selectedTaskId] : null;

  // Resize handle drag
  const dragging = useRef(false);
  const startX = useRef(0);
  const startW = useRef(inspectorWidth);

  const onResizeStart = useCallback((e: React.MouseEvent) => {
    dragging.current = true;
    startX.current = e.clientX;
    startW.current = inspectorWidth;

    const onMove = (ev: MouseEvent) => {
      if (!dragging.current) return;
      const delta = startX.current - ev.clientX;
      setInspectorWidth(startW.current + delta);
    };
    const onUp = () => {
      dragging.current = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [inspectorWidth, setInspectorWidth]);

  // Determine what to show
  const showMultiSelect = multiSelectedIds.length >= 2;
  const nodeType = selectedTaskId ? 'task' :
                   selectedNodeId?.startsWith('config-') ? 'config' :
                   selectedNodeId === 'root' ? 'root' : null;

  const headerLabel = selectedTaskId
    ? (selectedMutationIter ? `ITER ${selectedMutationIter} · ` : '') + selectedTaskId.slice(0, 12)
    : selectedNodeId === 'root' ? 'CAMPAIGN ROOT'
    : selectedNodeId?.replace('config-', '')?.toUpperCase() ?? 'INSPECTOR';

  return (
    <AnimatePresence>
      {inspectorOpen && (
        <motion.aside
          key="inspector"
          initial={reducedMotion ? false : { x: 24, opacity: 0 }}
          animate={reducedMotion ? {} : { x: 0, opacity: 1, transition: { duration: 0.25, ease: 'easeOut' } }}
          exit={reducedMotion ? {} : { x: 24, opacity: 0, transition: { duration: 0.2, ease: 'easeIn' } }}
          className="absolute top-0 right-0 h-full bg-ivory border-l border-hairline flex flex-col z-20 shadow-lg"
          style={{ width: inspectorWidth }}
          role="region"
          aria-label="Node detail inspector"
        >
          {/* Resize handle */}
          <div
            className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-hairline/50 transition-colors"
            onMouseDown={onResizeStart}
            aria-hidden="true"
          />

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-slate text-parchment flex-shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              {nodeType === 'task' && (
                <span className="font-mono text-[8px] text-taupe tracking-widest">TASK</span>
              )}
              <span className="font-mono text-[11px] font-semibold text-parchment truncate">
                {headerLabel}
              </span>
              {selectedTask && (
                <span className={`font-mono text-[8px] font-bold tracking-wider px-1.5 py-0.5 ${
                  selectedTask.status === 'breakthrough' ? 'bg-maroon text-parchment' :
                  selectedTask.status === 'defended' || selectedTask.status === 'completed' ? 'bg-olive text-parchment' :
                  'bg-steel/30 text-parchment'
                }`}>
                  {selectedTask.status.toUpperCase()}
                </span>
              )}
            </div>
            <button
              onClick={closeInspector}
              className="flex-shrink-0 flex items-center justify-center w-7 h-7 text-taupe hover:text-parchment transition-colors"
              aria-label="Close inspector"
            >
              <X size={14} />
            </button>
          </div>

          {/* Body — key on selectedTaskId to reset scroll when switching tasks (RFC §15.23) */}
          <div
            key={selectedTaskId ?? selectedNodeId ?? 'empty'}
            className="flex-1 overflow-y-auto"
          >
            {showMultiSelect ? (
              <MultiSelectInspector />
            ) : selectedTask ? (
              <TaskInspector task={selectedTask} iter={selectedMutationIter} />
            ) : nodeType === 'root' ? (
              <RootInspector />
            ) : selectedNodeId ? (
              <ConfigInspector nodeId={selectedNodeId} />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center px-6">
                <div className="font-mono text-[10px] text-taupe tracking-widest mb-2">NO SELECTION</div>
                <p className="font-sans text-xs text-steel">Select a node to inspect its detail</p>
              </div>
            )}
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
});
