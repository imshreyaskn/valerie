/**
 * v2/nodes/OutcomeNode.tsx
 * Terminal Evaluation Verdict Node — Conclusive forensic outcome glyph for an attack branch.
 * Redesigned with ivory card background, status accent borders, and clean Swiss metrics.
 */
import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { useGraphStore } from '../store/graphStore';
import { ShieldCheck, Flame, XCircle, Clock } from 'lucide-react';

interface Props {
  data: {
    status: string;
    riskScore: number;
    iterations: number;
    taskId: string;
    isBreakthrough?: boolean;
    latencyMs?: number;
  };
  id?: string;
}

const OUTCOME_CONFIG: Record<
  string,
  {
    pillBg: string;
    border: string;
    text: string;
    icon: typeof ShieldCheck;
    label: string;
  }
> = {
  breakthrough: {
    pillBg: 'bg-maroon text-parchment',
    border: 'border-maroon/70 ring-1 ring-maroon/20',
    text: 'text-maroon',
    icon: Flame,
    label: 'BREAKTHROUGH',
  },
  defended: {
    pillBg: 'bg-olive text-parchment',
    border: 'border-olive/70 ring-1 ring-olive/20',
    text: 'text-olive',
    icon: ShieldCheck,
    label: 'DEFENDED',
  },
  completed: {
    pillBg: 'bg-olive text-parchment',
    border: 'border-olive/70 ring-1 ring-olive/20',
    text: 'text-olive',
    icon: ShieldCheck,
    label: 'COMPLETED',
  },
  unresolved: {
    pillBg: 'bg-taupe text-slate',
    border: 'border-hairline',
    text: 'text-steel',
    icon: XCircle,
    label: 'UNRESOLVED',
  },
  failed: {
    pillBg: 'bg-maroon-muted text-maroon',
    border: 'border-maroon/50',
    text: 'text-maroon',
    icon: XCircle,
    label: 'FAILED',
  },
};

const DEFAULT_CONFIG = {
  pillBg: 'bg-linen text-slate',
  border: 'border-hairline',
  text: 'text-steel',
  icon: ShieldCheck,
  label: 'TERMINATED',
};

export const OutcomeNode = memo(function OutcomeNode({ data, id }: Props) {
  const { status, riskScore, iterations, taskId, isBreakthrough, latencyMs } = data;
  const cfg = isBreakthrough
    ? OUTCOME_CONFIG.breakthrough
    : OUTCOME_CONFIG[status] ?? DEFAULT_CONFIG;
  const Icon = cfg.icon;

  const selectedTaskId = useGraphStore((s) => s.selectedTaskId);
  const isSelected = selectedTaskId === taskId || selectedTaskId === id?.replace('outcome-', '');

  return (
    <div
      className={`bg-ivory border-2 ${cfg.border} p-3 font-sans transition-all select-none shadow-sm ${
        isSelected ? 'ring-2 ring-slate ring-offset-2 shadow-md' : 'hover:border-steel'
      }`}
      style={{ width: 180, position: 'relative' }}
      role="treeitem"
      aria-selected={isSelected}
    >
      {/* Inflow Handle from Last Mutation / Task */}
      <Handle
        type="target"
        position={Position.Top}
        style={{
          background: 'var(--color-slate)',
          width: 7,
          height: 7,
          border: '1px solid var(--color-ivory)',
          top: -4,
        }}
      />

      {/* Outcome Verdict Header Pill */}
      <div
        className={`flex items-center justify-center gap-1.5 py-1 px-2 mb-2 rounded-2xs ${cfg.pillBg}`}
      >
        <Icon size={12} className="shrink-0" />
        <span className="font-mono text-[9px] font-black tracking-widest uppercase">
          {cfg.label}
        </span>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 gap-2 p-1.5 bg-linen/40 border border-hairline/60 rounded-2xs font-mono">
        <div>
          <div className="text-[7px] text-taupe uppercase tracking-wider font-bold">FINAL RISK</div>
          <div className={`text-xs font-black tabular-nums ${cfg.text}`}>
            {(riskScore ?? 0).toFixed(2)}
          </div>
        </div>
        <div>
          <div className="text-[7px] text-taupe uppercase tracking-wider font-bold">ITERATIONS</div>
          <div className="text-xs font-black text-slate">
            {iterations ?? 0}
          </div>
        </div>
      </div>

      {/* Latency if available */}
      {latencyMs !== undefined && latencyMs > 0 && (
        <div className="flex items-center justify-center gap-1 font-mono text-[8px] text-taupe mt-1.5">
          <Clock size={9} />
          <span>{latencyMs.toFixed(0)}ms latency</span>
        </div>
      )}
    </div>
  );
});
