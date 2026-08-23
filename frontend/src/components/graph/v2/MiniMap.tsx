/**
 * v2/MiniMap.tsx
 * Repositioned minimap — bottom-right at (16,16) with correct color-coded nodes.
 * Fixed v1 bug: was at right:240 leaving a gap when HUD is replaced.
 */
import { memo } from 'react';
import { MiniMap } from '@xyflow/react';
import type { Node } from '@xyflow/react';
import { NT } from './types';

function nodeColor(n: Node): string {
  if (n.type === NT.ROOT)      return 'var(--color-slate)';
  if (n.type === NT.TECHNIQUE) return 'var(--color-hairline)';
  if (n.type === NT.OUTCOME) {
    const s = (n.data as { status: string }).status;
    return s === 'breakthrough' ? 'var(--color-maroon)' :
           s === 'defended' || s === 'completed' ? 'var(--color-olive)' :
           'var(--color-taupe)';
  }
  if (n.type === NT.TASK) {
    const t = (n.data as { task?: { is_breakthrough?: boolean } }).task;
    return t?.is_breakthrough ? 'var(--color-maroon)' : 'var(--color-hairline)';
  }
  return 'var(--color-linen)';
}

export const GraphMiniMap = memo(function GraphMiniMap() {
  return (
    <MiniMap
      style={{ bottom: 16, right: 16, width: 200, height: 120 }}
      nodeColor={nodeColor}
      maskColor="rgba(246,242,238,0.6)"
      zoomable={false}
      pannable={false}
    />
  );
});
