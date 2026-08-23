/**
 * v2/nodes/RootNode.tsx
 * Campaign root banner — run id, domain, started_at, technique count, summary counts.
 * Ported from CampaignRootNode with Tailwind tokens replacing inline hex.
 */
import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { ActiveRunMeta } from '../../../../stores/pipelineStore';
import { usePipelineStore } from '../../../../stores/pipelineStore';
import { useGraphStore } from '../store/graphStore';

interface Props {
  data: { runId: string | null; meta: ActiveRunMeta | null };
}

export const RootNode = memo(function RootNode({ data }: Props) {
  const { runId, meta } = data;
  const domainLabel = meta?.domain?.toUpperCase().replace(/_/g, ' ') || 'CAMPAIGN';
  const runStats = usePipelineStore(s => s.runStats);
  const selectedNodeId = useGraphStore(s => s.selectedNodeId);
  const isSelected = selectedNodeId === 'root';

  return (
    <div
      className={`bg-slate text-parchment p-4 font-sans shadow-lg ${isSelected ? 'selected-ring' : ''}`}
      style={{ width: 320, position: 'relative' }}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="font-mono text-[10px] tracking-widest uppercase text-taupe">
          CAMPAIGN EXECUTION GRAPH
        </span>
        <span className="font-mono text-[9px] text-powder">
          {meta?.started_at ? new Date(meta.started_at).toLocaleTimeString() : '—'}
        </span>
      </div>

      <div className="text-[13px] font-bold tracking-tight uppercase mb-1">
        {domainLabel}
      </div>

      <div className="font-mono text-[11px] text-taupe tracking-wide mb-3">
        #{(runId ?? '—').slice(0, 12)}
      </div>

      {/* Summary stats row */}
      {runStats.total_tasks > 0 && (
        <div className="flex gap-3 pt-2 border-t border-white/10">
          <div>
            <div className="font-mono text-[7px] text-taupe tracking-wider">TOTAL</div>
            <div className="font-mono text-sm font-bold text-parchment">{runStats.total_tasks}</div>
          </div>
          <div>
            <div className="font-mono text-[7px] text-taupe tracking-wider">BREACHES</div>
            <div className="font-mono text-sm font-bold text-maroon-muted">{runStats.successful_attacks}</div>
          </div>
          <div>
            <div className="font-mono text-[7px] text-taupe tracking-wider">DEFENDED</div>
            <div className="font-mono text-sm font-bold text-olive-muted">{runStats.defended_tasks ?? 0}</div>
          </div>
          <div>
            <div className="font-mono text-[7px] text-taupe tracking-wider">AVG RISK</div>
            <div className="font-mono text-sm font-bold tabular-nums text-parchment">
              {(runStats.avg_risk_score ?? 0).toFixed(2)}
            </div>
          </div>
        </div>
      )}

      {/* Technique + iter badges */}
      {(meta?.max_iterations || meta?.selected_techniques) && (
        <div className="flex gap-2 mt-2">
          {meta.max_iterations && (
            <span className="font-mono text-[9px] tracking-wider bg-white/10 text-linen px-2 py-0.5">
              MAX ITER: {meta.max_iterations}
            </span>
          )}
          {meta.selected_techniques && (
            <span className="font-mono text-[9px] tracking-wider bg-white/10 text-linen px-2 py-0.5">
              {meta.selected_techniques.length} TECHNIQUES
            </span>
          )}
        </div>
      )}

      <Handle type="source" position={Position.Bottom} style={{ background: 'var(--color-olive)', width: 8, height: 8, border: 'none' }} />
    </div>
  );
});
