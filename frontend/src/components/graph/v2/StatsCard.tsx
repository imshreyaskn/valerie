/**
 * v2/StatsCard.tsx
 * Bottom-left slim telemetry card — replacement for GraphStatsHUD.
 * Fixes v1 bug: IN FLIGHT = queued+mutating+transmitting+scoring only (not all non-completed).
 *
 * Store reads: pipelineStore.runStats, pipelineStore.liveTasks, pipelineStore.streamHealth, pipelineStore.eventCount
 * Store writes: none
 */
import { memo } from 'react';
import { usePipelineStore } from '../../../stores/pipelineStore';
import { useGraphStore } from './store/graphStore';

const HealthDot = memo(function HealthDot({ health }: { health: string }) {
  const colorClass =
    health === 'connected'  ? 'bg-olive' :
    health === 'connecting' ? 'bg-camel' :
    health === 'paused'     ? 'bg-camel' : 'bg-taupe';
  const pulse = health === 'connected' || health === 'connecting';
  return (
    <span
      className={`inline-block w-1.5 h-1.5 rounded-full ${colorClass} ${pulse ? 'animate-pulse-dot' : ''}`}
      aria-hidden="true"
    />
  );
});

export const StatsCard = memo(function StatsCard() {
  const runStats  = usePipelineStore(s => s.runStats);
  const liveTasks = usePipelineStore(s => s.liveTasks);
  const streamHealth = usePipelineStore(s => s.streamHealth);
  const eventCount = usePipelineStore(s => s.eventCount);
  const filters = useGraphStore(s => s.filters);
  const clearFilters = useGraphStore(s => s.clearFilters);

  // Fix v1 bug: IN FLIGHT = only truly active statuses
  const inFlight = Object.values(liveTasks).filter(t =>
    ['queued', 'mutating', 'transmitting', 'scoring'].includes(t.status)
  ).length;

  const totalVisible = Object.values(liveTasks).length;
  const hasFilter = filters.statuses.length > 0 || filters.techniques.length > 0 ||
    filters.harmTypes.length > 0 || filters.breakthroughOnly || !filters.showResolved;

  // Count matching tasks when filters active
  const visibleCount = hasFilter
    ? Object.values(liveTasks).filter(t => {
        if (filters.statuses.length > 0 && !filters.statuses.includes(t.status)) return false;
        if (filters.techniques.length > 0 && !filters.techniques.includes(t.technique)) return false;
        if (filters.harmTypes.length > 0 && !filters.harmTypes.includes(t.harm_type)) return false;
        if (filters.breakthroughOnly && !t.is_breakthrough) return false;
        return true;
      }).length
    : null;

  const avgRisk = runStats.avg_risk_score ?? 0;
  const riskTextClass = avgRisk >= 0.7 ? 'text-maroon' : avgRisk >= 0.4 ? 'text-camel' : 'text-taupe';

  return (
    <div
      className="absolute bottom-4 left-4 bg-slate text-parchment p-3 z-10 shadow-lg"
      style={{ width: 180 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <span className="font-mono text-[8px] tracking-widest text-taupe">TELEMETRY</span>
        <div className="flex items-center gap-1">
          <HealthDot health={streamHealth} />
          <span className="font-mono text-[8px] text-taupe uppercase">{streamHealth}</span>
        </div>
      </div>

      {/* Metric grid */}
      <div className="grid grid-cols-2 gap-y-2 mb-2">
        {([
          { label: 'TOTAL',      value: runStats.total_tasks,        cls: 'text-parchment' },
          { label: 'BREACHES',   value: runStats.successful_attacks,  cls: 'text-maroon-muted' },
          { label: 'DEFENDED',   value: runStats.defended_tasks ?? 0, cls: 'text-olive-muted' },
          { label: 'IN FLIGHT',  value: inFlight,                     cls: 'text-powder' },
        ] as const).map(({ label, value, cls }) => (
          <div key={label}>
            <div className="font-mono text-[7px] text-taupe tracking-wider mb-0.5">{label}</div>
            <div className={`font-mono text-lg font-bold ${cls}`}>{value ?? 0}</div>
          </div>
        ))}
      </div>

      {/* Risk + Events */}
      <div className="flex justify-between pt-2 border-t border-white/10">
        <div>
          <div className="font-mono text-[7px] text-taupe tracking-wider mb-0.5">AVG RISK</div>
          <div className={`font-mono text-sm font-bold tabular-nums ${riskTextClass}`}>
            {avgRisk.toFixed(2)}
          </div>
        </div>
        <div className="text-right">
          <div className="font-mono text-[7px] text-taupe tracking-wider mb-0.5">EVENTS</div>
          <div className="font-mono text-sm font-bold text-powder">{eventCount}</div>
        </div>
      </div>

      {/* Filter indicator */}
      {hasFilter && visibleCount !== null && (
        <button
          onClick={clearFilters}
          className="mt-2 w-full font-mono text-[8px] text-camel tracking-wider text-center border border-camel/30 py-0.5 hover:bg-camel/10 transition-colors"
          aria-label="Clear all filters"
        >
          FILTERED: {visibleCount}/{totalVisible} TASKS — CLEAR
        </button>
      )}
    </div>
  );
});
