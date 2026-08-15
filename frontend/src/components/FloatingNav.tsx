import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Radar, Play, GitBranch, FileSearch, Shield, Zap,
  Key, Settings, Power, Search, Plus
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { usePipelineStore } from '../stores/pipelineStore';
import { VTooltip } from './ui';

interface NavRoute {
  to: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; color?: string; className?: string }>;
  code: string;
  label: string;
  end: boolean;
}

const primaryNav: NavRoute[] = [
  { to: '/dashboard',               icon: Radar,      code: '01', label: 'MISSION CONTROL', end: true  },
  { to: '/dashboard/campaigns',     icon: Play,       code: '02', label: 'CAMPAIGNS',       end: false },
  { to: '/dashboard/investigation', icon: GitBranch,  code: '03', label: 'INVESTIGATION',   end: false },
  { to: '/dashboard/findings',      icon: FileSearch, code: '04', label: 'FINDINGS',        end: false },
  { to: '/dashboard/weaknesses',    icon: Shield,     code: '05', label: 'WEAKNESSES',      end: false },
  { to: '/dashboard/endpoints',     icon: Zap,        code: '06', label: 'ENDPOINTS',       end: false },
];

export default function FloatingNav() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const runStatus = usePipelineStore(s => s.runStats.status);
  const isLive = runStatus === 'running';

  const isPathActive = (to: string, end: boolean) => {
    if (end) return location.pathname === to;
    return location.pathname === to || location.pathname.startsWith(to + '/');
  };

  const triggerPalette = () => {
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true })
    );
  };

  return (
    <nav
      className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center px-6 py-2.5 bg-ivory border border-hairline shadow-2xl transition-all select-none"
      aria-label="Floating Primary Navigation"
    >
      {/* Zone 1: Brand Section */}
      <div className="flex items-center gap-3 pr-5 shrink-0 font-mono">
        <span className="font-bold tracking-[0.25em] text-slate text-xs uppercase">
          VALERIE
        </span>
        {isLive ? (
          <span
            className="w-2.5 h-2.5 rounded-full bg-olive animate-pulse-dot"
            title="Active Pipeline Running"
          />
        ) : (
          <span
            className="w-2 h-2 rounded-full bg-steel/40"
            title="Idle"
          />
        )}
      </div>

      {/* Hairline Divider */}
      <div className="h-6 w-[1px] bg-hairline mr-4 shrink-0" aria-hidden="true" />

      {/* Zone 2: Primary Navigation Routes */}
      <div className="flex items-center gap-3.5">
        {primaryNav.map(({ to, icon: Icon, code, label, end }) => {
          const active = isPathActive(to, end);
          return (
            <VTooltip key={to} content={`${code} // ${label}`} side="top" sideOffset={14}>
              <Link
                to={to}
                className={`w-11 h-11 flex items-center justify-center transition-all shrink-0 ${
                  active
                    ? 'bg-slate text-parchment shadow-md'
                    : 'text-slate hover:bg-linen/80'
                }`}
                aria-label={label}
                aria-current={active ? 'page' : undefined}
              >
                <Icon
                  size={20}
                  strokeWidth={active ? 2.2 : 2}
                  className={active ? 'text-parchment' : 'text-slate'}
                />
              </Link>
            </VTooltip>
          );
        })}
      </div>

      {/* Hairline Divider */}
      <div className="h-6 w-[1px] bg-hairline mx-4 shrink-0" aria-hidden="true" />

      {/* Zone 3: Command & Actions */}
      <div className="flex items-center gap-3 shrink-0">
        <VTooltip content="SEARCH [⌘K]" side="top" sideOffset={14}>
          <button
            onClick={triggerPalette}
            className="w-11 h-11 flex items-center justify-center text-slate hover:bg-linen/80 transition-colors cursor-pointer"
            aria-label="Search Palette (Cmd+K)"
          >
            <Search size={20} strokeWidth={2} className="text-slate" />
          </button>
        </VTooltip>

        <VTooltip content="LAUNCH NEW CAMPAIGN" side="top" sideOffset={14}>
          <button
            onClick={() => navigate('/dashboard/endpoints')}
            className="w-11 h-11 flex items-center justify-center text-slate hover:bg-linen/80 transition-colors cursor-pointer"
            aria-label="Launch Pipeline"
          >
            <Plus size={22} strokeWidth={2.2} className="text-slate" />
          </button>
        </VTooltip>
      </div>

      {/* Hairline Divider */}
      <div className="h-6 w-[1px] bg-hairline mx-4 shrink-0" aria-hidden="true" />

      {/* Zone 4: System & User Tools */}
      <div className="flex items-center gap-3 shrink-0">
        {/* API Keys */}
        {(() => {
          const active = isPathActive('/dashboard/keys', false);
          return (
            <VTooltip content="07 // API KEYS & SECRETS" side="top" sideOffset={14}>
              <Link
                to="/dashboard/keys"
                className={`w-11 h-11 flex items-center justify-center transition-all shrink-0 ${
                  active
                    ? 'bg-slate text-parchment shadow-md'
                    : 'text-slate hover:bg-linen/80'
                }`}
                aria-label="API Keys"
                aria-current={active ? 'page' : undefined}
              >
                <Key
                  size={20}
                  strokeWidth={active ? 2.2 : 2}
                  className={active ? 'text-parchment' : 'text-slate'}
                />
              </Link>
            </VTooltip>
          );
        })()}

        {/* Settings */}
        {(() => {
          const active = isPathActive('/dashboard/settings', false);
          return (
            <VTooltip content={`08 // SETTINGS (${user?.email || 'USER'})`} side="top" sideOffset={14}>
              <Link
                to="/dashboard/settings"
                className={`w-11 h-11 flex items-center justify-center transition-all shrink-0 ${
                  active
                    ? 'bg-slate text-parchment shadow-md'
                    : 'text-slate hover:bg-linen/80'
                }`}
                aria-label="Settings"
                aria-current={active ? 'page' : undefined}
              >
                <Settings
                  size={20}
                  strokeWidth={active ? 2.2 : 2}
                  className={active ? 'text-parchment' : 'text-slate'}
                />
              </Link>
            </VTooltip>
          );
        })()}

        {/* Sign Out */}
        <VTooltip content="SIGN OUT" side="top" sideOffset={14}>
          <button
            onClick={logout}
            className="w-11 h-11 flex items-center justify-center text-slate hover:text-maroon hover:bg-maroon-muted transition-colors cursor-pointer"
            aria-label="Sign out"
          >
            <Power size={20} strokeWidth={2} className="text-slate hover:text-maroon" />
          </button>
        </VTooltip>
      </div>
    </nav>
  );
}
