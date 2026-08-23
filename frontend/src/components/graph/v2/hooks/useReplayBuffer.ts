/**
 * v2/hooks/useReplayBuffer.ts
 * Side-effect hook: rebuilds replayTasks whenever replay cursor or mode changes.
 * No return value — purely keeps graphStore.replayTasks in sync.
 *
 * Store reads: graphStore.replay.mode, graphStore.replay.eventCursor, graphStore.eventRing
 * Store writes: graphStore.rebuildReplayTasks (via effect)
 */
import { useEffect } from 'react';
import { useGraphStore } from '../store/graphStore';

export function useReplayBuffer(): void {
  const mode = useGraphStore(s => s.replay.mode);
  const cursor = useGraphStore(s => s.replay.eventCursor);
  // ponytail: eventRing.length as dep is sufficient — we only need to know when events are added
  const ringLength = useGraphStore(s => s.eventRing.length);

  useEffect(() => {
    if (mode === 'paused') {
      useGraphStore.getState().rebuildReplayTasks();
    }
  }, [mode, cursor, ringLength]);
}
