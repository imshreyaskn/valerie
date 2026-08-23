/**
 * v2/nodes/OutcomeNode.tsx
 * Terminal outcome glyph — breakthrough, defended, completed, unresolved, failed.
 * Fixes v1 bug: 'completed' was rendered as 'DEFENDED'. Now has distinct label.
 */
import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { useGraphStore } from '../store/graphStore';

interface Props {
  data: {
    status: string;
    riskScore: number;
    iterations: number;
    taskId?: string;
    dimmed?: boolean;
  };
  id?: string;
}

// All colors are CSS token vars, no hardcoded hex
const OUTCOME_CONFIG: Record<string, { bg: string; border: string; text: string; glyph: string; label: string }> = {
  breakthrough: { bg: 'bg-maroon-muted', border: 'border-maroon',  text: 'text-maroon', glyph: '◆', label: 'BREAKTHROUGH' },
  defended:     { bg: 'bg-olive-muted',  border: 'border-olive',   text: 'text-olive',  glyph: '✓', label: 'DEFENDED' },
  completed:    { bg: 'bg-olive-muted',  border: 'border-olive',   text: 'text-olive',  glyph: '✓', label: 'COMPLETED' },
  unresolved:   { bg: 'bg-parchment',    border: 'border-taupe',   text: 'text-steel',  glyph: '✗', label: 'UNRESOLVED' },
  failed:       { bg: 'bg-maroon-muted', border: 'border-maroon',  text: 'text-maroon', glyph: '✗', label: 'FAILED' },
};
const DEFAULT_CONFIG = { bg: 'bg-parchment', border: 'border-hairline', text: 'text-steel', glyph: '?', label: 'UNKNOWN' };

export const OutcomeNode = memo(function OutcomeNode({ data, id }: Props) {
  const { status, riskScore, iterations, taskId } = data;
  const cfg = OUTCOME_CONFIG[status] ?? DEFAULT_CONFIG;
  const selectedTaskId = useGraphStore(s => s.selectedTaskId);
  const isSelected = selectedTaskId === taskId || selectedTaskId === id?.replace('outcome-', '');

  return (
    <div
      className={`${cfg.bg} border-2 ${cfg.border} p-3 font-sans text-center ${isSelected ? 'selected-ring' : ''}`}
      style={{ width: 150, position: 'relative' }}
      role="treeitem"
      aria-selected={isSelected}
    >
      <Handle type="target" position={Position.Top} style={{ background: `var(--color-${cfg.text.replace('text-', '')})`, width: 6, height: 6, border: 'none' }} />

      <div className={`text-base mb-1 ${cfg.text}`}>{cfg.glyph}</div>
      <div className={`font-mono text-[9px] font-bold tracking-widest ${cfg.text}`}>
        {cfg.label}
      </div>

      <div className="flex justify-center gap-3 mt-2">
        <div>
          <div className="font-mono text-[8px] text-taupe">RISK</div>
          <div className={`font-mono text-[11px] font-bold tabular-nums ${cfg.text}`}>
            {riskScore.toFixed(2)}
          </div>
        </div>
        <div>
          <div className="font-mono text-[8px] text-taupe">ITER</div>
          <div className="font-mono text-[11px] font-bold text-slate">
            {iterations}
          </div>
        </div>
      </div>
    </div>
  );
});
