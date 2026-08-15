import React, { useRef, useEffect, useState } from 'react';
import { Search, X, List, LayoutGrid, ChevronDown, Check, RotateCcw } from 'lucide-react';
import { useWorkspaceStore } from '../../stores/workspaceStore';
import { VTooltip } from '../ui';

export interface FilterState {
  status: string;
  technique: string;
  harmType: string;
  minRisk: number;
  searchQuery: string;
}

interface MissionControlFiltersProps {
  filters: FilterState;
  onFilterChange: (newFilters: Partial<FilterState>) => void;
  onResetFilters: () => void;
  availableTechniques: string[];
  availableHarmTypes: string[];
  counts: {
    all: number;
    breakthrough: number;
    defended: number;
    active: number;
    queued: number;
    unresolved: number;
  };
  viewMode: 'table' | 'grid';
  onViewModeChange: (mode: 'table' | 'grid') => void;
}

export const MissionControlFilters: React.FC<MissionControlFiltersProps> = ({
  filters,
  onFilterChange,
  onResetFilters,
  availableTechniques,
  availableHarmTypes,
  counts,
  viewMode,
  onViewModeChange,
}) => {
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { density, setDensity } = useWorkspaceStore();

  const [techOpen, setTechOpen] = useState(false);
  const [harmOpen, setHarmOpen] = useState(false);

  const techRef = useRef<HTMLDivElement>(null);
  const harmRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (techRef.current && !techRef.current.contains(e.target as Node)) {
        setTechOpen(false);
      }
      if (harmRef.current && !harmRef.current.contains(e.target as Node)) {
        setHarmOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard shortcut '/' focuses search input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === '/' &&
        document.activeElement !== searchInputRef.current &&
        !(document.activeElement instanceof HTMLInputElement)
      ) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const activeFilterCount =
    (filters.status !== 'ALL' ? 1 : 0) +
    (filters.technique !== 'ALL' ? 1 : 0) +
    (filters.harmType !== 'ALL' ? 1 : 0) +
    (filters.minRisk > 0 ? 1 : 0) +
    (filters.searchQuery.trim() !== '' ? 1 : 0);

  const statusTabs = [
    { id: 'ALL', label: 'ALL SPECIMENS', count: counts.all, dot: 'bg-slate' },
    { id: 'BREAKTHROUGH', label: 'BREAKTHROUGHS', count: counts.breakthrough, dot: 'bg-maroon' },
    { id: 'DEFENDED', label: 'DEFENDED', count: counts.defended, dot: 'bg-olive' },
    { id: 'ACTIVE', label: 'ACTIVE / IN-FLIGHT', count: counts.active, dot: 'bg-powder' },
    { id: 'QUEUED', label: 'QUEUED', count: counts.queued, dot: 'bg-hairline' },
    { id: 'UNRESOLVED', label: 'UNRESOLVED', count: counts.unresolved, dot: 'bg-maroon/50' },
  ];

  return (
    <div className="w-full hairline-bottom select-none py-4 space-y-3 font-mono" aria-label="Specimen Filters & Facets">
      {/* ── ROW 1: Search Omnibar & Display Controls ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Search Omnibar */}
        <div className="relative flex-1 min-w-[280px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-steel pointer-events-none" />
          <input
            ref={searchInputRef}
            type="text"
            value={filters.searchQuery}
            onChange={(e) => onFilterChange({ searchQuery: e.target.value })}
            placeholder="Search prompt tokens, mutation diffs, techniques, or task IDs [/]"
            className="w-full pl-10 pr-16 py-2 bg-linen/50 border border-hairline text-xs font-mono text-slate placeholder:text-taupe focus:bg-ivory focus:border-slate focus:outline-none transition-all shadow-2xs"
            aria-label="Filter specimens by keyword"
          />
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
            {filters.searchQuery && (
              <button
                onClick={() => onFilterChange({ searchQuery: '' })}
                className="text-steel hover:text-slate p-0.5 cursor-pointer"
                aria-label="Clear search"
              >
                <X size={13} />
              </button>
            )}
            <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[9px] font-mono text-taupe bg-linen border border-hairline">
              /
            </kbd>
          </div>
        </div>

        {/* View Mode & Density Switchers */}
        <div className="flex items-center gap-3 shrink-0 self-end sm:self-auto text-xs">
          {/* Segmented Density Switch */}
          <div className="flex items-center p-0.5 bg-linen border border-hairline text-[10px] font-bold">
            <button
              onClick={() => setDensity('comfortable')}
              className={`px-2 py-1 uppercase transition-all cursor-pointer ${
                density === 'comfortable'
                  ? 'bg-slate text-parchment shadow-xs'
                  : 'text-steel hover:text-slate'
              }`}
              title="Comfortable density"
            >
              COMF
            </button>
            <button
              onClick={() => setDensity('compact')}
              className={`px-2 py-1 uppercase transition-all cursor-pointer ${
                density === 'compact'
                  ? 'bg-slate text-parchment shadow-xs'
                  : 'text-steel hover:text-slate'
              }`}
              title="Compact density"
            >
              COMP
            </button>
            <button
              onClick={() => setDensity('research')}
              className={`px-2 py-1 uppercase transition-all cursor-pointer ${
                density === 'research'
                  ? 'bg-slate text-parchment shadow-xs'
                  : 'text-steel hover:text-slate'
              }`}
              title="Research high-density"
            >
              RSRCH
            </button>
          </div>

          {/* View Mode Switch */}
          <div className="flex items-center p-0.5 bg-linen border border-hairline">
            <VTooltip content="Tabular Ledger">
              <button
                onClick={() => onViewModeChange('table')}
                className={`p-1 transition-all cursor-pointer ${
                  viewMode === 'table' ? 'bg-slate text-parchment shadow-xs' : 'text-steel hover:text-slate'
                }`}
                aria-label="Table view"
              >
                <List size={13} />
              </button>
            </VTooltip>
            <VTooltip content="Grid View">
              <button
                onClick={() => onViewModeChange('grid')}
                className={`p-1 transition-all cursor-pointer ${
                  viewMode === 'grid' ? 'bg-slate text-parchment shadow-xs' : 'text-steel hover:text-slate'
                }`}
                aria-label="Grid view"
              >
                <LayoutGrid size={13} />
              </button>
            </VTooltip>
          </div>
        </div>
      </div>

      {/* ── ROW 2: Standalone Lifecycle Status Lenses (Full-Width Row) ── */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none text-xs">
        {statusTabs.map((tab) => {
          const isActive = filters.status === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onFilterChange({ status: tab.id })}
              className={`px-3 py-1.5 text-xs transition-all whitespace-nowrap cursor-pointer flex items-center gap-2 border font-semibold ${
                isActive
                  ? 'bg-slate text-parchment border-slate shadow-xs'
                  : 'bg-linen/40 text-steel border-hairline hover:bg-linen hover:text-slate'
              }`}
              role="tab"
              aria-selected={isActive}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${tab.dot} ${isActive ? 'ring-1 ring-parchment' : ''}`} />
              <span>{tab.label}</span>
              <span className={`text-[10px] tabular-nums font-mono ${isActive ? 'text-parchment' : 'text-taupe'}`}>
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── ROW 3: Standalone Dimension Facets (Full-Width Responsive Row) ── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1 text-xs w-full">
        {/* Technique Dropdown Popover (Full Width / Flex-1) */}
        <div className="relative flex-1 min-w-[200px]" ref={techRef}>
          <button
            onClick={() => {
              setTechOpen((v) => !v);
              setHarmOpen(false);
            }}
            className={`w-full flex items-center justify-between px-3 py-2 border text-xs font-mono uppercase transition-all cursor-pointer ${
              filters.technique !== 'ALL'
                ? 'bg-slate text-parchment border-slate font-bold shadow-2xs'
                : 'bg-linen/40 text-slate border-hairline hover:bg-linen hover:border-steel'
            }`}
          >
            <div className="flex items-center gap-2 truncate">
              <span className="text-[10px] text-taupe shrink-0">TECHNIQUE:</span>
              <span className="font-bold truncate">
                {filters.technique === 'ALL' ? 'ALL TECHNIQUES' : filters.technique.replace(/_/g, ' ')}
              </span>
            </div>
            <ChevronDown size={12} className={`text-taupe shrink-0 ml-2 transition-transform ${techOpen ? 'rotate-180' : ''}`} />
          </button>

          {techOpen && (
            <div className="absolute left-0 top-full mt-1.5 w-full min-w-[260px] bg-ivory border border-hairline shadow-2xl z-50 py-1 font-mono text-xs max-h-64 overflow-y-auto animate-fade-in">
              <div className="px-3 py-1.5 text-[10px] font-bold text-taupe uppercase hairline-bottom">
                ATTACK TECHNIQUES ({availableTechniques.length})
              </div>
              <button
                onClick={() => {
                  onFilterChange({ technique: 'ALL' });
                  setTechOpen(false);
                }}
                className={`w-full text-left px-3 py-2 hover:bg-linen flex items-center justify-between cursor-pointer ${
                  filters.technique === 'ALL' ? 'bg-linen font-bold text-slate' : 'text-steel'
                }`}
              >
                <span>ALL TECHNIQUES</span>
                {filters.technique === 'ALL' && <Check size={12} className="text-slate" />}
              </button>
              {availableTechniques.map((t) => (
                <button
                  key={t}
                  onClick={() => {
                    onFilterChange({ technique: t });
                    setTechOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 hover:bg-linen flex items-center justify-between cursor-pointer ${
                    filters.technique === t ? 'bg-linen font-bold text-slate' : 'text-slate'
                  }`}
                >
                  <span className="truncate pr-2">{t.replace(/_/g, ' ').toUpperCase()}</span>
                  {filters.technique === t && <Check size={12} className="text-slate shrink-0" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Harm Category Dropdown Popover (Full Width / Flex-1) */}
        <div className="relative flex-1 min-w-[200px]" ref={harmRef}>
          <button
            onClick={() => {
              setHarmOpen((v) => !v);
              setTechOpen(false);
            }}
            className={`w-full flex items-center justify-between px-3 py-2 border text-xs font-mono uppercase transition-all cursor-pointer ${
              filters.harmType !== 'ALL'
                ? 'bg-slate text-parchment border-slate font-bold shadow-2xs'
                : 'bg-linen/40 text-slate border-hairline hover:bg-linen hover:border-steel'
            }`}
          >
            <div className="flex items-center gap-2 truncate">
              <span className="text-[10px] text-taupe shrink-0">HARM:</span>
              <span className="font-bold truncate">
                {filters.harmType === 'ALL' ? 'ALL CATEGORIES' : filters.harmType.replace(/_/g, ' ')}
              </span>
            </div>
            <ChevronDown size={12} className={`text-taupe shrink-0 ml-2 transition-transform ${harmOpen ? 'rotate-180' : ''}`} />
          </button>

          {harmOpen && (
            <div className="absolute left-0 top-full mt-1.5 w-full min-w-[260px] bg-ivory border border-hairline shadow-2xl z-50 py-1 font-mono text-xs max-h-64 overflow-y-auto animate-fade-in">
              <div className="px-3 py-1.5 text-[10px] font-bold text-taupe uppercase hairline-bottom">
                HARM CATEGORIES ({availableHarmTypes.length})
              </div>
              <button
                onClick={() => {
                  onFilterChange({ harmType: 'ALL' });
                  setHarmOpen(false);
                }}
                className={`w-full text-left px-3 py-2 hover:bg-linen flex items-center justify-between cursor-pointer ${
                  filters.harmType === 'ALL' ? 'bg-linen font-bold text-slate' : 'text-steel'
                }`}
              >
                <span>ALL HARM TYPES</span>
                {filters.harmType === 'ALL' && <Check size={12} className="text-slate" />}
              </button>
              {availableHarmTypes.map((h) => (
                <button
                  key={h}
                  onClick={() => {
                    onFilterChange({ harmType: h });
                    setHarmOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 hover:bg-linen flex items-center justify-between cursor-pointer ${
                    filters.harmType === h ? 'bg-linen font-bold text-slate' : 'text-slate'
                  }`}
                >
                  <span className="truncate pr-2">{h.replace(/_/g, ' ').toUpperCase()}</span>
                  {filters.harmType === h && <Check size={12} className="text-slate shrink-0" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Risk Level Threshold Segment */}
        <div className="flex items-center p-0.5 bg-linen/50 border border-hairline text-[10px] font-bold shrink-0 self-stretch sm:self-auto justify-between sm:justify-start">
          <span className="text-taupe px-2 uppercase text-[9px]">MIN RISK:</span>
          <div className="flex items-center gap-1">
            {[
              { val: 0, label: 'ANY' },
              { val: 0.4, label: '≥ 0.40' },
              { val: 0.7, label: '≥ 0.70' },
              { val: 0.85, label: 'CRIT' },
            ].map((lvl) => (
              <button
                key={lvl.val}
                onClick={() => onFilterChange({ minRisk: lvl.val })}
                className={`px-2 py-1.5 transition-all cursor-pointer ${
                  filters.minRisk === lvl.val
                    ? 'bg-slate text-parchment shadow-xs'
                    : 'text-steel hover:text-slate'
                }`}
              >
                {lvl.label}
              </button>
            ))}
          </div>
        </div>

        {/* Reset All Filters Button */}
        {activeFilterCount > 0 && (
          <button
            onClick={onResetFilters}
            className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-mono text-steel hover:text-maroon hover:bg-maroon/10 border border-hairline hover:border-maroon/30 transition-all cursor-pointer uppercase font-bold shrink-0"
            title="Reset all active filters"
          >
            <RotateCcw size={12} />
            <span>RESET ({activeFilterCount})</span>
          </button>
        )}
      </div>
    </div>
  );
};
