/**
 * v2/hooks/useFilteredTasks.ts
 * Applies graphStore.filters to liveTasks → returns {visibleIds, dimmedIds}.
 * Filters NEVER remove tasks from the graph — they only dim them (opacity 0.15).
 *
 * Store reads: pipelineStore.liveTasks, graphStore.filters
 */
import { useMemo } from 'react';
import { usePipelineStore } from '../../../../stores/pipelineStore';
import { useGraphStore } from '../store/graphStore';
import type { LiveTask } from '../../../../types/domain';
import type { GraphFilters } from '../types';

const TERMINAL_STATUSES = new Set(['breakthrough', 'defended', 'unresolved', 'failed', 'completed']);

export function applyFilters(
  tasks: Record<string, LiveTask>,
  filters: GraphFilters
): { visibleIds: Set<string>; dimmedIds: Set<string> } {
  const visible = new Set<string>();
  const dimmed = new Set<string>();

  for (const task of Object.values(tasks)) {
    let show = true;

    if (filters.statuses.length > 0 && !filters.statuses.includes(task.status)) show = false;
    if (filters.techniques.length > 0 && !filters.techniques.includes(task.technique)) show = false;
    if (filters.harmTypes.length > 0 && !filters.harmTypes.includes(task.harm_type)) show = false;
    if (filters.breakthroughOnly && !task.is_breakthrough) show = false;
    if (!filters.showResolved && TERMINAL_STATUSES.has(task.status)) show = false;

    if (show) visible.add(task.task_id);
    else dimmed.add(task.task_id);
  }

  return { visibleIds: visible, dimmedIds: dimmed };
}

export function useFilteredTasks(): { visibleIds: Set<string>; dimmedIds: Set<string> } {
  const liveTasks = usePipelineStore(s => s.liveTasks);
  const filters = useGraphStore(s => s.filters);

  return useMemo(() => applyFilters(liveTasks, filters), [liveTasks, filters]);
}
