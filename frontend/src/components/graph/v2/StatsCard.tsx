/**
 * v2/StatsCard.tsx
 * Precision Telemetry HUD Card for Campaign Graph (bottom-left overlay).
 * Redesigned with sleek semi-translucent frosted glass, crisp slate bezel,
 * and high-contrast monospace metrics.
 */
import { memo } from 'react';
import { usePipelineStore } from '../../../stores/pipelineStore';
import { Flame, ShieldCheck, Zap } from 'lucide-react';

export const StatsCard = memo(function StatsCard() {
  const runStats = usePipelineStore((s) => s.runStats);
  const liveTasks = usePipelineStore((s) => s.liveTasks);

  const inFlight = Object.values(liveTasks).filter((t) =>
    ['queued', 'mutating', 'transmitting', 'scoring'].includes(t.status)
  ).length;

  const avgRisk = runStats.avg_risk_score ?? 0;
  const riskColor =
    avgRisk >= 0.7 ? 'text-maroon' : avgRisk >= 0.4 ? 'text-camel' : 'text-olive';

  return (
    <div className="absolute top-[64px] left-4 z-10 flex items-center gap-2 font-mono text-[9px] select-none pointer-events-none">
      {/* Total */}
      <div className="flex items-center gap-1 font-bold">
        <span className="text-taupe font-normal uppercase text-[8px]">TOTAL</span>
        <span className="text-slate">{runStats.total_tasks || Object.keys(liveTasks).length}</span>
      </div>

      <span className="text-hairline/80 font-normal select-none">|</span>

      {/* Breach */}
      <div className="flex items-center gap-1 text-maroon font-bold">
        <span className="text-maroon/80 font-normal uppercase text-[8px] flex items-center gap-0.5">
          <Flame size={9} />
          BREACH
        </span>
        <span>{runStats.successful_attacks}</span>
      </div>

      <span className="text-hairline/80 font-normal select-none">|</span>

      {/* Defend */}
      <div className="flex items-center gap-1 text-olive font-bold">
        <span className="text-olive/80 font-normal uppercase text-[8px] flex items-center gap-0.5">
          <ShieldCheck size={9} />
          DEFEND
        </span>
        <span>{runStats.defended_tasks ?? 0}</span>
      </div>

      <span className="text-hairline/80 font-normal select-none">|</span>

      {/* Flight */}
      <div className="flex items-center gap-1 font-bold">
        <span className="text-steel font-normal uppercase text-[8px] flex items-center gap-0.5">
          <Zap size={9} className="text-camel" />
          FLIGHT
        </span>
        <span className="text-slate">{inFlight}</span>
      </div>

      <span className="text-hairline/80 font-normal select-none">|</span>

      {/* Mean Risk */}
      <div className="flex items-center gap-1 font-bold">
        <span className="text-taupe font-normal uppercase text-[8px]">MEAN RISK</span>
        <span className={`tabular-nums ${riskColor}`}>{avgRisk.toFixed(2)}</span>
      </div>
    </div>
  );
});
