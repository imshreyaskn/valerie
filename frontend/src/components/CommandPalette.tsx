import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Radar, Play, GitBranch, FileSearch, Shield, Zap,
  Key, Settings, Search,
} from 'lucide-react';

interface CommandItem {
  id: string;
  label: string;
  code: string;
  group: 'Navigation' | 'Actions';
  icon: React.ElementType;
  action: () => void;
  keywords?: string;
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(true);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const go = useCallback(
    (path: string) => {
      navigate(path);
      setOpen(false);
    },
    [navigate]
  );

  const items: CommandItem[] = useMemo(
    () => [
      { id: 'mc',    code: '01', label: 'Mission Control',     group: 'Navigation', icon: Radar,      action: () => go('/dashboard'),                keywords: 'home overview live telemetry' },
      { id: 'camp',  code: '02', label: 'Campaigns',            group: 'Navigation', icon: Play,       action: () => go('/dashboard/campaigns'),       keywords: 'runs evaluations history pipelines' },
      { id: 'inv',   code: '03', label: 'Investigation Board',  group: 'Navigation', icon: GitBranch,  action: () => go('/dashboard/investigation'),   keywords: 'board pin compare forensics' },
      { id: 'find',  code: '04', label: 'Breakthrough Findings',group: 'Navigation', icon: FileSearch, action: () => go('/dashboard/findings'),         keywords: 'breakthroughs evidence breaches' },
      { id: 'weak',  code: '05', label: 'Weakness Clusters',    group: 'Navigation', icon: Shield,     action: () => go('/dashboard/weaknesses'),      keywords: 'clusters knowledge threats graph' },
      { id: 'ep',    code: '06', label: 'Target Endpoints',     group: 'Navigation', icon: Zap,        action: () => go('/dashboard/endpoints'),       keywords: 'models targets byok vllm' },
      { id: 'keys',  code: '07', label: 'API Keys & Secrets',   group: 'Navigation', icon: Key,        action: () => go('/dashboard/keys'),            keywords: 'tokens credentials sdk cli' },
      { id: 'set',   code: '08', label: 'Workspace Settings',   group: 'Navigation', icon: Settings,   action: () => go('/dashboard/settings'),        keywords: 'profile account organization' },
    ],
    [go]
  );

  const filtered = useMemo(() => {
    if (!query.trim()) return items;
    const q = query.toLowerCase();
    return items.filter(
      (i) =>
        i.label.toLowerCase().includes(q) ||
        i.keywords?.toLowerCase().includes(q) ||
        i.code.includes(q)
    );
  }, [items, query]);

  useEffect(() => {
    setActiveIndex(0);
  }, [filtered.length]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % filtered.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + filtered.length) % filtered.length);
    } else if (e.key === 'Enter' && filtered[activeIndex]) {
      e.preventDefault();
      filtered[activeIndex].action();
    }
  };

  const groups = useMemo(() => {
    const map = new Map<string, CommandItem[]>();
    for (const item of filtered) {
      const arr = map.get(item.group) ?? [];
      arr.push(item);
      map.set(item.group, arr);
    }
    return map;
  }, [filtered]);

  let flatIndex = -1;

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) setQuery('');
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-slate/40 backdrop-blur-sm animate-fade-in" />
        <Dialog.Content
          className="fixed left-1/2 top-[18%] z-50 -translate-x-1/2 w-full max-w-xl bg-ivory shadow-2xl border-2 border-slate overflow-hidden animate-slide-up"
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            inputRef.current?.focus();
          }}
          aria-label="Valerie Command Palette"
        >
          {/* Search input header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-hairline bg-linen/50 font-mono">
            <Search className="w-4 h-4 text-slate shrink-0" strokeWidth={2} aria-hidden="true" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search commands, routes, or entities..."
              className="flex-1 bg-transparent text-xs text-slate placeholder:text-taupe outline-none font-mono"
              autoComplete="off"
              spellCheck={false}
            />
            <kbd className="text-[10px] font-mono text-steel border border-hairline rounded px-1.5 py-0.5 bg-ivory select-none">
              ESC
            </kbd>
          </div>

          {/* Results list */}
          <div className="max-h-80 overflow-y-auto py-2 font-mono" role="listbox" aria-label="Command results">
            {filtered.length === 0 && (
              <div className="px-4 py-8 text-center text-xs text-taupe uppercase">
                NO MATCHING COMMANDS FOUND
              </div>
            )}
            {Array.from(groups.entries()).map(([group, groupItems]) => (
              <div key={group}>
                <p className="px-4 pt-2.5 pb-1 text-[10px] font-bold text-taupe uppercase tracking-wider">{group}</p>
                {groupItems.map((item) => {
                  flatIndex++;
                  const idx = flatIndex;
                  const isActive = idx === activeIndex;
                  const isCurrent = (() => {
                    if (item.id === 'mc' && location.pathname === '/dashboard') return true;
                    if (item.id === 'camp' && location.pathname.includes('campaigns')) return true;
                    if (item.id === 'inv' && location.pathname.includes('investigation')) return true;
                    if (item.id === 'find' && location.pathname.includes('findings')) return true;
                    if (item.id === 'weak' && location.pathname.includes('weaknesses')) return true;
                    if (item.id === 'ep' && location.pathname.includes('endpoints')) return true;
                    return false;
                  })();
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      role="option"
                      aria-selected={isActive}
                      className={[
                        'flex items-center gap-3 w-full px-4 py-2 text-left text-xs transition-colors',
                        isActive ? 'bg-slate text-parchment font-bold' : 'text-slate hover:bg-linen/80',
                      ].join(' ')}
                      onClick={item.action}
                      onMouseEnter={() => setActiveIndex(idx)}
                    >
                      <span className={`text-[10px] ${isActive ? 'text-parchment/70' : 'text-taupe'}`}>
                        [{item.code}]
                      </span>
                      <Icon className="w-3.5 h-3.5 shrink-0" strokeWidth={isActive ? 2 : 1.5} aria-hidden="true" />
                      <span className="flex-1 truncate uppercase tracking-tight">{item.label}</span>
                      {isCurrent && (
                        <span className={`text-[9px] uppercase px-1.5 py-0.2 rounded border ${
                          isActive ? 'border-parchment/40 text-parchment' : 'border-hairline text-taupe bg-linen'
                        }`}>
                          ACTIVE
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Footer hint */}
          <div className="flex items-center justify-between px-4 py-2 border-t border-hairline bg-linen text-[10px] font-mono text-taupe select-none">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <kbd className="border border-hairline bg-ivory rounded px-1 py-0.2">↑↓</kbd> NAVIGATE
              </span>
              <span className="flex items-center gap-1">
                <kbd className="border border-hairline bg-ivory rounded px-1 py-0.2">↵</kbd> EXECUTE
              </span>
            </div>
            <span>VALERIE_OS // COMMAND_DISPATCH</span>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
