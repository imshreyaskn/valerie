import { Search, Plus } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { usePipelineStore } from '../stores/pipelineStore';

export function CommandStrip() {
  const location = useLocation();
  const navigate = useNavigate();
  const runStats = usePipelineStore((s) => s.runStats);

  const pageCode = (() => {
    const path = location.pathname;
    if (path === '/dashboard') return '01.00 // MISSION CONTROL';
    if (path.includes('campaigns')) return '02.00 // CAMPAIGNS';
    if (path.includes('investigation')) return '03.00 // INVESTIGATION';
    if (path.includes('findings')) return '04.00 // FINDINGS';
    if (path.includes('weaknesses')) return '05.00 // THREAT KNOWLEDGE';
    if (path.includes('endpoints')) return '06.00 // TARGET ENDPOINTS';
    if (path.includes('keys')) return '07.00 // API KEYS';
    if (path.includes('settings')) return '08.00 // SETTINGS';
    return '00.00 // VALERIE';
  })();

  const isStreaming = runStats.status === 'running';

  const triggerPalette = () => {
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true })
    );
  };

  return (
    <header className="flex items-center justify-between h-14 px-6 md:px-16 bg-parchment hairline-bottom shrink-0 select-none z-30">
      {/* Left: Section Stamp */}
      <div className="flex items-center gap-3 font-mono text-xs text-steel">
        <span className="font-bold text-slate tracking-[0.15em] uppercase">VALERIE</span>
        <span>{pageCode}</span>
      </div>

      {/* Right: Telemetry & Actions */}
      <div className="flex items-center gap-4 font-mono text-xs">
        {/* Stream Status (Old Money Olive) */}
        <div className="flex items-center gap-2">
          {isStreaming ? (
            <>
              <span className="w-2 h-2 rounded-full bg-olive animate-pulse-dot" />
              <span className="text-olive font-bold uppercase">STREAM LIVE</span>
            </>
          ) : (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-steel/50" />
              <span className="text-steel uppercase">STREAM IDLE</span>
            </>
          )}
        </div>

        {/* Search trigger */}
        <button
          onClick={triggerPalette}
          className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 border border-hairline bg-cream/60 text-steel hover:text-slate hover:border-slate transition-colors uppercase font-bold cursor-pointer"
          aria-label="Search Palette"
        >
          <Search size={12} />
          <span>SEARCH</span>
          <span className="text-[10px] text-taupe ml-1">[⌘K]</span>
        </button>

        {/* Quick Launch */}
        <button
          onClick={() => navigate('/dashboard/endpoints')}
          className="flex items-center gap-1.5 px-4 py-1.5 bg-slate text-parchment hover:bg-slate/90 transition-colors uppercase font-bold cursor-pointer"
        >
          <Plus size={13} strokeWidth={2.5} />
          <span>NEW CAMPAIGN</span>
        </button>
      </div>
    </header>
  );
}
