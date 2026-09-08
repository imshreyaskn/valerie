/**
 * v2/edges/StructuralEdge.tsx
 * Default edge for campaign graph structural DAG connections:
 * smoothstep path with hairline stroke and Swiss styling.
 */
import { memo } from 'react';
import { getSmoothStepPath, type EdgeProps, BaseEdge, EdgeLabelRenderer } from '@xyflow/react';

export const StructuralEdge = memo(function StructuralEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  label,
  style,
}: EdgeProps) {
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 8,
  });

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          stroke: 'var(--color-hairline)',
          strokeWidth: 1.5,
          ...style,
        }}
      />
      {label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 9,
              color: 'var(--color-steel)',
              background: 'var(--color-parchment)',
              border: '1px solid var(--color-hairline)',
              padding: '1px 4px',
              pointerEvents: 'none',
              letterSpacing: '0.05em',
            }}
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
});
