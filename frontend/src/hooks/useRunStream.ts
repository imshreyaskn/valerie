import { useEffect, useRef } from 'react';
import { usePipelineStore } from '../stores/pipelineStore';
import type { TaskEvent } from '../stores/pipelineStore';

export function useRunStream(runId: string | null) {
  const processEvent = usePipelineStore((state) => state.processEvent);
  const setActiveRun = usePipelineStore((state) => state.setActiveRun);
  const setStreamHealth = usePipelineStore((state) => state.setStreamHealth);
  const reconnectTrigger = usePipelineStore((state) => state.reconnectTrigger);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!runId) {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      setStreamHealth('idle');
      return;
    }

    // Initialize the store for this run
    setActiveRun(runId);
    setStreamHealth('connecting');

    // Close any existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    // Connect to the SSE endpoint with auth token query param (Phase 3 SSE requirement)
    const token = localStorage.getItem('vl_jwt');
    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8080';
    const url = `${baseUrl}/runs/stream/${runId}?token=${token || ''}`;
    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setStreamHealth('connected');
    };

    eventSource.onmessage = (e) => {
      try {
        setStreamHealth('connected');
        const data = JSON.parse(e.data);
        const eventEnvelope = data as TaskEvent;
        processEvent(eventEnvelope);
      } catch (err) {
        console.error('Failed to parse SSE message', err);
      }
    };

    eventSource.onerror = (e) => {
      console.warn('SSE stream paused or disconnected', e);
      setStreamHealth('paused');
    };

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [runId, reconnectTrigger, processEvent, setActiveRun, setStreamHealth]);
}

