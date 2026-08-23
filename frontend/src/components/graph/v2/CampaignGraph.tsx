/**
 * v2/CampaignGraph.tsx
 * v2 orchestrator — wraps Canvas with ReactFlowProvider and resets graphStore on run change.
 * Replaces CampaignGraphCanvas as the v2 entry point rendered by CampaignGraphModal.
 *
 * Store reads: pipelineStore.activeRunId
 * Store writes: graphStore.reset (on run change)
 */
import { memo, useEffect } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { usePipelineStore } from '../../../stores/pipelineStore';
import { useGraphStore } from './store/graphStore';
import { Canvas } from './Canvas';

interface Props {
  showFilters?: boolean;
  showDebugBar?: boolean;
}

export const CampaignGraph = memo(function CampaignGraph({
  showFilters = true,
  showDebugBar = true,
}: Props) {
  const activeRunId = usePipelineStore(s => s.activeRunId);
  const reset = useGraphStore(s => s.reset);

  // Reset graph state when the run changes
  useEffect(() => {
    reset();
  }, [activeRunId, reset]);

  return (
    <ReactFlowProvider>
      <Canvas showFilters={showFilters} showDebugBar={showDebugBar} />
    </ReactFlowProvider>
  );
});
