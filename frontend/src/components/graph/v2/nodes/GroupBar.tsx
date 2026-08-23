/**
 * v2/nodes/GroupBar.tsx
 * Harm-type group divider bar — a wide labeled separator between technique groups.
 */
import { memo } from 'react';

interface Props {
  data: { label: string; width: number };
}

export const GroupBar = memo(function GroupBar({ data }: Props) {
  const { label, width } = data;

  return (
    <div
      className="flex items-center gap-3"
      style={{ width, position: 'relative', pointerEvents: 'none', userSelect: 'none' }}
    >
      <div className="flex-1 h-px bg-hairline" />
      <span className="font-mono text-[9px] font-bold tracking-widest uppercase text-taupe whitespace-nowrap">
        {label.replace(/_/g, ' ')}
      </span>
      <div className="flex-1 h-px bg-hairline" />
    </div>
  );
});
