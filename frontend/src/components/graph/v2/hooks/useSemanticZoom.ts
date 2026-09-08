/**
 * v2/hooks/useSemanticZoom.ts
 * Lightweight viewport listener — avoids store churn on continuous pan/zoom.
 */
import { useCallback } from 'react';
import type { Viewport } from '@xyflow/react';

export function useSemanticZoom(): {
  onMove: (event: MouseEvent | TouchEvent | null, viewport: Viewport) => void;
} {
  const onMove = useCallback((_event: MouseEvent | TouchEvent | null, _viewport: Viewport) => {
    // Intentionally lightweight — React Flow handles native viewport scaling directly
  }, []);

  return { onMove };
}
