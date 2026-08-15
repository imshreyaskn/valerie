import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { LiveTask } from '../../../types/domain';

interface Props {
  data: { task: LiveTask; expanded: boolean; onToggleExpand?: (id: string) => void };
}

const STATUS_COLOR: Record<string, string> = {
  queued:       '#A8A29D',
  mutating:     '#B67C4B',
  transmitting: '#789CB7',
  scoring:      '#B67C4B',
  breakthrough: '#6E1818',
  defended:     '#415438',
  unresolved:   '#6E7280',
  failed:       '#6E1818',
  completed:    '#415438',
};

const STATUS_BG: Record<string, string> = {
  queued:       '#F6F2EE',
  mutating:     '#FAF2EA',
  transmitting: '#EBF2F7',
  scoring:      '#FAF2EA',
  breakthrough: '#F5EAE9',
  defended:     '#EBF0E7',
  unresolved:   '#F6F2EE',
  failed:       '#F5EAE9',
  completed:    '#EBF0E7',
};

const LIVE_STATUSES = new Set(['queued', 'mutating', 'transmitting', 'scoring']);

export const TaskNode = memo(function TaskNode({ data }: Props) {
  const { task, expanded, onToggleExpand } = data;
  const isLive = LIVE_STATUSES.has(task.status);
  const accent = STATUS_COLOR[task.status] ?? '#6E7280';
  const bg     = STATUS_BG[task.status]    ?? '#F6F2EE';
  const riskPct = Math.round(task.risk_score * 100);

  return (
    <div style={{
      background: '#FFFFFF',
      border: `1px solid ${task.is_breakthrough ? '#C0392B' : '#D8D0C7'}`,
      padding: '10px 14px',
      width: 150,
      fontFamily: "'Plus Jakarta Sans', sans-serif",
      position: 'relative',
      boxShadow: task.is_breakthrough ? '0 0 0 1px #C0392B22' : 'none',
    }}>
      <Handle type="target" position={Position.Top}    style={{ background: '#D8D0C7', width: 6, height: 6, border: 'none' }} />

      {/* Live pulse ring */}
      {isLive && (
        <span style={{
          position: 'absolute', top: 8, right: 8,
          width: 7, height: 7, borderRadius: '50%',
          background: accent,
          animation: 'pulse-dot 2s ease-in-out infinite',
        }} />
      )}

      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, letterSpacing: '0.14em', color: '#A8A29D', marginBottom: 4 }}>
        {task.task_id.slice(0, 8)}
      </div>

      {/* Status pill */}
      <div style={{
        display: 'inline-block',
        background: bg,
        color: accent,
        fontSize: 8,
        fontFamily: "'JetBrains Mono', monospace",
        fontWeight: 700,
        letterSpacing: '0.12em',
        padding: '2px 6px',
        marginBottom: 8,
      }}>
        {task.status.toUpperCase()}
      </div>

      {/* Risk bar */}
      {task.risk_score > 0 && (
        <div style={{ marginBottom: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, color: '#A8A29D' }}>RISK</span>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, fontWeight: 700, color: accent }}>
              {riskPct}%
            </span>
          </div>
          <div style={{ height: 2, background: '#EDE6DF', width: '100%' }}>
            <div style={{ height: '100%', width: `${riskPct}%`, background: accent }} />
          </div>
        </div>
      )}

      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, color: '#6E7280' }}>
        ITER: {task.iterations}
      </div>

      {/* Toggle mutations button */}
      <button
        onClick={(e) => { e.stopPropagation(); onToggleExpand?.(task.task_id); }}
        style={{
          marginTop: 6,
          width: '100%',
          background: expanded ? '#242934' : '#EDE6DF',
          color: expanded ? '#F6F2EE' : '#6E7280',
          border: 'none',
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 8,
          letterSpacing: '0.1em',
          padding: '4px 0',
          cursor: 'pointer',
          fontWeight: 700,
        }}
      >
        {expanded ? '▲ HIDE MUTATIONS' : '▼ SHOW MUTATIONS'}
      </button>

      <Handle type="source" position={Position.Bottom} style={{ background: '#D8D0C7', width: 6, height: 6, border: 'none' }} />
    </div>
  );
});
