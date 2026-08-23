/**
 * v2/nodes/MutationNode.tsx
 * Iteration card — shows iter number, risk score, prompt excerpt.
 * Supports iterations_history (backend ext 1) with graceful degradation.
 * Active iteration (selected task's latest) gets camel left-border accent.
 */
import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { VectorScores } from '../../../../types/domain';
import { useGraphStore } from '../store/graphStore';

interface Props {
  data: {
    iteration: number;
    totalIterations: number;
    prompt?: string;
    response?: string;
    riskScore?: number;
    vectorScores?: VectorScores;
    judgeReasoning?: string;
    status: string;
    taskId: string;
    dimmed?: boolean;
    animDelay?: number;
  };
}

export const MutationNode = memo(function MutationNode({ data }: Props) {
  const {
    iteration, totalIterations, prompt, riskScore, status, taskId, animDelay = 0,
  } = data;
  const selectedTaskId = useGraphStore(s => s.selectedTaskId);
  const selectedMutationIter = useGraphStore(s => s.selectedMutationIter);
  const isActiveTask = selectedTaskId === taskId;
  const isSelectedIter = isActiveTask && selectedMutationIter === iteration;
  const isLiveIter = status === 'mutating' || status === 'scoring' || status === 'transmitting';

  const excerpt = prompt ? prompt.slice(0, 48) + (prompt.length > 48 ? '…' : '') : null;

  return (
    <div
      className={`bg-parchment border border-dashed border-hairline p-2 font-sans ${isSelectedIter ? 'selected-ring' : ''}`}
      style={{
        width: 145,
        position: 'relative',
        borderLeft: isActiveTask && iteration === totalIterations
          ? '3px solid var(--color-camel)'
          : undefined,
        animationDelay: `${animDelay}ms`,
      }}
      role="treeitem"
      aria-selected={isSelectedIter}
    >
      <Handle type="target" position={Position.Top} style={{ background: 'var(--color-hairline)', width: 5, height: 5, border: 'none' }} />

      <div className="flex items-center justify-between mb-1">
        <span className={`font-mono text-[10px] font-bold tracking-wider ${isActiveTask ? 'text-camel' : 'text-powder'}`}>
          ITER {iteration}
        </span>
        {riskScore !== undefined && (
          <span className={`font-mono text-[9px] font-bold tabular-nums ${riskScore >= 0.7 ? 'text-maroon' : 'text-camel'}`}>
            {riskScore.toFixed(2)}
          </span>
        )}
        {isLiveIter && (
          <span className="w-1.5 h-1.5 rounded-full bg-camel animate-pulse-dot inline-block" aria-hidden="true" />
        )}
      </div>

      {excerpt ? (
        <div className="font-mono text-[8px] text-steel leading-snug break-words py-1">
          "{excerpt}"
        </div>
      ) : (
        <div className="font-mono text-[8px] text-taupe">
          {status === 'mutating' ? 'MUTATING…' : 'AWAITING DATA'}
        </div>
      )}

      <Handle type="source" position={Position.Bottom} style={{ background: 'var(--color-hairline)', width: 5, height: 5, border: 'none' }} />
    </div>
  );
});
