import React, { useState, useMemo } from 'react';
import { ChevronDown, X, ShieldAlert, ExternalLink } from 'lucide-react';
import { usePipelineStore } from '../stores/pipelineStore';
import { useWorkspaceStore } from '../stores/workspaceStore';
import { StatusBadge } from './ui';
import type { IntelligenceAlert } from '../types/domain';

function timeAgo(iso: string): string {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function AlertRow({
  alert,
  index,
  onInspectTask,
}: {
  alert: IntelligenceAlert;
  index: number;
  onInspectTask?: (taskId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const isCritical = alert.severity === 'critical' || alert.severity === 'high';
  const isWarning = alert.severity === 'warning' || alert.severity === 'medium';
  const indexStr = String(index + 1).padStart(2, '0');

  return (
    <div className="hairline-bottom last:border-b-0 font-mono">
      <div className="flex items-start hover:bg-linen/40 transition-colors">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex-1 text-left p-3 flex items-start gap-2.5 cursor-pointer min-w-0"
          aria-expanded={expanded}
          aria-controls={`alert-detail-${alert.id}`}
        >
          <span className="text-[10px] text-taupe shrink-0 mt-0.5">{indexStr}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <StatusBadge
                label={alert.severity.toUpperCase()}
                variant={isCritical ? 'maroon' : isWarning ? 'camel' : 'powder'}
                pulse={isCritical}
              />
              <span className="text-[10px] text-taupe shrink-0">{timeAgo(alert.timestamp)}</span>
            </div>
            <p className="text-xs text-slate mt-1 font-sans font-medium leading-snug break-words">
              {alert.message}
            </p>
          </div>
          <ChevronDown
            className={`w-3.5 h-3.5 text-taupe shrink-0 mt-1 transition-transform ${
              expanded ? 'rotate-180' : ''
            }`}
            aria-hidden="true"
          />
        </button>

        {alert.task_id && onInspectTask && (
          <button
            onClick={() => onInspectTask(alert.task_id!)}
            className="p-3 text-steel hover:text-slate hover:bg-cream/40 transition-colors cursor-pointer shrink-0"
            title="Inspect Specimen"
            aria-label={`Inspect task ${alert.task_id}`}
          >
            <ExternalLink size={12} />
          </button>
        )}
      </div>

      {expanded && (
        <div id={`alert-detail-${alert.id}`} className="px-3 pb-3">
          <div className="bg-linen/60 p-3 border border-hairline space-y-2 text-[11px]">
            {alert.task_id && (
              <div className="text-[10px] text-steel flex items-center justify-between">
                <span>TASK REF: <code className="text-slate font-bold">{alert.task_id}</code></span>
                {onInspectTask && (
                  <button
                    onClick={() => onInspectTask(alert.task_id!)}
                    className="text-slate hover:underline font-bold uppercase"
                  >
                    INSPECT →
                  </button>
                )}
              </div>
            )}
            <pre className="font-mono text-[10px] text-slate overflow-x-auto leading-relaxed whitespace-pre-wrap break-all max-h-48">
              {JSON.stringify(alert.payload, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

export const IntelligenceFeed: React.FC = () => {
  const intelligenceFeed = usePipelineStore((s) => s.intelligenceFeed);
  const clearFeed = usePipelineStore((s) => s.clearFeed);
  const openInspector = useWorkspaceStore((s) => s.openInspector);

  const [feedMode, setFeedMode] = useState<'signal' | 'all'>('signal');

  const filteredFeed = useMemo(() => {
    if (feedMode === 'all') return intelligenceFeed;
    return intelligenceFeed.filter(
      (a) =>
        a.severity === 'critical' ||
        a.severity === 'high' ||
        a.severity === 'warning' ||
        a.type === 'anomaly.detected' ||
        a.type === 'weakness.discovered' ||
        a.type === 'cluster_formed'
    );
  }, [intelligenceFeed, feedMode]);

  return (
    <aside
      className="w-full h-full flex flex-col select-none border-l border-hairline font-mono"
      aria-label="Live Intelligence Feed"
    >
      {/* Header — aligned with SpecimenLedger table header row using vertical line segregation */}
      <div className="h-12 hairline-bottom bg-linen/30 flex items-stretch justify-between shrink-0 p-0">
        <div className="flex items-center gap-2 px-4 min-w-0">
          <span className="w-1.5 h-1.5 rounded-full bg-olive animate-pulse-dot shrink-0" />
          <span className="text-xs font-mono font-bold tracking-wider uppercase text-slate truncate">
            INTELLIGENCE STREAM ({filteredFeed.length})
          </span>
        </div>

        {/* Signal vs All toggle — Grouped by full-height line, options inside by small lines */}
        <div className="flex items-center gap-2.5 px-4 h-full shrink-0 border-l border-hairline font-mono text-[10px]">
          <button
            onClick={() => setFeedMode('signal')}
            className={`transition-colors cursor-pointer uppercase font-mono tracking-wider ${
              feedMode === 'signal'
                ? 'text-slate font-bold'
                : 'text-taupe hover:text-slate'
            }`}
            title="High-priority anomaly signals"
          >
            SIGNAL
          </button>

          <span className="h-3 w-px bg-hairline" />

          <button
            onClick={() => setFeedMode('all')}
            className={`transition-colors cursor-pointer uppercase font-mono tracking-wider ${
              feedMode === 'all'
                ? 'text-slate font-bold'
                : 'text-taupe hover:text-slate'
            }`}
            title="All telemetry stream events"
          >
            ALL
          </button>

          {intelligenceFeed.length > 0 && (
            <>
              <span className="h-3 w-px bg-hairline" />
              <button
                onClick={clearFeed}
                className="text-taupe hover:text-slate transition-colors cursor-pointer p-0.5"
                title="Clear feed"
                aria-label="Clear feed"
              >
                <X size={12} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Stream List */}
      <div
        className="flex-1 overflow-y-auto divide-y divide-hairline"
        role="log"
        aria-live="polite"
        aria-relevant="additions"
      >
        {filteredFeed.length === 0 ? (
          <div className="py-16 px-6 text-center select-none font-mono">
            <ShieldAlert size={20} className="text-steel/60 mx-auto mb-2.5" strokeWidth={1.75} />
            <p className="text-xs font-bold text-slate uppercase tracking-wider">NO ACTIVE ANOMALIES</p>
            <p className="text-[11px] text-steel mt-1 leading-relaxed max-w-xs mx-auto">
              DBSCAN clusters, execution outliers, and breakthrough findings stream here live.
            </p>
          </div>
        ) : (
          filteredFeed.map((alert, idx) => (
            <AlertRow
              key={alert.id}
              alert={alert}
              index={idx}
              onInspectTask={(taskId) => openInspector({ type: 'task', id: taskId })}
            />
          ))
        )}
      </div>
    </aside>
  );
};
