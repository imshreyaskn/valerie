/**
 * v2/Background.tsx
 * Thin wrapper around React Flow Background. Parchment + dot grid.
 */
import { memo } from 'react';
import { Background, BackgroundVariant } from '@xyflow/react';

export const GraphBackground = memo(function GraphBackground() {
  return (
    <Background
      variant={BackgroundVariant.Dots}
      gap={20}
      size={1}
      color="var(--color-hairline)"
    />
  );
});
