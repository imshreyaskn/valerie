import { useEffect, useRef } from 'react';
import { usePipelineStore } from '../stores/pipelineStore';
import type { TaskEvent } from '../stores/pipelineStore';
import { useGraphStore } from '../components/graph/v2/store/graphStore';
import { api } from '../utils/api';

const MAX_CONSECUTIVE_FAILURES = 3;

export function useRunStream(runId: string | null) {
  const processEventsBatch = usePipelineStore((state) => state.processEventsBatch);
  const subscribeRun = usePipelineStore((state) => state.subscribeRun);
  const setStreamHealth = usePipelineStore((state) => state.setStreamHealth);
  const reconnectTrigger = usePipelineStore((state) => state.reconnectTrigger);
  const eventSourceRef = useRef<EventSource | null>(null);
  const consecutiveFailuresRef = useRef(0);
  const eventQueueRef = useRef<TaskEvent[]>([]);
  const frameHandleRef = useRef<number | null>(null);

  useEffect(() => {
    if (!runId) {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      setStreamHealth('idle');
      return;
    }

    let cancelled = false;
    let opened = false;

    // Register interest so processEvent accepts this run's events.
    subscribeRun(runId);
    setStreamHealth('connecting');

    const flushQueue = () => {
      frameHandleRef.current = null;
      if (eventQueueRef.current.length > 0) {
        const batch = eventQueueRef.current;
        eventQueueRef.current = [];
        processEventsBatch(batch);
        const graphState = useGraphStore.getState();
        for (let i = 0; i < batch.length; i++) {
          graphState.pushEvent(batch[i]);
        }
      }
    };

    const connect = async () => {
      try {
        // Short-lived, audience-scoped token (120s). The long-lived session
        // JWT never travels in a URL (audit H3).
        const { token } = await api.getStreamToken(runId);
        if (cancelled) return;

        const baseUrl = import.meta.env.VITE_API_URL || '/api';
        const url = `${baseUrl}/runs/stream/${runId}?token=${encodeURIComponent(token)}`;
        const eventSource = new EventSource(url);
        eventSourceRef.current = eventSource;

        eventSource.onopen = () => {
          opened = true;
          consecutiveFailuresRef.current = 0;
          setStreamHealth('connected');
        };

        eventSource.onmessage = (e) => {
          try {
            const eventEnvelope = JSON.parse(e.data) as TaskEvent;
            eventQueueRef.current.push(eventEnvelope);

            if (frameHandleRef.current === null) {
              frameHandleRef.current = requestAnimationFrame(flushQueue);
            }
          } catch (err) {
            console.error('Failed to parse SSE message', err);
          }
        };

        eventSource.onerror = () => {
          // Native EventSource auto-retries. If the connection never opened
          // or keeps failing (expired token / 401), break the retry loop
          // instead of spinning forever.
          consecutiveFailuresRef.current += 1;
          if (!opened || consecutiveFailuresRef.current >= MAX_CONSECUTIVE_FAILURES) {
            eventSource.close();
            if (eventSourceRef.current === eventSource) eventSourceRef.current = null;
            setStreamHealth('paused');
            return;
          }
          setStreamHealth('paused');
        };
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to obtain stream token', err);
          setStreamHealth('paused');
        }
      }
    };

    void connect();

    return () => {
      cancelled = true;
      if (frameHandleRef.current !== null) {
        cancelAnimationFrame(frameHandleRef.current);
        frameHandleRef.current = null;
      }
      if (eventQueueRef.current.length > 0) {
        flushQueue();
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [runId, reconnectTrigger, processEventsBatch, subscribeRun, setStreamHealth]);
}
