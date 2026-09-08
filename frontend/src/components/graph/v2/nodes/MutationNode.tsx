/**
 * v2/nodes/MutationNode.tsx
 * Mutation Iteration Node — Shows adversarial prompt mutation evolution,
 * semantic distance delta, and iterative judge risk score.
 */
import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { useGraphStore } from '../store/graphStore';
import { GitCommit, Sparkles } from 'lucide-react';

interface Props {
  data: {
    iteration: number;
    totalIterations: number;
    prompt?: string;
    riskScore?: number;
    semanticDistance?: number;
    status: string;
    taskId: string;
    isLatest?: boolean;
  };
}

export const MutationNode = memo(function MutationNode({ data }: Props) {
  const {
    iteration,
    prompt,
    riskScore,
    semanticDistance,
    status,
    taskId,
    isLatest,
  } = data;

  const selectedTaskId = useGraphStore((s) => s.selectedTaskId);
  const selectedMutationIter = useGraphStore((s) => s.selectedMutationIter);
  const selectMutation = useGraphStore((s) => s.selectMutation);

  const isActiveTask = selectedTaskId === taskId;
  const isSelected = isActiveTask && selectedMutationIter === iteration;
  const isLive = status === 'mutating' || status === 'transmitting' || status === 'scoring';

  const riskValue = riskScore ?? 0;
  const riskColor =
    riskValue >= 0.7
      ? 'text-maroon bg-maroon-muted border-maroon/40'
      : riskValue >= 0.4
      ? 'text-camel bg-camel-muted border-camel/40'
      : 'text-olive bg-olive-muted border-olive/40';

  const excerpt = prompt
    ? prompt.slice(0, 60) + (prompt.length > 60 ? '…' : '')
    : null;

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        selectMutation(taskId, iteration);
      }}
      className={`bg-parchment/90 border border-dashed p-2.5 font-sans transition-all select-none shadow-2xs cursor-pointer ${
        isLatest
          ? 'border-l-4 border-l-camel border-hairline'
          : 'border-hairline hover:border-steel'
      } ${isSelected ? 'ring-2 ring-slate ring-offset-2 !border-solid !border-slate shadow-sm' : ''}`}
      style={{ width: 175, position: 'relative' }}
      role="treeitem"
      aria-selected={isSelected}
    >
      {/* Inflow Handle from previous iteration or task */}
      <Handle
        type="target"
        position={Position.Top}
        style={{
          background: 'var(--color-hairline)',
          width: 6,
          height: 6,
          border: '1px solid var(--color-steel)',
          top: -3,
        }}
      />

      {/* Header: Iteration label and Risk Score */}
      <div className="flex items-center justify-between gap-1 mb-1.5 pb-1 border-b border-hairline/50">
        <div className="flex items-center gap-1 font-mono text-[9px] font-bold text-slate">
          <GitCommit size={10} className={isLatest ? 'text-camel' : 'text-steel'} />
          <span>ITER #{iteration}</span>
        </div>

        {riskScore !== undefined && (
          <span
            className={`font-mono text-[8px] font-bold px-1.5 py-0.2 border rounded-xs tabular-nums ${riskColor}`}
          >
            {riskValue.toFixed(2)}
          </span>
        )}
      </div>

      {/* Prompt Excerpt */}
      {excerpt ? (
        <div className="font-mono text-[8.5px] text-steel leading-relaxed break-words bg-ivory/80 p-1.5 border border-hairline/40 rounded-2xs mb-1.5">
          "{excerpt}"
        </div>
      ) : (
        <div className="font-mono text-[8.5px] text-taupe italic p-1">
          {isLive ? 'GENERATING MUTATION…' : 'INITIAL PROMPT SPECIMEN'}
        </div>
      )}

      {/* Semantic Distance Delta Badge (if available) */}
      <div className="flex items-center justify-between font-mono text-[8px] text-taupe pt-0.5">
        {semanticDistance !== undefined && semanticDistance > 0 ? (
          <span className="inline-flex items-center gap-0.5 text-steel bg-linen px-1 py-0.2 rounded-2xs">
            <Sparkles size={8} className="text-camel" />
            Δ {semanticDistance.toFixed(3)}
          </span>
        ) : (
          <span />
        )}
        {isLatest && (
          <span className="font-bold text-camel tracking-wider">LATEST</span>
        )}
      </div>

      {/* Outflow Handle to next iteration or outcome */}
      <Handle
        type="source"
        position={Position.Bottom}
        style={{
          background: 'var(--color-slate)',
          width: 6,
          height: 6,
          border: '1px solid var(--color-ivory)',
          bottom: -3,
        }}
      />
    </div>
  );
});
