/**
 * v2/nodes/TechniqueNode.tsx
 * Technique Branch Header — Visual column anchor for parallel attack vectors.
 * Displays technique identity, task distribution meter, and branch telemetry.
 */
import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Network, Flame } from 'lucide-react';

interface Props {
  data: {
    technique: string;
    displayName: string;
    taskCount: number;
    breakthroughCount: number;
    defendedCount: number;
    activeCount: number;
    harmGroup?: string;
  };
}

export const TechniqueNode = memo(function TechniqueNode({ data }: Props) {
  const {
    displayName,
    taskCount,
    breakthroughCount,
    defendedCount,
    activeCount,
    harmGroup,
  } = data;

  const breakthroughPct = taskCount > 0 ? (breakthroughCount / taskCount) * 100 : 0;
  const defendedPct = taskCount > 0 ? (defendedCount / taskCount) * 100 : 0;
  const activePct = taskCount > 0 ? (activeCount / taskCount) * 100 : 0;

  return (
    <div
      className="bg-linen border border-hairline p-3 font-sans shadow-xs transition-all select-none hover:border-steel"
      style={{ width: 220, position: 'relative' }}
      role="treeitem"
    >
      {/* Inflow Handle from Target Config Node */}
      <Handle
        type="target"
        position={Position.Top}
        style={{
          background: 'var(--color-hairline)',
          width: 7,
          height: 7,
          border: '1px solid var(--color-steel)',
          top: -4,
        }}
      />

      {/* Harm Group Super-label if present */}
      {harmGroup && (
        <div className="font-mono text-[8px] font-bold text-taupe uppercase tracking-widest mb-1 truncate">
          {harmGroup}
        </div>
      )}

      {/* Technique Display Name */}
      <div className="flex items-center gap-1.5 mb-2">
        <Network size={12} className="text-steel shrink-0" />
        <h3 className="font-mono text-[11px] font-bold uppercase tracking-tight text-slate truncate">
          {displayName}
        </h3>
      </div>

      {/* Branch Metric Badges */}
      <div className="flex items-center justify-between font-mono text-[9px] mb-2 bg-ivory/80 px-2 py-1 border border-hairline/60">
        <span className="font-bold text-steel">
          {taskCount} SPECIMEN{taskCount !== 1 ? 'S' : ''}
        </span>
        {breakthroughCount > 0 ? (
          <span className="flex items-center gap-0.5 text-maroon font-bold">
            <Flame size={9} />
            {breakthroughCount} BREACH
          </span>
        ) : (
          <span className="text-olive font-medium">
            {defendedCount} DEFENDED
          </span>
        )}
      </div>

      {/* Segmented Progress Meter */}
      <div className="h-1 bg-parchment w-full flex overflow-hidden border border-hairline/40">
        {breakthroughPct > 0 && (
          <div
            style={{ width: `${breakthroughPct}%` }}
            className="bg-maroon h-full"
            title={`${breakthroughCount} Breakthroughs`}
          />
        )}
        {activePct > 0 && (
          <div
            style={{ width: `${activePct}%` }}
            className="bg-camel h-full animate-pulse"
            title={`${activeCount} Active`}
          />
        )}
        {defendedPct > 0 && (
          <div
            style={{ width: `${defendedPct}%` }}
            className="bg-olive h-full"
            title={`${defendedCount} Defended`}
          />
        )}
      </div>

      {/* Outflow Handle to Task Nodes */}
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
