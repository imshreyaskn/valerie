/**
 * v2/DebugBar.tsx
 * Top replay/control bar. Visible when replay mode is entered.
 * Shows: mode indicator, scrubber, step buttons, timestamp, event info.
 *
 * Store reads: graphStore.replay, graphStore.eventRing
 * Store writes: graphStore.enterReplayMode, graphStore.exitReplayMode,
 *               graphStore.stepReplay, graphStore.setEventCursor
 */
import { memo } from 'react';
import { Pause, Play, SkipBack, SkipForward, ChevronLeft, ChevronRight } from 'lucide-react';
import { useGraphStore } from './store/graphStore';
import { usePipelineStore } from '../../../stores/pipelineStore';

export const DebugBar = memo(function DebugBar({ visible }: { visible: boolean }) {
  const replay = useGraphStore(s => s.replay);
  const eventRing = useGraphStore(s => s.eventRing);
  const enterReplayMode = useGraphStore(s => s.enterReplayMode);
  const exitReplayMode = useGraphStore(s => s.exitReplayMode);
  const stepReplay = useGraphStore(s => s.stepReplay);
  const setEventCursor = useGraphStore(s => s.setEventCursor);
  const streamHealth = usePipelineStore(s => s.streamHealth);

  if (!visible) return null;

  const ringLen = eventRing.length;
  const isLive = replay.mode === 'live';
  const cursor = replay.eventCursor ?? ringLen;
  const currentEvent = eventRing[cursor - 1];

  return (
    <div
      className="absolute top-0 left-0 right-0 bg-slate/95 text-parchment px-4 py-2 z-20 flex items-center gap-3 select-none"
      style={{ height: 44 }}
      role="toolbar"
      aria-label="Replay controls"
    >
      {/* Live / replay toggle */}
      <button
        onClick={isLive ? enterReplayMode : exitReplayMode}
        className={`flex items-center gap-1.5 font-mono text-[10px] font-bold tracking-wider px-2 py-1 transition-colors ${
          isLive
            ? 'bg-olive text-parchment hover:bg-olive/80'
            : 'bg-camel text-parchment hover:bg-camel/80'
        }`}
        aria-label={isLive ? 'Enter replay mode' : 'Exit replay mode (return to live)'}
      >
        {isLive ? <Play size={10} /> : <Pause size={10} />}
        {isLive ? 'LIVE' : 'REPLAY'}
      </button>

      {/* Step controls (replay only) */}
      {!isLive && (
        <>
          <button
            onClick={() => setEventCursor(0)}
            className="p-1 text-taupe hover:text-parchment transition-colors"
            aria-label="Jump to start"
          >
            <SkipBack size={12} />
          </button>
          <button
            onClick={() => stepReplay(-1)}
            className="p-1 text-taupe hover:text-parchment transition-colors"
            aria-label="Step back one event"
            disabled={cursor <= 0}
          >
            <ChevronLeft size={14} />
          </button>

          {/* Scrubber */}
          <div className="flex-1 flex items-center gap-2">
            <input
              type="range"
              min={0}
              max={ringLen}
              value={cursor}
              onChange={e => setEventCursor(Number(e.target.value))}
              className="flex-1 accent-camel cursor-pointer"
              aria-label="Event scrubber"
            />
          </div>

          <button
            onClick={() => stepReplay(1)}
            className="p-1 text-taupe hover:text-parchment transition-colors"
            aria-label="Step forward one event"
            disabled={cursor >= ringLen}
          >
            <ChevronRight size={14} />
          </button>
          <button
            onClick={() => setEventCursor(ringLen)}
            className="p-1 text-taupe hover:text-parchment transition-colors"
            aria-label="Jump to latest"
          >
            <SkipForward size={12} />
          </button>
        </>
      )}

      {/* Status / position info */}
      <div className="flex items-center gap-3 ml-auto flex-shrink-0">
        {!isLive && currentEvent && (
          <>
            <span className="font-mono text-[9px] text-taupe">
              {currentEvent.type}
            </span>
            <span className="font-mono text-[9px] text-taupe tabular-nums">
              {cursor}/{ringLen}
            </span>
            <span className="font-mono text-[9px] text-taupe">
              {currentEvent.timestamp
                ? new Date(currentEvent.timestamp).toLocaleTimeString()
                : '—'}
            </span>
          </>
        )}
        {isLive && (
          <span className="font-mono text-[9px] text-taupe">
            {ringLen} EVENTS BUFFERED
          </span>
        )}
        {isLive && streamHealth !== 'connected' && (
          <span className="font-mono text-[9px] font-bold text-camel tracking-wider">
            {streamHealth.toUpperCase()}
          </span>
        )}
      </div>
    </div>
  );
});
