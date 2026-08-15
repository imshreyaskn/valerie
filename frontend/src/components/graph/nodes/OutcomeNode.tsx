import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';

interface Props {
  data: {
    status: string;
    riskScore: number;
    iterations: number;
  };
}

export const OutcomeNode = memo(function OutcomeNode({ data }: Props) {
  const { status, riskScore, iterations } = data;
  const isBreakthrough = status === 'breakthrough';
  const isFailed       = status === 'unresolved' || status === 'failed';

  const bg      = isBreakthrough ? '#F5EAE9' : isFailed ? '#F6F2EE' : '#EBF0E7';
  const border  = isBreakthrough ? '#C0392B' : isFailed ? '#A8A29D' : '#415438';
  const color   = isBreakthrough ? '#6E1818' : isFailed ? '#6E7280' : '#415438';
  const glyph   = isBreakthrough ? '◆' : isFailed ? '✗' : '✓';
  const label   = isBreakthrough ? 'BREAKTHROUGH' : isFailed ? 'UNRESOLVED' : 'DEFENDED';

  return (
    <div style={{
      background: bg,
      border: `2px solid ${border}`,
      padding: '10px 16px',
      width: 150,
      fontFamily: "'Plus Jakarta Sans', sans-serif",
      textAlign: 'center',
    }}>
      <Handle type="target" position={Position.Top} style={{ background: border, width: 6, height: 6, border: 'none' }} />

      <div style={{ fontSize: 16, color, marginBottom: 4 }}>{glyph}</div>
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', color }}>
        {label}
      </div>

      <div style={{ marginTop: 8, display: 'flex', justifyContent: 'center', gap: 12 }}>
        <div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, color: '#A8A29D' }}>RISK</div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 700, color }}>
            {riskScore.toFixed(2)}
          </div>
        </div>
        <div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, color: '#A8A29D' }}>ITER</div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 700, color: '#242934' }}>
            {iterations}
          </div>
        </div>
      </div>
    </div>
  );
});
