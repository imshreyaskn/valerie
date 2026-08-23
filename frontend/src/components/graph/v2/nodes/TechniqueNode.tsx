/**
 * v2/nodes/TechniqueNode.tsx
 * Technique column header — name, task count badge.
 * At tier 1: shows "N TASKS" badge; at tier 2+: individual task chips appear below.
 */
import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';

interface Props {
  data: { technique: string; taskCount: number; visibleCount?: number };
}

export const TechniqueNode = memo(function TechniqueNode({ data }: Props) {
  const { technique, taskCount, visibleCount } = data;
  const displayName = technique.replace(/_/g, ' ');

  return (
    <div
      className="bg-linen border border-hairline p-3 font-sans"
      style={{ width: 200, position: 'relative' }}
    >
      <Handle type="target" position={Position.Top} style={{ background: 'var(--color-hairline)', width: 6, height: 6, border: 'none' }} />

      <div className="font-mono text-[11px] font-bold uppercase tracking-tight break-words text-slate mb-2 leading-snug">
        {displayName}
      </div>

      <div className="flex items-center gap-1">
        <span className="font-mono text-[9px] font-bold tracking-wider text-steel bg-hairline px-1.5 py-0.5">
          {taskCount} TASK{taskCount !== 1 ? 'S' : ''}
        </span>
        {visibleCount !== undefined && visibleCount !== taskCount && (
          <span className="font-mono text-[8px] text-taupe">
            ({visibleCount} visible)
          </span>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} style={{ background: 'var(--color-hairline)', width: 6, height: 6, border: 'none' }} />
    </div>
  );
});
