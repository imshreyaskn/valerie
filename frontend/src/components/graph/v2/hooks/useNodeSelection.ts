/**
 * v2/hooks/useNodeSelection.ts
 * Thin wrapper for selection actions on the Campaign Graph.
 */
import { useGraphStore } from '../store/graphStore';

export function useNodeSelection() {
  const selectedTaskId = useGraphStore((s) => s.selectedTaskId);
  const selectedMutationIter = useGraphStore((s) => s.selectedMutationIter);
  const selectedNodeId = useGraphStore((s) => s.selectedNodeId);
  const selectTask = useGraphStore((s) => s.selectTask);
  const selectMutation = useGraphStore((s) => s.selectMutation);
  const selectNodeId = useGraphStore((s) => s.selectNodeId);
  const toggleExpandTask = useGraphStore((s) => s.toggleExpandTask);

  return {
    selectedTaskId,
    selectedMutationIter,
    selectedNodeId,
    selectTask,
    selectMutation,
    selectNodeId,
    toggleExpandTask,
  };
}
