/**
 * v2/store/graphStore.ts
 * Zustand store for Campaign Graph v2: selection, filters, replay, semantic zoom.
 *
 * Store reads: Canvas, Inspector, DebugBar, FilterChips, StatsCard, useGraphLayout
 * Store writes: Canvas (zoom, selection), Inspector (close, resize, sections),
 *               DebugBar (replay), FilterChips (filters), useReplayBuffer (pushEvent)
 *
 * Persist: only display preferences (inspectorWidth, sectionExpansion, filters minus
 *          session-only flags). NEVER persist eventRing — it would fill localStorage.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { TaskEvent, LiveTask } from '../../../../stores/pipelineStore';
import type { GraphFilters } from '../types';
import { applyEventToTasks } from '../../../../stores/pipelineStore';

// ── Replay state machine ──────────────────────────────────────────────────────
interface GraphReplayState {
  mode: 'live' | 'paused';
  eventCursor: number | null; // null = live tail
}

// ── Full store interface ──────────────────────────────────────────────────────
interface GraphStoreState {
  // Selection
  selectedTaskId: string | null;
  selectedMutationIter: number | null;
  multiSelectedIds: string[];
  selectedNodeId: string | null; // for root/config nodes

  // Inspector
  inspectorOpen: boolean;
  inspectorWidth: number; // clamped 360-560
  sectionExpansion: Record<string, boolean>;

  // Filters
  filters: GraphFilters;

  // Semantic zoom tier (0-4)
  semanticZoomTier: 0 | 1 | 2 | 3 | 4;

  // Replay
  replay: GraphReplayState;
  eventRing: TaskEvent[]; // ring buffer, cap 5000
  replayTasks: Record<string, LiveTask>; // derived when mode==='paused'

  // Local-only flags (not persisted)
  pinnedNodeIds: string[];
  markedForReviewIds: string[];

  // Actions
  selectTask: (id: string | null) => void;
  selectMutation: (taskId: string, iter: number | null) => void;
  toggleMultiSelect: (id: string) => void;
  selectNodeId: (id: string | null) => void;
  openInspector: () => void;
  closeInspector: () => void;
  setInspectorWidth: (w: number) => void;
  toggleSection: (key: string) => void;
  setFilter: <K extends keyof GraphFilters>(key: K, value: GraphFilters[K]) => void;
  clearFilters: () => void;
  setSemanticZoomTier: (tier: 0 | 1 | 2 | 3 | 4) => void;
  enterReplayMode: () => void;
  exitReplayMode: () => void;
  stepReplay: (direction: 1 | -1) => void;
  setEventCursor: (n: number | null) => void;
  pushEvent: (event: TaskEvent) => void;
  rebuildReplayTasks: () => void;
  togglePin: (id: string) => void;
  toggleMarkForReview: (id: string) => void;
  reset: () => void;
}

const EVENT_RING_CAP = 5000;

const DEFAULT_FILTERS: GraphFilters = {
  statuses: [],
  techniques: [],
  harmTypes: [],
  breakthroughOnly: false,
  showResolved: true,
};

const DEFAULT_SECTION_EXPANSION: Record<string, boolean> = {
  'task.status': true,
  'task.adversarial_prompt': true,
  'task.vector_scores': true,
  // all others default collapsed (falsy key = collapsed)
};

export const useGraphStore = create<GraphStoreState>()(
  persist(
    (set) => ({
      // Initial state
      selectedTaskId: null,
      selectedMutationIter: null,
      multiSelectedIds: [],
      selectedNodeId: null,
      inspectorOpen: false,
      inspectorWidth: 400,
      sectionExpansion: DEFAULT_SECTION_EXPANSION,
      filters: DEFAULT_FILTERS,
      semanticZoomTier: 2,
      replay: { mode: 'live', eventCursor: null },
      eventRing: [],
      replayTasks: {},
      pinnedNodeIds: [],
      markedForReviewIds: [],

      // ── Selection actions ────────────────────────────────────────────────────
      selectTask: (id) => set({
        selectedTaskId: id,
        selectedMutationIter: null,
        inspectorOpen: id !== null,
        selectedNodeId: null,
      }),

      selectMutation: (taskId, iter) => set({
        selectedTaskId: taskId,
        selectedMutationIter: iter,
        inspectorOpen: true,
        selectedNodeId: null,
      }),

      toggleMultiSelect: (id) => set((s) => {
        if (s.multiSelectedIds.includes(id)) {
          return { multiSelectedIds: s.multiSelectedIds.filter(x => x !== id) };
        }
        const ids = s.multiSelectedIds.length >= 5
          ? [...s.multiSelectedIds.slice(1), id]  // FIFO cap at 5
          : [...s.multiSelectedIds, id];
        return { multiSelectedIds: ids };
      }),

      selectNodeId: (id) => set({
        selectedNodeId: id,
        selectedTaskId: null,
        selectedMutationIter: null,
        inspectorOpen: id !== null,
      }),

      // ── Inspector actions ────────────────────────────────────────────────────
      openInspector: () => set({ inspectorOpen: true }),
      closeInspector: () => set({ inspectorOpen: false, selectedTaskId: null, selectedNodeId: null }),
      setInspectorWidth: (w) => set({ inspectorWidth: Math.max(360, Math.min(560, w)) }),
      toggleSection: (key) => set((s) => ({
        sectionExpansion: { ...s.sectionExpansion, [key]: !s.sectionExpansion[key] },
      })),

      // ── Filter actions ───────────────────────────────────────────────────────
      setFilter: (key, value) => set((s) => ({
        filters: { ...s.filters, [key]: value },
      })),
      clearFilters: () => set({ filters: DEFAULT_FILTERS }),

      // ── Semantic zoom ────────────────────────────────────────────────────────
      setSemanticZoomTier: (tier) => set({ semanticZoomTier: tier }),

      // ── Replay actions ───────────────────────────────────────────────────────
      enterReplayMode: () => set((s) => ({
        replay: { mode: 'paused', eventCursor: s.eventRing.length },
      })),

      exitReplayMode: () => set({
        replay: { mode: 'live', eventCursor: null },
        replayTasks: {},
      }),

      stepReplay: (direction) => set((s) => {
        if (s.replay.mode !== 'paused') return s;
        const current = s.replay.eventCursor ?? s.eventRing.length;
        const next = Math.max(0, Math.min(s.eventRing.length, current + direction));
        return { replay: { mode: 'paused', eventCursor: next } };
      }),

      setEventCursor: (n) => set({ replay: { mode: 'paused', eventCursor: n } }),

      pushEvent: (event) => set((s) => {
        const ring = s.eventRing.length >= EVENT_RING_CAP
          ? [...s.eventRing.slice(1), event]  // drop oldest
          : [...s.eventRing, event];
        return { eventRing: ring };
      }),

      rebuildReplayTasks: () => set((s) => {
        if (s.replay.mode !== 'paused') return { replayTasks: {} };
        const cursor = s.replay.eventCursor ?? s.eventRing.length;
        const events = s.eventRing.slice(0, cursor);
        return { replayTasks: rebuildTasksFromEvents(events) };
      }),

      // ── Pin / review flags ───────────────────────────────────────────────────
      togglePin: (id) => set((s) => ({
        pinnedNodeIds: s.pinnedNodeIds.includes(id)
          ? s.pinnedNodeIds.filter(x => x !== id)
          : [...s.pinnedNodeIds, id],
      })),

      toggleMarkForReview: (id) => set((s) => ({
        markedForReviewIds: s.markedForReviewIds.includes(id)
          ? s.markedForReviewIds.filter(x => x !== id)
          : [...s.markedForReviewIds, id],
      })),

      // ── Reset (call on run change) ────────────────────────────────────────────
      reset: () => set({
        selectedTaskId: null,
        selectedMutationIter: null,
        multiSelectedIds: [],
        selectedNodeId: null,
        inspectorOpen: false,
        replay: { mode: 'live', eventCursor: null },
        eventRing: [],
        replayTasks: {},
        pinnedNodeIds: [],
        markedForReviewIds: [],
      }),
    }),
    {
      name: 'valerie-graph-store',
      // Persist only display preferences — not session-specific state
      partialize: (s) => ({
        inspectorWidth: s.inspectorWidth,
        sectionExpansion: s.sectionExpansion,
        // Don't persist breakthroughOnly (session-only toggle)
        filters: { ...s.filters, breakthroughOnly: false },
      }),
    }
  )
);

// ── Pure replay rebuild function ──────────────────────────────────────────────
// Shared with pipelineStore via the extracted applyEventToTasks pure function.
export function rebuildTasksFromEvents(
  events: TaskEvent[]
): Record<string, LiveTask> {
  const tasks: Record<string, LiveTask> = {};
  for (const event of events) {
    const tid = event.payload?.task_id;
    if (!tid) continue;
    const next = applyEventToTasks(tasks[tid], event);
    if (next) tasks[tid] = next;
  }
  return tasks;
}
