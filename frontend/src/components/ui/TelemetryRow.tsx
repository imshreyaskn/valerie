import React from 'react';
import { MetricCell, type MetricCellProps } from './MetricCell';

// ── Canonical Swiss telemetry row container ───────────────────────────────────
// Every dashboard page previously hand-rolled this exact grid scaffold
// (~60–90 lines each). The container owns the responsive grid, hairline
// dividers, and edge-cell padding; cells come pre-numbered (1.01 …).

// Tailwind JIT cannot see interpolated class names — static map instead.
const GRID_CLASS: Record<number, string> = {
  1: 'md:grid-cols-1',
  2: 'md:grid-cols-2',
  3: 'md:grid-cols-3',
  4: 'md:grid-cols-4',
  5: 'md:grid-cols-5',
  6: 'md:grid-cols-6',
};

interface TelemetryRowProps {
  cells: MetricCellProps[];
  ariaLabel?: string;
}

export const TelemetryRow: React.FC<TelemetryRowProps> = ({ cells, ariaLabel = 'Telemetry' }) => {
  const count = Math.min(Math.max(cells.length, 1), 6);
  return (
    <div
      className={`grid grid-cols-2 ${GRID_CLASS[count]} divide-y md:divide-y-0 md:divide-x divide-hairline hairline-bottom select-none`}
      role="region"
      aria-label={ariaLabel}
    >
      {cells.map((cell, i) => {
        const isFirst = i === 0;
        const isLast = i === cells.length - 1;
        // Canonical InstrumentCluster edge treatment: first cell drops left
        // padding on md+, last cell gains right padding and spans both columns
        // when the row wraps on mobile.
        const edgeClass = isFirst
          ? 'py-5 pr-4 md:py-6 md:pr-6 md:pl-0'
          : isLast
          ? 'py-5 pl-4 md:py-6 md:pl-6 max-md:col-span-2'
          : 'p-4 md:p-6';
        return <MetricCell key={cell.index} {...cell} className={edgeClass} />;
      })}
    </div>
  );
};
