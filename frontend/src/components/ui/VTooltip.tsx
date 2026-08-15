import React from 'react';
import * as Tooltip from '@radix-ui/react-tooltip';

interface VTooltipProps {
  children: React.ReactNode;
  content?: React.ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
  sideOffset?: number;
}

export function VTooltip({
  children,
  content,
  side = 'top',
  sideOffset = 8,
}: VTooltipProps) {
  if (!content) return <>{children}</>;

  return (
    <Tooltip.Provider delayDuration={100} skipDelayDuration={0}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            side={side}
            sideOffset={sideOffset}
            className="z-50 max-w-sm bg-slate text-parchment text-xs px-3 py-1.5 font-mono leading-relaxed border border-hairline shadow-2xl animate-fade-in select-none"
          >
            {content}
            <Tooltip.Arrow className="fill-slate" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
