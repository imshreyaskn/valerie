/**
 * v2/edges/ActiveMutationEdge.tsx
 * Animated dashed edge for mutation iterations with subtle framer-motion path animation.
 */
import { memo } from 'react';
import { getSmoothStepPath, type EdgeProps } from '@xyflow/react';
import { motion, useReducedMotion } from 'framer-motion';

export const ActiveMutationEdge = memo(function ActiveMutationEdge({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
}: EdgeProps) {
  const [edgePath] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 6,
  });
  const reducedMotion = useReducedMotion();

  return (
    <motion.path
      d={edgePath}
      fill="none"
      stroke={style?.stroke ?? 'var(--color-steel)'}
      strokeWidth={1.5}
      strokeDasharray="4 3"
      initial={{ pathLength: reducedMotion ? 1 : 0, opacity: 0.4 }}
      animate={{ pathLength: 1, opacity: 1 }}
      transition={reducedMotion ? { duration: 0 } : { duration: 0.35, ease: 'easeOut' }}
    />
  );
});
