/**
 * v2/CampaignGraph.tsx
 * Top-level Orchestrator for Campaign Graph.
 * Wraps Canvas with ReactFlowProvider and initializes state on run change.
 */
import { memo, useEffect, useRef } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { usePipelineStore } from '../../../stores/pipelineStore';
import { useGraphStore } from './store/graphStore';
import { Canvas } from './Canvas';

interface Props {
  className?: string;
}

export const CampaignGraph = memo(function CampaignGraph({ className = '' }: Props) {
  const activeRunId = usePipelineStore((s) => s.activeRunId);
  const liveTasks = usePipelineStore((s) => s.liveTasks);
  const reset = useGraphStore((s) => s.reset);
  const expandAllBreakthroughs = useGraphStore((s) => s.expandAllBreakthroughs);
  const initializedRunIdRef = useRef<string | null>(null);

  // Initialize graph state and auto-expand breakthroughs once per run ID
  useEffect(() => {
    if (activeRunId !== initializedRunIdRef.current) {
      initializedRunIdRef.current = activeRunId;
      reset();
      if (liveTasks && Object.keys(liveTasks).length > 0) {
        expandAllBreakthroughs(liveTasks);
      }
    } else if (
      activeRunId &&
      useGraphStore.getState().expandedTaskIds.length === 0 &&
      Object.keys(liveTasks).length > 0
    ) {
      expandAllBreakthroughs(liveTasks);
    }
  }, [activeRunId, liveTasks, reset, expandAllBreakthroughs]);

  return (
    <ReactFlowProvider>
      <div className={`w-full h-full relative ${className}`}>
        <Canvas />
      </div>
    </ReactFlowProvider>
  );
});
