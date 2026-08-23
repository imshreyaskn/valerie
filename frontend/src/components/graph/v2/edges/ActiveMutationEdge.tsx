/**
 * v2/edges/ActiveMutationEdge.tsx
 * Animated edge for the selected task's active mutation chain.
 * Uses framer-motion pathLength animation for the "drawing" effect.
 */
import { memo } from 'react';
import { getSmoothStepPath, type EdgeProps } from '@xyflow/react';
import { motion, useReducedMotion } from 'framer-motion';

export const ActiveMutationEdge = memo(function ActiveMutationEdge({
  sourceX, sourceY, targetX, targetY,
  sourcePosition, targetPosition,
}: EdgeProps) {
  const [edgePath] = getSmoothStepPath({
    sourceX, sourceY, sourcePosition,
    targetX, targetY, targetPosition,
  });
  const reducedMotion = useReducedMotion();

  return (
    <motion.path
      d={edgePath}
      fill="none"
      stroke="var(--color-hairline)"
      strokeWidth={1}
      strokeDasharray="4 2"
      initial={{ pathLength: reducedMotion ? 1 : 0 }}
      animate={{ pathLength: 1 }}
      transition={reducedMotion ? { duration: 0 } : { duration: 0.4, ease: 'easeOut' }}
    />
  );
});
