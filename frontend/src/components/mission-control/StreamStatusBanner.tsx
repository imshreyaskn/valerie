import React, { useState, useEffect } from 'react';
import { RefreshCw, AlertTriangle, ChevronDown } from 'lucide-react';
import { usePipelineStore } from '../../stores/pipelineStore';

export const StreamStatusBanner: React.FC = () => {
  const streamHealth = usePipelineStore((s) => s.streamHealth);
  const lastEventAt = usePipelineStore((s) => s.lastEventAt);
  const eventCount = usePipelineStore((s) => s.eventCount);
  const activeRunId = usePipelineStore((s) => s.activeRunId);
  const triggerReconnect = usePipelineStore((s) => s.triggerReconnect);

  const [secondsSinceLastEvent, setSecondsSinceLastEvent] = useState<number | null>(null);
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  useEffect(() => {
    if (!lastEventAt) {
      setSecondsSinceLastEvent(null);
      return;
    }
    const update = () => {
      const diff = Math.max(0, Math.floor((Date.now() - new Date(lastEventAt).getTime()) / 1000));
      setSecondsSinceLastEvent(diff);
    };
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [lastEventAt]);

  // If stream is paused or in error state
  if (streamHealth === 'paused') {
    return (
      <div
        className="mb-6 p-4 bg-camel-muted border border-camel text-brown font-mono text-xs flex flex-col md:flex-row md:items-center justify-between gap-3 animate-fade-in"
        role="alert"
        aria-live="assertive"
      >
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-4 h-4 text-camel shrink-0" strokeWidth={2.2} />
          <div>
            <span className="font-bold uppercase tracking-wider text-slate">
              STREAM PAUSED
            </span>
            <span className="mx-2 text-steel">—</span>
            <span>
              {secondsSinceLastEvent !== null
                ? `Last telemetry event received ${secondsSinceLastEvent}s ago (${eventCount} total events in cache)`
                : 'Connection interrupted. Preserving cached forensic specimens.'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => setShowDiagnostics((v) => !v)}
            className="px-2.5 py-1 text-[11px] bg-ivory border border-hairline hover:bg-linen text-steel hover:text-slate uppercase flex items-center gap-1 cursor-pointer"
            aria-expanded={showDiagnostics}
          >
            <span>DIAGNOSTICS</span>
            <ChevronDown size={12} className={`transition-transform ${showDiagnostics ? 'rotate-180' : ''}`} />
          </button>

          <button
            onClick={triggerReconnect}
            className="px-3 py-1 bg-slate text-parchment font-bold hover:bg-slate/90 transition-colors uppercase flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <RefreshCw size={12} className="animate-spin-once" />
            <span>RECONNECT STREAM</span>
          </button>
        </div>

        {showDiagnostics && (
          <div className="w-full pt-3 hairline-top mt-2 text-[11px] text-slate grid grid-cols-1 md:grid-cols-3 gap-2">
            <div>
              <span className="text-taupe uppercase">TARGET STREAM:</span>{' '}
              <code className="text-steel font-bold">/runs/stream/{activeRunId}</code>
            </div>
            <div>
              <span className="text-taupe uppercase">TOTAL CAPTURED:</span>{' '}
              <strong className="text-slate">{eventCount} EVENTS</strong>
            </div>
            <div>
              <span className="text-taupe uppercase">STREAM BUS:</span>{' '}
              <span className="text-olive font-bold">REDIS STREAMS CONSUMER</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  // If stream is connecting
  if (streamHealth === 'connecting') {
    return (
      <div className="mb-4 px-4 py-2 bg-linen/60 border border-hairline text-steel font-mono text-xs flex items-center justify-between">
        <div className="flex items-center gap-2">
          <RefreshCw className="w-3.5 h-3.5 animate-spin text-slate" />
          <span>ESTABLISHING SECURE SSE EVENT STREAM TO REDIS BUS...</span>
        </div>
        <span className="text-[10px] text-taupe uppercase">NEGOTIATING JWT CREDENTIALS</span>
      </div>
    );
  }

  return null;
};
