/**
 * v2/store/graphStore.ts
 * Clean Zustand store for Campaign Graph: selection, expanded mutation branches,
 * inspector drawer state, and unified filters.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { TaskEvent, LiveTask } from '../../../../stores/pipelineStore';
import type { FilterState } from '../../../../types/filters';

export interface GraphStoreState {
  // Selection
  selectedTaskId: string | null;
  selectedMutationIter: number | null;
  selectedNodeId: string | null; // For root ('campaignRoot') or config nodes ('config-attacker', 'config-target', 'config-judge')
  expandedTaskIds: string[]; // List of task IDs whose mutation chains are currently expanded

  // Inspector
  inspectorOpen: boolean;
  inspectorWidth: number; // Clamped 360 - 540

  // Filters — Unified with Mission Control FilterState
  filters: FilterState;

  // Viewport / Zoom
  zoomLevel: number;

  // Actions
  selectTask: (id: string | null, iter?: number | null) => void;
  selectMutation: (taskId: string, iter: number | null) => void;
  selectNodeId: (id: string | null) => void;
  toggleExpandTask: (id: string) => void;
  expandAllBreakthroughs: (tasks: Record<string, LiveTask>) => void;
  expandAllTasks: (taskIds: string[]) => void;
  collapseAll: () => void;
  setFilters: (update: Partial<FilterState>) => void;
  resetFilters: () => void;
  openInspector: () => void;
  closeInspector: () => void;
  setInspectorWidth: (w: number) => void;
  setZoomLevel: (z: number) => void;
  pushEvent: (event: TaskEvent) => void;
  reset: () => void;
}

export const DEFAULT_GRAPH_FILTERS: FilterState = {
  status: 'ALL',
  technique: 'ALL',
  harmType: 'ALL',
  minRisk: 0,
  searchQuery: '',
};

export const useGraphStore = create<GraphStoreState>()(
  persist(
    (set, get) => ({
      // Initial state
      selectedTaskId: null,
      selectedMutationIter: null,
      selectedNodeId: null,
      expandedTaskIds: [],

      inspectorOpen: false,
      inspectorWidth: 420,

      filters: DEFAULT_GRAPH_FILTERS,
      zoomLevel: 1.0,

      // Actions
      selectTask: (id, iter = null) => {
        if (!id) {
          set({
            selectedTaskId: null,
            selectedMutationIter: null,
            selectedNodeId: null,
            inspectorOpen: false,
          });
          return;
        }

        const currentExpanded = get().expandedTaskIds;
        const willExpand = currentExpanded.includes(id) ? currentExpanded : [...currentExpanded, id];

        set({
          selectedTaskId: id,
          selectedMutationIter: iter,
          selectedNodeId: null,
          expandedTaskIds: willExpand,
          inspectorOpen: true,
        });
      },

      selectMutation: (taskId, iter) => {
        set({
          selectedTaskId: taskId,
          selectedMutationIter: iter,
          selectedNodeId: null,
          inspectorOpen: true,
        });
      },

      selectNodeId: (id) => {
        if (!id) {
          set({ selectedNodeId: null, inspectorOpen: false });
          return;
        }
        set({
          selectedNodeId: id,
          selectedTaskId: null,
          selectedMutationIter: null,
          inspectorOpen: true,
        });
      },

      toggleExpandTask: (id) => {
        const current = get().expandedTaskIds;
        if (current.includes(id)) {
          set({ expandedTaskIds: current.filter((x) => x !== id) });
        } else {
          set({ expandedTaskIds: [...current, id] });
        }
      },

      expandAllBreakthroughs: (tasks) => {
        const breakthroughIds = Object.values(tasks)
          .filter((t) => t.is_breakthrough || (t.risk_score ?? 0) >= 0.7)
          .map((t) => t.task_id);
        const setIds = new Set([...get().expandedTaskIds, ...breakthroughIds]);
        set({ expandedTaskIds: Array.from(setIds) });
      },

      expandAllTasks: (taskIds) => {
        set({ expandedTaskIds: Array.from(new Set([...get().expandedTaskIds, ...taskIds])) });
      },

      collapseAll: () => {
        set({ expandedTaskIds: [] });
      },

      setFilters: (update) => {
        set((state) => ({
          filters: { ...state.filters, ...update },
        }));
      },

      resetFilters: () => {
        set({ filters: DEFAULT_GRAPH_FILTERS });
      },

      openInspector: () => set({ inspectorOpen: true }),
      closeInspector: () => set({ inspectorOpen: false }),

      setInspectorWidth: (w) => {
        const clamped = Math.max(360, Math.min(540, w));
        set({ inspectorWidth: clamped });
      },

      setZoomLevel: (zoomLevel) => set({ zoomLevel }),

      // Lightweight telemetry event hook if needed
      pushEvent: (_event: TaskEvent) => {
        // No-op or future telemetry hook
      },

      reset: () => {
        set({
          selectedTaskId: null,
          selectedMutationIter: null,
          selectedNodeId: null,
          expandedTaskIds: [],
          inspectorOpen: false,
          filters: DEFAULT_GRAPH_FILTERS,
        });
      },
    }),
    {
      name: 'valerie-graph-settings',
      partialize: (state) => ({
        inspectorWidth: state.inspectorWidth,
      }),
    }
  )
);
