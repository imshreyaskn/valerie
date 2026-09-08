/**
 * v2/hooks/useFilteredTasks.ts
 * Applies FilterState to liveTasks -> returns { visibleIds, dimmedIds }.
 * Standardized with Mission Control's matchesFilters predicate.
 */
import { useMemo } from 'react';
import { usePipelineStore } from '../../../../stores/pipelineStore';
import { useGraphStore } from '../store/graphStore';
import type { LiveTask } from '../../../../types/domain';
import type { FilterState } from '../../../../types/filters';
import { matchesFilters } from '../../../../types/filters';

export function applyFilters(
  tasks: Record<string, LiveTask>,
  filters: FilterState
): { visibleIds: Set<string>; dimmedIds: Set<string> } {
  const visible = new Set<string>();
  const dimmed = new Set<string>();

  for (const task of Object.values(tasks)) {
    if (matchesFilters(task, filters)) {
      visible.add(task.task_id);
    } else {
      dimmed.add(task.task_id);
    }
  }

  return { visibleIds: visible, dimmedIds: dimmed };
}

export function useFilteredTasks(): { visibleIds: Set<string>; dimmedIds: Set<string> } {
  const liveTasks = usePipelineStore((s) => s.liveTasks);
  const filters = useGraphStore((s) => s.filters);

  return useMemo(() => applyFilters(liveTasks, filters), [liveTasks, filters]);
}
