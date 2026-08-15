import React from 'react';
import type { RunStats } from '../../types/domain';
import type { StreamHealth } from '../../stores/pipelineStore';

interface Props {
  runStats: RunStats;
  streamHealth: StreamHealth;
  eventCount: number;
}

const HealthDot: React.FC<{ health: StreamHealth }> = ({ health }) => {
  const color =
    health === 'connected'  ? '#415438' :
    health === 'connecting' ? '#B67C4B' :
    health === 'paused'     ? '#B67C4B' : '#A8A29D';
  const pulse = health === 'connected' || health === 'connecting';
  return (
    <span style={{
      display: 'inline-block',
      width: 7, height: 7,
      borderRadius: '50%',
      background: color,
      animation: pulse ? 'pulse-dot 2s ease-in-out infinite' : 'none',
    }} />
  );
};

export const GraphStatsHUD: React.FC<Props> = ({ runStats, streamHealth, eventCount }) => {
  const metrics = [
    { label: 'TOTAL',       value: runStats.total_tasks,       color: '#242934' },
    { label: 'BREACHES',    value: runStats.successful_attacks, color: '#6E1818' },
    { label: 'DEFENDED',    value: runStats.defended_tasks ?? 0, color: '#415438' },
    { label: 'IN FLIGHT',   value: runStats.total_tasks - (runStats.completed_tasks ?? 0), color: '#789CB7' },
  ];

  return (
    <div style={{
      position: 'absolute', top: 16, right: 16, zIndex: 10,
      background: '#242934',
      color: '#F6F2EE',
      padding: '12px 16px',
      width: 220,
      fontFamily: "'Plus Jakarta Sans', sans-serif",
      boxShadow: '0 4px 20px rgba(36,41,52,0.25)',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, letterSpacing: '0.2em', color: '#A8A29D' }}>
          LIVE TELEMETRY
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <HealthDot health={streamHealth} />
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, color: '#A8A29D', textTransform: 'uppercase' }}>
            {streamHealth}
          </span>
        </div>
      </div>

      {/* Metric grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 0' }}>
        {metrics.map(m => (
          <div key={m.label}>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 7, color: '#A8A29D', letterSpacing: '0.14em', marginBottom: 2 }}>
              {m.label}
            </div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 18, fontWeight: 700, color: m.color }}>
              {m.value ?? 0}
            </div>
          </div>
        ))}
      </div>

      {/* Risk + Events footer */}
      <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 7, color: '#A8A29D', letterSpacing: '0.14em', marginBottom: 2 }}>
            AVG RISK
          </div>
          <div style={{
            fontFamily: "'JetBrains Mono', monospace", fontSize: 14, fontWeight: 700,
            color: (runStats.avg_risk_score ?? 0) >= 0.7 ? '#C0392B' : (runStats.avg_risk_score ?? 0) >= 0.4 ? '#B67C4B' : '#A8A29D',
          }}>
            {(runStats.avg_risk_score ?? 0).toFixed(2)}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 7, color: '#A8A29D', letterSpacing: '0.14em', marginBottom: 2 }}>
            EVENTS
          </div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 14, fontWeight: 700, color: '#789CB7' }}>
            {eventCount}
          </div>
        </div>
      </div>

      {/* Progress bar */}
      {runStats.total_tasks > 0 && (
        <div style={{ marginTop: 10 }}>
          <div style={{ height: 2, background: 'rgba(255,255,255,0.08)', width: '100%' }}>
            <div style={{
              height: '100%',
              width: `${Math.round(((runStats.completed_tasks ?? 0) / runStats.total_tasks) * 100)}%`,
              background: '#415438',
              transition: 'width 0.4s ease',
            }} />
          </div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 7, color: '#A8A29D', marginTop: 4, textAlign: 'right' }}>
            {runStats.completed_tasks ?? 0} / {runStats.total_tasks} COMPLETE
          </div>
        </div>
      )}
    </div>
  );
};
