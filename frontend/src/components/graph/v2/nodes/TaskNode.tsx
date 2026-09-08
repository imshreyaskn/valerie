/**
 * v2/nodes/TaskNode.tsx
 * Attack Specimen Card — Interactive DAG specimen node representing a single
 * (prompt × technique) attack instance, its risk progression, and mutation toggle.
 */
import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { LiveTask } from '../../../../types/domain';
import { useGraphStore } from '../store/graphStore';
import { usePipelineStore } from '../../../../stores/pipelineStore';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface Props {
  data: {
    task: LiveTask;
    isExpanded: boolean;
    hasMutations: boolean;
    dimmed?: boolean;
  };
}

const STATUS_CONFIG: Record<string, { bg: string; text: string; label: string; dot: string }> = {
  queued: { bg: 'bg-parchment', text: 'text-taupe', label: 'QUEUED', dot: 'bg-taupe' },
  mutating: { bg: 'bg-camel-muted', text: 'text-camel', label: 'MUTATING', dot: 'bg-camel animate-pulse' },
  transmitting: { bg: 'bg-powder-muted', text: 'text-powder', label: 'TRANSMITTING', dot: 'bg-powder animate-pulse' },
  scoring: { bg: 'bg-camel-muted', text: 'text-camel', label: 'SCORING', dot: 'bg-camel animate-pulse' },
  breakthrough: { bg: 'bg-maroon-muted', text: 'text-maroon font-bold', label: 'BREACH', dot: 'bg-maroon' },
  defended: { bg: 'bg-olive-muted', text: 'text-olive font-bold', label: 'DEFENDED', dot: 'bg-olive' },
  completed: { bg: 'bg-olive-muted', text: 'text-olive', label: 'COMPLETED', dot: 'bg-olive' },
  unresolved: { bg: 'bg-parchment', text: 'text-steel', label: 'UNRESOLVED', dot: 'bg-steel' },
  failed: { bg: 'bg-maroon-muted', text: 'text-maroon', label: 'FAILED', dot: 'bg-maroon' },
};

export const TaskNode = memo(function TaskNode({ data }: Props) {
  const { task, isExpanded, hasMutations } = data;
  const selectedTaskId = useGraphStore((s) => s.selectedTaskId);
  const selectTask = useGraphStore((s) => s.selectTask);
  const toggleExpandTask = useGraphStore((s) => s.toggleExpandTask);
  const activeRunMeta = usePipelineStore((s) => s.activeRunMeta);
  const isSelected = selectedTaskId === task.task_id;
  const maxIters = task.max_iterations || activeRunMeta?.max_iterations || 3;

  const statusCfg = STATUS_CONFIG[task.status] ?? STATUS_CONFIG.queued;
  const riskScore = task.risk_score ?? 0;
  const riskPct = Math.round(riskScore * 100);

  const riskTone =
    riskScore >= 0.7
      ? 'text-maroon bg-maroon'
      : riskScore >= 0.4
      ? 'text-camel bg-camel'
      : 'text-olive bg-olive';

  const [riskTextColor, riskBgColor] = riskTone.split(' ');
  const selectionClasses = isSelected ? 'ring-2 ring-slate !border-slate shadow-md' : 'border-hairline hover:border-steel';
  const capsuleStyle = `${statusCfg.bg} ${statusCfg.text}`;
  const statusDotClass = statusCfg.dot;

  const handleSelect = (e: React.MouseEvent) => {
    e.stopPropagation();
    selectTask(task.task_id);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.stopPropagation();
      selectTask(task.task_id);
    }
  };

  return (
    <div
      onClick={handleSelect}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="button"
      aria-label={`Task ${task.task_id.slice(0, 8)} (${task.technique}): ${task.status}, risk ${riskScore.toFixed(2)}`}
      aria-selected={isSelected}
      className={`group relative w-[170px] bg-linen/50 border rounded-xs p-2 text-left transition-all duration-150 select-none cursor-pointer focus:outline-none focus-visible:ring-1 focus-visible:ring-slate ${selectionClasses}`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!w-1.5 !h-1.5 !bg-linen !border !border-steel !rounded-full -top-1"
      />

      {/* Header: Harm Type & Task ID */}
      <div className="flex items-center justify-between gap-1 mb-1">
        <span className="font-mono text-[8px] font-bold uppercase text-steel truncate">
          {task.harm_type ? task.harm_type.slice(0, 16) : 'GENERAL'}
          {task.harm_type && task.harm_type.length > 16 ? '…' : ''}
        </span>
        <span className="font-mono text-[7px] text-taupe shrink-0">
          #{task.task_id.slice(0, 6)}
        </span>
      </div>

      {/* Status Capsule */}
      <div className="flex items-center gap-1 mb-2">
        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-2xs font-mono text-[8px] font-bold uppercase tracking-wider ${capsuleStyle}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${statusDotClass}`} />
          {task.status.toUpperCase()}
        </span>
      </div>

      {/* Risk Score Meter */}
      <div className="mb-2">
        <div className="flex justify-between items-center mb-0.5">
          <span className="font-mono text-[8px] text-taupe uppercase">RISK INDEX</span>
          <span className={`font-mono text-[9px] font-bold tabular-nums ${riskTextColor}`}>
            {riskScore.toFixed(2)}
          </span>
        </div>
        <div className="h-1 bg-parchment w-full overflow-hidden border border-hairline/40 rounded-2xs">
          <div
            className={`h-full ${riskBgColor} transition-all duration-300`}
            style={{ width: `${riskPct}%` }}
          />
        </div>
      </div>

      {/* Footer: Iteration & Mutation Expansion Toggle */}
      <div className="flex items-center justify-between pt-1 border-t border-hairline/40">
        <span className="font-mono text-[8px] text-steel">
          ITER {task.iterations ?? 0}/{maxIters}
        </span>

        {hasMutations && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleExpandTask(task.task_id);
            }}
            className="flex items-center gap-0.5 font-mono text-[8px] font-bold text-steel hover:text-slate bg-linen hover:bg-cream px-1.5 py-0.5 rounded-2xs transition-colors cursor-pointer"
            title={isExpanded ? 'Collapse mutation iterations' : 'Expand mutation iterations'}
          >
            {isExpanded ? (
              <>
                <span>CHAIN</span>
                <ChevronUp size={10} />
              </>
            ) : (
              <>
                <span>CHAIN</span>
                <ChevronDown size={10} />
              </>
            )}
          </button>
        )}
      </div>

      {/* Outflow Handle to Mutation Chain / Outcome */}
      <Handle
        type="source"
        position={Position.Bottom}
        style={{
          background: 'var(--color-slate)',
          width: 7,
          height: 7,
          border: '1px solid var(--color-ivory)',
          bottom: -4,
        }}
      />
    </div>
  );
});
