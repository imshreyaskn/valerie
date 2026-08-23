/**
 * v2/nodes/TaskNode.tsx
 * Task chip with status pill, risk bar, live pulse dot.
 * Uses graphStore directly for selection — no callback injection anti-pattern.
 *
 * Store reads: graphStore.selectedTaskId (to apply selection ring)
 * Store writes: graphStore.selectTask (on click, but click handled by Canvas onNodeClick)
 */
import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { LiveTask } from '../../../../types/domain';
import { useGraphStore } from '../store/graphStore';

interface Props {
  data: { task: LiveTask; dimmed?: boolean };
}

// Status → Tailwind token class mappings
const STATUS_TEXT: Record<string, string> = {
  queued:       'text-taupe',
  mutating:     'text-camel',
  transmitting: 'text-powder',
  scoring:      'text-camel',
  breakthrough: 'text-maroon',
  defended:     'text-olive',
  unresolved:   'text-steel',
  failed:       'text-maroon',
  completed:    'text-olive',
};
const STATUS_BG: Record<string, string> = {
  queued:       'bg-parchment',
  mutating:     'bg-camel-muted',
  transmitting: 'bg-powder-muted',
  scoring:      'bg-camel-muted',
  breakthrough: 'bg-maroon-muted',
  defended:     'bg-olive-muted',
  unresolved:   'bg-parchment',
  failed:       'bg-maroon-muted',
  completed:    'bg-olive-muted',
};
const LIVE_STATUSES = new Set(['queued', 'mutating', 'transmitting', 'scoring']);

export const TaskNode = memo(function TaskNode({ data }: Props) {
  const { task } = data;
  const selectedTaskId = useGraphStore(s => s.selectedTaskId);
  const isSelected = selectedTaskId === task.task_id;
  const isLive = LIVE_STATUSES.has(task.status);
  const riskPct = Math.round(task.risk_score * 100);
  const textClass = STATUS_TEXT[task.status] ?? 'text-steel';
  const bgClass = STATUS_BG[task.status] ?? 'bg-parchment';
  const borderClass = task.is_breakthrough ? 'border-maroon' : 'border-hairline';

  return (
    <div
      className={`bg-ivory border p-3 font-sans ${borderClass} ${isSelected ? 'selected-ring' : ''}`}
      style={{ width: 150, position: 'relative' }}
      role="treeitem"
      aria-selected={isSelected}
    >
      <Handle type="target" position={Position.Top} style={{ background: 'var(--color-hairline)', width: 6, height: 6, border: 'none' }} />

      {/* Live pulse dot */}
      {isLive && (
        <span
          className={`absolute top-2 right-2 w-1.5 h-1.5 rounded-full animate-pulse-dot ${textClass.replace('text-', 'bg-')}`}
          aria-hidden="true"
        />
      )}

      <div className="font-mono text-[10px] text-taupe mb-1">
        {task.task_id.slice(0, 8)}
      </div>

      {/* Status pill */}
      <div className={`inline-block font-mono text-[9px] font-bold tracking-wider px-1.5 py-0.5 mb-2 ${textClass} ${bgClass}`}>
        {task.status.toUpperCase()}
      </div>

      {/* Risk bar */}
      {task.risk_score > 0 && (
        <div className="mb-1.5">
          <div className="flex justify-between mb-0.5">
            <span className="font-mono text-[8px] text-taupe">RISK</span>
            <span className={`font-mono text-[8px] font-bold tabular-nums ${textClass}`}>{riskPct}%</span>
          </div>
          <div className="h-0.5 bg-linen w-full">
            <div className={`h-full ${textClass.replace('text-', 'bg-')}`} style={{ width: `${riskPct}%` }} />
          </div>
        </div>
      )}

      <div className="font-mono text-[8px] text-steel">
        ITER: {task.iterations}
      </div>

      <Handle type="source" position={Position.Bottom} style={{ background: 'var(--color-hairline)', width: 6, height: 6, border: 'none' }} />
    </div>
  );
});
