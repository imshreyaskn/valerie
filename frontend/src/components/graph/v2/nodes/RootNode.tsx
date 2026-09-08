/**
 * v2/nodes/RootNode.tsx
 * Campaign Root Banner — Ultra-refined Swiss Root Manifest card.
 * Features a crisp slate header bezel, ivory body, telemetry cluster, and metadata badges.
 */
import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { ActiveRunMeta } from '../../../../stores/pipelineStore';
import { usePipelineStore } from '../../../../stores/pipelineStore';
import { useGraphStore } from '../store/graphStore';
import { Terminal, Shield, Layers, Flame, CheckCircle2 } from 'lucide-react';

import { parseUtcDate } from '../../../../utils/date';

interface Props {
  data: {
    runId: string | null;
    meta: ActiveRunMeta | null;
  };
}

export const RootNode = memo(function RootNode({ data }: Props) {
  const { runId, meta } = data;
  const domainLabel = meta?.domain ? meta.domain.toUpperCase().replace(/_/g, ' ') : 'SECURITY CAMPAIGN';
  const runStats = usePipelineStore((s) => s.runStats);
  const selectedNodeId = useGraphStore((s) => s.selectedNodeId);
  const isSelected = selectedNodeId === 'campaignRoot';

  const formattedTime = meta?.started_at
    ? parseUtcDate(meta.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : 'LIVE';

  const avgRisk = runStats.avg_risk_score ?? 0;
  const riskTone =
    avgRisk >= 0.7 ? 'text-maroon' : avgRisk >= 0.4 ? 'text-camel' : 'text-olive';

  const techCount =
    meta?.selected_techniques?.length ||
    (meta as any)?.techniques?.length ||
    (runStats as any)?.selected_techniques?.length ||
    1;

  return (
    <div
      className={`bg-ivory border shadow-lg font-sans transition-all select-none overflow-hidden ${
        isSelected
          ? 'border-slate ring-2 ring-slate ring-offset-2'
          : 'border-hairline hover:border-steel'
      }`}
      style={{ width: 380, position: 'relative' }}
      role="treeitem"
      aria-selected={isSelected}
    >
      {/* Sleek Top Bezel */}
      <div className="bg-slate text-parchment px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5 font-mono text-[9px] font-bold tracking-widest uppercase text-powder">
          <Terminal size={11} className="text-powder shrink-0" />
          <span>0.00 · CAMPAIGN ROOT MANIFEST</span>
        </div>
        <div className="flex items-center gap-1.5 font-mono text-[9px] text-taupe">
          <span className="w-1.5 h-1.5 rounded-full bg-olive animate-pulse" />
          <span>{formattedTime}</span>
        </div>
      </div>

      {/* Main Body */}
      <div className="p-4 bg-ivory">
        {/* Domain & ID Row */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div>
            <h2 className="font-sans text-sm font-black tracking-tight uppercase text-slate">
              {domainLabel}
            </h2>
            <div className="font-mono text-[10px] text-taupe mt-0.5 tracking-wider">
              #{(runId ?? 'ANONYMOUS').slice(0, 18)}
            </div>
          </div>

          <span className="inline-flex items-center gap-1 font-mono text-[8px] font-bold text-olive bg-olive-muted border border-olive/30 px-2 py-0.5 uppercase tracking-wider">
            <Shield size={10} />
            AUDIT DAG
          </span>
        </div>

        {/* 4-Cell Telemetry Cluster */}
        <div className="grid grid-cols-4 gap-1 p-2 bg-linen/40 border border-hairline/80 rounded-2xs mb-3 font-mono">
          <div className="border-r border-hairline/60 pr-1">
            <div className="text-[7px] text-taupe uppercase tracking-wider font-bold">TOTAL</div>
            <div className="text-xs font-black text-slate">{runStats.total_tasks}</div>
          </div>
          <div className="border-r border-hairline/60 px-1">
            <div className="text-[7px] text-maroon uppercase tracking-wider font-bold flex items-center gap-0.5">
              <Flame size={8} />
              BREACH
            </div>
            <div className="text-xs font-black text-maroon">{runStats.successful_attacks}</div>
          </div>
          <div className="border-r border-hairline/60 px-1">
            <div className="text-[7px] text-olive uppercase tracking-wider font-bold flex items-center gap-0.5">
              <CheckCircle2 size={8} />
              DEFEND
            </div>
            <div className="text-xs font-black text-olive">{runStats.defended_tasks ?? 0}</div>
          </div>
          <div className="pl-1">
            <div className="text-[7px] text-taupe uppercase tracking-wider font-bold">MEAN RISK</div>
            <div className={`text-xs font-black tabular-nums ${riskTone}`}>
              {avgRisk.toFixed(2)}
            </div>
          </div>
        </div>

        {/* Configuration Micro-Pills */}
        <div className="flex items-center gap-1.5 font-mono text-[8px] text-steel">
          <span className="bg-linen px-2 py-0.5 border border-hairline/60 flex items-center gap-1">
            <Layers size={9} className="text-slate" />
            {techCount} {techCount === 1 ? 'TECHNIQUE' : 'TECHNIQUES'}
          </span>
          {meta?.max_iterations && (
            <span className="bg-linen px-2 py-0.5 border border-hairline/60">
              MAX ITER: {meta.max_iterations}
            </span>
          )}
        </div>
      </div>

      {/* Outgoing Handle connecting to Config Tier */}
      <Handle
        type="source"
        position={Position.Bottom}
        style={{
          background: 'var(--color-slate)',
          width: 8,
          height: 8,
          border: '2px solid var(--color-ivory)',
          bottom: -4,
        }}
      />
    </div>
  );
});
