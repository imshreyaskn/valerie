import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';

interface Props {
  data: {
    iteration: number;
    prompt?: string;
    riskScore?: number;
    status: string;
  };
}

export const MutationNode = memo(function MutationNode({ data }: Props) {
  const { iteration, prompt, riskScore, status } = data;
  const isFinal  = riskScore !== undefined;
  const isScored = status === 'scoring' || isFinal;
  const accent   = isScored ? '#B67C4B' : '#789CB7';
  const excerpt  = prompt ? prompt.slice(0, 48) + (prompt.length > 48 ? '…' : '') : null;

  return (
    <div style={{
      background: '#F6F2EE',
      border: '1px dashed #D8D0C7',
      padding: '8px 12px',
      width: 145,
      fontFamily: "'Plus Jakarta Sans', sans-serif",
    }}>
      <Handle type="target" position={Position.Top}    style={{ background: '#D8D0C7', width: 5, height: 5, border: 'none' }} />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, color: accent, letterSpacing: '0.14em', fontWeight: 700 }}>
          ITER {iteration}
        </span>
        {isFinal && (
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: accent, fontWeight: 700 }}>
            {riskScore!.toFixed(2)}
          </span>
        )}
      </div>

      {excerpt && (
        <div style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 8,
          color: '#6E7280',
          lineHeight: 1.4,
          wordBreak: 'break-word',
          padding: '4px 0',
        }}>
          "{excerpt}"
        </div>
      )}

      {!excerpt && (
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, color: '#A8A29D' }}>
          MUTATING
        </div>
      )}

      <Handle type="source" position={Position.Bottom} style={{ background: '#D8D0C7', width: 5, height: 5, border: 'none' }} />
    </div>
  );
});
