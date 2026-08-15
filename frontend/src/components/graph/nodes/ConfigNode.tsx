import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';

interface Props {
  data: { key: string; label: string; value: string };
}

const COLORS: Record<string, string> = {
  attacker: '#B67C4B',
  judge:    '#415438',
  target:   '#789CB7',
};

export const ConfigNode = memo(function ConfigNode({ data }: Props) {
  const accent = COLORS[data.key] ?? '#6E7280';
  return (
    <div style={{
      background: '#FFFFFF',
      border: `1px solid #D8D0C7`,
      padding: '8px 14px',
      width: 180,
      fontFamily: "'Plus Jakarta Sans', sans-serif",
    }}>
      <Handle type="target" position={Position.Top}    style={{ background: '#D8D0C7', width: 6, height: 6, border: 'none' }} />
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, letterSpacing: '0.18em', color: accent, marginBottom: 4 }}>
        {data.label}
      </div>
      <div style={{ fontSize: 11, fontWeight: 600, color: '#242934', wordBreak: 'break-all', lineHeight: 1.3 }}>
        {data.value}
      </div>
      <Handle type="source" position={Position.Bottom} style={{ background: '#D8D0C7', width: 6, height: 6, border: 'none' }} />
    </div>
  );
});
