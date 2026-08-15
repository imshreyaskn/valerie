import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';

interface Props {
  data: { technique: string; taskCount: number };
}

export const TechniqueNode = memo(function TechniqueNode({ data }: Props) {
  const label = data.technique.replace(/_/g, ' ').toUpperCase();
  return (
    <div style={{
      background: '#EDE6DF',
      border: '1px solid #D8D0C7',
      padding: '10px 16px',
      width: 200,
      fontFamily: "'Plus Jakarta Sans', sans-serif",
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
    }}>
      <Handle type="target" position={Position.Top}    style={{ background: '#D8D0C7', width: 6, height: 6, border: 'none' }} />

      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, letterSpacing: '0.18em', color: '#6E7280', marginBottom: 2 }}>
        TECHNIQUE
      </div>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#242934', lineHeight: 1.3, letterSpacing: '0.04em', wordBreak: 'break-word' }}>
        {label}
      </div>
      <div style={{
        marginTop: 6,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 9,
        color: '#6E7280',
      }}>
        <span style={{
          display: 'inline-block',
          width: 6, height: 6,
          borderRadius: '50%',
          background: data.taskCount > 0 ? '#415438' : '#D8D0C7',
        }} />
        {data.taskCount} BRANCH{data.taskCount !== 1 ? 'ES' : ''}
      </div>

      <Handle type="source" position={Position.Bottom} style={{ background: '#D8D0C7', width: 6, height: 6, border: 'none' }} />
    </div>
  );
});
