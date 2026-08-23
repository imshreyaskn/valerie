/**
 * v2/nodes/ConfigNode.tsx
 * Attacker / Judge / Target config cards.
 * Context nodes (attacker, judge) are visually distinct from flow node (target).
 */
import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { useGraphStore } from '../store/graphStore';

interface Props {
  data: { key: string; label: string; value: string };
}

// Token class per config key — maps to CSS var tokens
const ACCENT_CLASS: Record<string, string> = {
  attacker: 'text-camel border-camel/30',
  judge:    'text-olive border-olive/30',
  target:   'text-powder border-powder/30',
};

export const ConfigNode = memo(function ConfigNode({ data, id }: Props & { id?: string }) {
  const { key, label, value } = data;
  const selectedNodeId = useGraphStore(s => s.selectedNodeId);
  const isSelected = selectedNodeId === (id ?? `config-${key}`);
  const accentClass = ACCENT_CLASS[key] ?? 'text-steel border-hairline';
  const isFlowNode = key === 'target'; // only target connects forward

  return (
    <div
      className={`bg-ivory border border-hairline p-3 font-sans ${isSelected ? 'selected-ring' : ''}`}
      style={{ width: 180, position: 'relative' }}
    >
      <Handle type="target" position={Position.Top} style={{ background: 'var(--color-hairline)', width: 6, height: 6, border: 'none' }} />

      <div className={`font-mono text-[10px] tracking-widest uppercase mb-1 ${accentClass.split(' ')[0]}`}>
        {label}
      </div>
      <div className="font-mono text-[11px] font-semibold text-slate break-all leading-tight">
        {value}
      </div>

      {/* Only target has a source handle (connects to techniques) */}
      {isFlowNode && (
        <Handle type="source" position={Position.Bottom} style={{ background: 'var(--color-hairline)', width: 6, height: 6, border: 'none' }} />
      )}
    </div>
  );
});
