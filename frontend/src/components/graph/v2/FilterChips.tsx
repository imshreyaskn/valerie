/**
 * v2/FilterChips.tsx
 * Top filter bar with multi-select chips for status, technique, harm_type.
 * Non-matching nodes get .dimmed class — they are NEVER removed from the canvas.
 *
 * Store reads: graphStore.filters, pipelineStore.activeRunMeta, pipelineStore.liveTasks
 * Store writes: graphStore.setFilter, graphStore.clearFilters
 */
import { memo } from 'react';
import { useGraphStore } from './store/graphStore';
import { usePipelineStore } from '../../../stores/pipelineStore';
import type { TaskStatus } from '../../../types/domain';

// Status pills shown in filter bar
const ALL_STATUSES: TaskStatus[] = [
  'queued', 'mutating', 'transmitting', 'scoring',
  'breakthrough', 'defended', 'completed', 'unresolved', 'failed',
];

const STATUS_LABEL: Partial<Record<TaskStatus, string>> = {
  queued: 'QUEUED', mutating: 'MUTATING', transmitting: 'TX', scoring: 'SCORING',
  breakthrough: 'BREACH', defended: 'DEFENDED', completed: 'DONE',
  unresolved: 'UNRESOLVED', failed: 'FAILED',
};

function Chip({
  label, active, onClick, count,
}: {
  label: string; active: boolean; onClick: () => void; count?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={[
        'inline-flex items-center gap-1 font-mono text-[10px] font-bold tracking-wider px-2 py-0.5 transition-colors',
        active ? 'bg-slate text-parchment' : 'bg-ivory text-steel border border-hairline hover:bg-linen',
      ].join(' ')}
      aria-pressed={active}
    >
      {label}
      {count !== undefined && count > 0 && (
        <span className={`font-mono text-[8px] ${active ? 'text-taupe' : 'text-taupe'}`}>
          ({count})
        </span>
      )}
    </button>
  );
}

export const FilterChips = memo(function FilterChips({ visible }: { visible: boolean }) {
  const filters = useGraphStore(s => s.filters);
  const setFilter = useGraphStore(s => s.setFilter);
  const clearFilters = useGraphStore(s => s.clearFilters);
  const liveTasks = usePipelineStore(s => s.liveTasks);

  if (!visible) return null;

  // Derive unique techniques + harm types from live data
  const allTasks = Object.values(liveTasks);
  const techniques = [...new Set(allTasks.map(t => t.technique))].sort();
  const harmTypes = [...new Set(allTasks.map(t => t.harm_type).filter(Boolean))].sort();

  function toggleStatus(s: TaskStatus) {
    const next = filters.statuses.includes(s)
      ? filters.statuses.filter(x => x !== s)
      : [...filters.statuses, s];
    setFilter('statuses', next);
  }

  function toggleTechnique(t: string) {
    const next = filters.techniques.includes(t)
      ? filters.techniques.filter(x => x !== t)
      : [...filters.techniques, t];
    setFilter('techniques', next);
  }

  function toggleHarmType(h: string) {
    const next = filters.harmTypes.includes(h)
      ? filters.harmTypes.filter(x => x !== h)
      : [...filters.harmTypes, h];
    setFilter('harmTypes', next);
  }

  const hasAnyFilter = filters.statuses.length > 0 || filters.techniques.length > 0 ||
    filters.harmTypes.length > 0 || filters.breakthroughOnly || !filters.showResolved;

  return (
    <div
      className="absolute top-0 left-0 right-0 bg-ivory/95 border-b border-hairline px-4 py-2 z-10 flex flex-wrap items-center gap-x-3 gap-y-1.5"
      style={{ minHeight: 36 }}
      role="toolbar"
      aria-label="Task filters"
    >
      {/* Status chips */}
      <div className="flex items-center gap-1 flex-wrap">
        <span className="font-mono text-[8px] text-taupe tracking-wider mr-1">STATUS</span>
        {ALL_STATUSES.map(s => (
          <Chip
            key={s}
            label={STATUS_LABEL[s] ?? s.toUpperCase()}
            active={filters.statuses.includes(s)}
            onClick={() => toggleStatus(s)}
          />
        ))}
      </div>

      {/* Technique chips (only if multiple techniques exist) */}
      {techniques.length > 1 && (
        <div className="flex items-center gap-1 flex-wrap">
          <span className="font-mono text-[8px] text-taupe tracking-wider mr-1">TECHNIQUE</span>
          {techniques.map(t => (
            <Chip
              key={t}
              label={t.replace(/_/g, ' ').toUpperCase().slice(0, 12)}
              active={filters.techniques.includes(t)}
              onClick={() => toggleTechnique(t)}
            />
          ))}
        </div>
      )}

      {/* Harm type chips */}
      {harmTypes.length > 1 && (
        <div className="flex items-center gap-1 flex-wrap">
          <span className="font-mono text-[8px] text-taupe tracking-wider mr-1">HARM</span>
          {harmTypes.map(h => (
            <Chip
              key={h}
              label={h.toUpperCase().slice(0, 10)}
              active={filters.harmTypes.includes(h)}
              onClick={() => toggleHarmType(h)}
            />
          ))}
        </div>
      )}

      {/* Toggle chips */}
      <div className="flex items-center gap-1">
        <Chip
          label="BREACH ONLY"
          active={filters.breakthroughOnly}
          onClick={() => setFilter('breakthroughOnly', !filters.breakthroughOnly)}
        />
        <Chip
          label="HIDE RESOLVED"
          active={!filters.showResolved}
          onClick={() => setFilter('showResolved', !filters.showResolved)}
        />
      </div>

      {/* Clear all */}
      {hasAnyFilter && (
        <button
          onClick={clearFilters}
          className="font-mono text-[10px] font-bold tracking-wider text-maroon hover:text-maroon/70 transition-colors ml-auto"
          aria-label="Clear all filters"
        >
          CLEAR ALL ×
        </button>
      )}
    </div>
  );
});
