import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { ActiveRunMeta } from '../../../stores/pipelineStore';

interface Props {
  data: {
    runId: string | null;
    meta: ActiveRunMeta | null;
  };
}

export const CampaignRootNode = memo(function CampaignRootNode({ data }: Props) {
  const { runId, meta } = data;
  const domainLabel = meta?.domain?.toUpperCase().replace(/_/g, ' ') || 'CAMPAIGN';

  return (
    <div style={{
      background: '#242934',
      color: '#F6F2EE',
      padding: '14px 20px',
      width: 320,
      borderRadius: 0,
      fontFamily: "'Plus Jakarta Sans', sans-serif",
      boxShadow: '0 2px 12px rgba(36,41,52,0.18)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: '0.2em', color: '#A8A29D', textTransform: 'uppercase' }}>
          CAMPAIGN EXECUTION GRAPH
        </span>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: '0.12em', color: '#789CB7' }}>
          {meta?.started_at ? new Date(meta.started_at).toLocaleTimeString() : '—'}
        </span>
      </div>

      <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.06em', marginBottom: 6 }}>
        {domainLabel}
      </div>

      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: '#A8A29D', letterSpacing: '0.08em' }}>
        #{runId?.slice(0, 12) ?? '—'}
      </div>

      {meta?.max_iterations && (
        <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
          <span style={{
            fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: '0.12em',
            background: 'rgba(255,255,255,0.08)', padding: '2px 8px', color: '#EDE6DF',
          }}>
            MAX ITER: {meta.max_iterations}
          </span>
          {meta.selected_techniques && (
            <span style={{
              fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: '0.12em',
              background: 'rgba(255,255,255,0.08)', padding: '2px 8px', color: '#EDE6DF',
            }}>
              {meta.selected_techniques.length} TECHNIQUES
            </span>
          )}
        </div>
      )}

      <Handle type="source" position={Position.Bottom} style={{ background: '#415438', width: 8, height: 8, border: 'none' }} />
    </div>
  );
});
