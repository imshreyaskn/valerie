/**
 * v2/MiniMap.tsx
 * Precision MiniMap for Campaign Graph.
 * Uses explicit hex tokens for vibrant SVG rendering without black/white fallback.
 */
import { memo } from 'react';
import { MiniMap } from '@xyflow/react';
import type { Node } from '@xyflow/react';
import { NT } from './types';

function nodeColor(n: Node): string {
  if (n.type === NT.ROOT) return '#242934'; // Slate
  if (n.type === NT.CONFIG) return '#6E7280'; // Steel
  if (n.type === NT.TECHNIQUE) return '#B67C4B'; // Camel
  if (n.type === NT.MUTATION) return '#D97706'; // Amber/Camel
  if (n.type === NT.OUTCOME) {
    const isBreakthrough = (n.data as any)?.isBreakthrough;
    return isBreakthrough ? '#6E1818' : '#415438'; // Maroon : Olive
  }
  if (n.type === NT.TASK) {
    const isBreakthrough = (n.data as any)?.task?.is_breakthrough;
    return isBreakthrough ? '#6E1818' : '#415438'; // Maroon : Olive
  }
  return '#EDE6DF'; // Linen
}

function nodeStrokeColor(n: Node): string {
  if (n.type === NT.ROOT) return '#1A1E24';
  if (n.type === NT.OUTCOME || (n.data as any)?.task?.is_breakthrough) return '#4A0E0E';
  return '#D8D0C7';
}

export const GraphMiniMap = memo(function GraphMiniMap() {
  return (
    <MiniMap
      style={{
        bottom: 16,
        right: 16,
        width: 190,
        height: 115,
        backgroundColor: '#F6F2EE',
        border: '1px solid #D8D0C7',
      }}
      nodeColor={nodeColor}
      nodeStrokeColor={nodeStrokeColor}
      nodeStrokeWidth={2}
      nodeBorderRadius={2}
      maskColor="rgba(246, 242, 238, 0.65)"
      zoomable
      pannable
      className="shadow-lg backdrop-blur-xs"
    />
  );
});
