/**
 * v2/hooks/useSemanticZoom.ts
 * Debounced viewport zoom listener — maps zoom value to semantic tier 0-4.
 * Only calls setSemanticZoomTier when the tier actually changes (not on every zoom tick).
 *
 * Store writes: graphStore.setSemanticZoomTier
 */
import { useCallback, useRef } from 'react';
import type { Viewport } from '@xyflow/react';
import { useGraphStore } from '../store/graphStore';

/** Maps continuous zoom to semantic tier. */
function zoomToTier(zoom: number): 0 | 1 | 2 | 3 | 4 {
  if (zoom < 0.3) return 0;
  if (zoom < 0.6) return 1;
  if (zoom < 1.0) return 2;
  if (zoom < 1.5) return 3;
  return 4;
}

// RF v12 onMove signature: (event: MouseEvent | TouchEvent | null, viewport: Viewport)
export function useSemanticZoom(): { onMove: (event: MouseEvent | TouchEvent | null, viewport: Viewport) => void } {
  const setSemanticZoomTier = useGraphStore(s => s.setSemanticZoomTier);
  const currentTierRef = useRef<0 | 1 | 2 | 3 | 4>(2);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onMove = useCallback((_event: MouseEvent | TouchEvent | null, viewport: Viewport) => {
    // Debounce 50ms — only re-derive layout when tier changes
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const tier = zoomToTier(viewport.zoom);
      if (tier !== currentTierRef.current) {
        currentTierRef.current = tier;
        setSemanticZoomTier(tier);
      }
    }, 50);
  }, [setSemanticZoomTier]);

  return { onMove };
}
