/**
 * v2/edges/StructuralEdge.tsx
 * Default edge for all structural connections: smoothstep, hairline stroke, no animation.
 */
import { memo } from 'react';
import { getSmoothStepPath, type EdgeProps, BaseEdge, EdgeLabelRenderer } from '@xyflow/react';

export const StructuralEdge = memo(function StructuralEdge({
  id, sourceX, sourceY, targetX, targetY,
  sourcePosition, targetPosition,
  markerEnd, label,
}: EdgeProps) {
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX, sourceY, sourcePosition,
    targetX, targetY, targetPosition,
  });

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{ stroke: 'var(--color-hairline)', strokeWidth: 1 }}
      />
      {label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 10,
              color: 'var(--color-steel)',
              background: 'var(--color-parchment)',
              padding: '1px 4px',
              pointerEvents: 'none',
            }}
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
});
