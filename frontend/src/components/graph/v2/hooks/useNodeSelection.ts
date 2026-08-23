/**
 * v2/hooks/useNodeSelection.ts
 * Thin store wrapper for selection actions — components don't import graphStore directly.
 *
 * Store reads: graphStore.selectedTaskId, graphStore.selectedMutationIter
 * Store writes: graphStore.selectTask, graphStore.selectMutation, graphStore.toggleMultiSelect, graphStore.selectNodeId
 */
import { useGraphStore } from '../store/graphStore';

export function useNodeSelection() {
  const selectedTaskId = useGraphStore(s => s.selectedTaskId);
  const selectedMutationIter = useGraphStore(s => s.selectedMutationIter);
  const selectTask = useGraphStore(s => s.selectTask);
  const selectMutation = useGraphStore(s => s.selectMutation);
  const toggleMultiSelect = useGraphStore(s => s.toggleMultiSelect);
  const selectNodeId = useGraphStore(s => s.selectNodeId);

  return { selectedTaskId, selectedMutationIter, selectTask, selectMutation, toggleMultiSelect, selectNodeId };
}
