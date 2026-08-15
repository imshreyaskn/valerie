import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SelectedEntity {
  type: 'task' | 'finding' | 'endpoint' | 'technique' | 'cluster' | 'run';
  id: string;
}

interface WorkspaceState {
  // Rail
  railCollapsed: boolean;
  toggleRail: () => void;
  setRailCollapsed: (collapsed: boolean) => void;

  // Inspector
  inspectorOpen: boolean;
  inspectorWidth: number;
  selectedEntity: SelectedEntity | null;
  openInspector: (entity: SelectedEntity) => void;
  closeInspector: () => void;
  setInspectorWidth: (width: number) => void;

  // Density
  density: 'comfortable' | 'compact' | 'research';
  setDensity: (density: 'comfortable' | 'compact' | 'research') => void;
}

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set) => ({
      // Rail
      railCollapsed: false,
      toggleRail: () => set((s) => ({ railCollapsed: !s.railCollapsed })),
      setRailCollapsed: (collapsed) => set({ railCollapsed: collapsed }),

      // Inspector
      inspectorOpen: false,
      inspectorWidth: 400,
      selectedEntity: null,
      openInspector: (entity) =>
        set({ inspectorOpen: true, selectedEntity: entity }),
      closeInspector: () =>
        set({ inspectorOpen: false, selectedEntity: null }),
      setInspectorWidth: (width) => {
        // ponytail: clamp inline, no util needed
        const clamped = Math.max(360, Math.min(480, width));
        set({ inspectorWidth: clamped });
      },

      // Density
      density: 'comfortable',
      setDensity: (density) => set({ density }),
    }),
    {
      name: 'valerie-workspace',
      partialize: (state) => ({
        railCollapsed: state.railCollapsed,
        inspectorWidth: state.inspectorWidth,
        density: state.density,
        // ponytail: don't persist transient inspector open/entity state
      }),
    }
  )
);
