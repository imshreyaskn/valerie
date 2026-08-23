import { create } from 'zustand';

// ── Global campaign-launch flow ───────────────────────────────────────────────
// The launcher is a platform-level workflow, not a Campaigns-page widget:
// the global NEW CAMPAIGN button (CommandStrip) and Mission Control both open
// the same modal, mounted once at the Layout level.

interface LauncherState {
  open: boolean;
  openLauncher: () => void;
  closeLauncher: () => void;
}

export const useLauncherStore = create<LauncherState>()((set) => ({
  open: false,
  openLauncher: () => set({ open: true }),
  closeLauncher: () => set({ open: false }),
}));
