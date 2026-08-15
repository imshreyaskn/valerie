import { Outlet, useLocation } from 'react-router-dom';
import FloatingNav from './FloatingNav';
import { CommandStrip } from './CommandStrip';
import { CommandPalette } from './CommandPalette';
import { Inspector } from './Inspector';

export default function Layout() {
  const location = useLocation();
  const isMissionControl = location.pathname === '/dashboard' || location.pathname === '/dashboard/';

  return (
    <div className="flex h-screen bg-parchment overflow-hidden flex-col">
      {/* Top Command HUD / Status Strip */}
      <CommandStrip />

      {/* Main Workspace Stage */}
      <div className="flex-1 flex min-h-0 relative overflow-hidden">
        {isMissionControl ? (
          <main className="flex-1 overflow-y-auto" id="main-content">
            <div className="min-h-full max-w-7xl mx-auto px-6 md:px-16 pt-2 pb-32 flex flex-col">
              <Outlet />
            </div>
          </main>
        ) : (
          <main className="flex-1 overflow-y-auto" id="main-content">
            <div className="min-h-full max-w-7xl mx-auto px-6 md:px-16 pt-8 pb-40">
              <Outlet />
            </div>
          </main>
        )}

        {/* Right contextual inspector */}
        <Inspector />
      </div>

      {/* Center Floating Navigation Dock */}
      <FloatingNav />

      {/* Global Command Palette Overlay (Cmd+K) */}
      <CommandPalette />
    </div>
  );
}
