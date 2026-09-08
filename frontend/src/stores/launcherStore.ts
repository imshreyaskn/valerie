import { create } from 'zustand';
import type { CreateRunPayload } from '../types/domain';

interface LauncherState {
  open: boolean;
  initialTemplate: Partial<CreateRunPayload & { name?: string }> | null;
  openLauncher: (template?: Partial<CreateRunPayload & { name?: string }> | unknown) => void;
  closeLauncher: () => void;
}

export const useLauncherStore = create<LauncherState>()((set) => ({
  open: false,
  initialTemplate: null,
  openLauncher: (template) => {
    const isTemplate = template && typeof template === 'object' && !('nativeEvent' in template);
    set({ open: true, initialTemplate: isTemplate ? (template as Partial<CreateRunPayload & { name?: string }>) : null });
  },
  closeLauncher: () => set({ open: false, initialTemplate: null }),
}));
