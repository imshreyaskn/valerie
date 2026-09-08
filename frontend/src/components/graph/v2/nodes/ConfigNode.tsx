/**
 * v2/nodes/ConfigNode.tsx
 * Configuration Cards for Tier 1: Attacker Model, Target Endpoint, Judge Model.
 * Displays initial settings cleanly within the forensic DAG hierarchy.
 */
import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { useGraphStore } from '../store/graphStore';
import { Cpu, Server, Scale } from 'lucide-react';

interface Props {
  data: {
    key: 'attacker' | 'target' | 'judge';
    label: string;
    sublabel: string;
    value: string;
    details?: string;
    isFlowNode?: boolean;
  };
  id?: string;
}

const CONFIG_THEMES: Record<string, { icon: typeof Cpu; accent: string; badge: string }> = {
  attacker: {
    icon: Cpu,
    accent: 'text-camel border-camel/40 bg-camel-muted/40',
    badge: 'bg-camel-muted text-camel',
  },
  target: {
    icon: Server,
    accent: 'text-powder border-powder/40 bg-powder-muted/40',
    badge: 'bg-powder-muted text-powder',
  },
  judge: {
    icon: Scale,
    accent: 'text-olive border-olive/40 bg-olive-muted/40',
    badge: 'bg-olive-muted text-olive',
  },
};

export const ConfigNode = memo(function ConfigNode({ data, id }: Props) {
  const { key, label, sublabel, value, details, isFlowNode } = data;
  const selectedNodeId = useGraphStore((s) => s.selectedNodeId);
  const isSelected = selectedNodeId === (id ?? `config-${key}`);
  const theme = CONFIG_THEMES[key] ?? CONFIG_THEMES.attacker;
  const Icon = theme.icon;

  return (
    <div
      className={`bg-ivory border p-3 font-sans transition-all select-none ${
        isSelected
          ? 'border-slate ring-2 ring-slate ring-offset-2 shadow-md'
          : 'border-hairline hover:border-steel'
      }`}
      style={{ width: 220, position: 'relative' }}
      role="treeitem"
      aria-selected={isSelected}
    >
      {/* Inflow Handle from Root */}
      <Handle
        type="target"
        position={Position.Top}
        style={{
          background: 'var(--color-hairline)',
          width: 7,
          height: 7,
          border: '1px solid var(--color-steel)',
          top: -4,
        }}
      />

      {/* Header with Icon & Index */}
      <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-hairline/60">
        <div className="flex items-center gap-1.5 font-mono text-[9px] tracking-wider uppercase text-steel font-semibold">
          <Icon size={11} className={theme.badge.split(' ')[1]} />
          <span>{sublabel}</span>
        </div>
        <span className={`font-mono text-[8px] font-bold uppercase px-1.5 py-0.2 rounded-xs ${theme.badge}`}>
          {label}
        </span>
      </div>

      {/* Value */}
      <div className="font-mono text-[11px] font-bold text-slate break-all leading-snug mb-1">
        {value || 'DEFAULT'}
      </div>

      {/* Sub-details (e.g. endpoint provider, threshold) */}
      {details && (
        <div className="font-mono text-[9px] text-taupe truncate">
          {details}
        </div>
      )}

      {/* Outflow Handle for Flow Node (Target Endpoint connects to Techniques) */}
      {isFlowNode && (
        <Handle
          type="source"
          position={Position.Bottom}
          style={{
            background: 'var(--color-slate)',
            width: 7,
            height: 7,
            border: '1px solid var(--color-ivory)',
            bottom: -4,
          }}
        />
      )}
    </div>
  );
});
