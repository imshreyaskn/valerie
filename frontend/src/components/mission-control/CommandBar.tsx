import React, { useState, useEffect, useRef } from 'react';
import { usePipelineStore } from '../../stores/pipelineStore';
import { useWorkspaceStore } from '../../stores/workspaceStore';
import { api } from '../../utils/api';
import type { Run } from '../../types/domain';
import { VTooltip } from '../ui';
import {
  ChevronDown, Search, X, List, LayoutGrid, RotateCcw,
  RefreshCw, AlertTriangle, Check
} from 'lucide-react';
import type { FilterState } from './MissionControlFilters';

interface CommandBarProps {
  filters: FilterState;
  onFilterChange: (f: Partial<FilterState>) => void;
  onResetFilters: () => void;
  counts: { all: number; breakthrough: number; defended: number; active: number; queued: number; unresolved: number };
  availableTechniques: string[];
  availableHarmTypes: string[];
  viewMode: 'table' | 'grid';
  onViewModeChange: (m: 'table' | 'grid') => void;
}

// ── Instrument Cluster (formerly Swiss Telemetry Row) ──────────────────────
const InstrumentCluster: React.FC = () => {
  const liveTasks      = usePipelineStore(s => s.liveTasks);
  const runStats       = usePipelineStore(s => s.runStats);
  const activeRunMeta  = usePipelineStore(s => s.activeRunMeta);
  const streamHealth   = usePipelineStore(s => s.streamHealth);

  const tasks = Object.values(liveTasks);
  const total = Math.max(tasks.length, runStats.total_tasks || 0);
  const breakthroughs = tasks.filter(t => t.is_breakthrough || t.status === 'breakthrough').length;
  const defended = tasks.filter(t => t.status === 'defended' || (t.status === 'completed' && !t.is_breakthrough)).length;
  const completed = breakthroughs + defended;

  const [elapsed, setElapsed] = useState('00m 00s');
  useEffect(() => {
    const str = activeRunMeta?.started_at || runStats.started_at;
    if (!str || runStats.status === 'idle') { setElapsed('00m 00s'); return; }
    const t0 = new Date(str).getTime();
    if (isNaN(t0)) { setElapsed('00m 00s'); return; }
    const tick = () => {
      const d = Math.max(0, Math.floor((Date.now() - t0) / 1000));
      setElapsed(`${String(Math.floor(d / 60)).padStart(2, '0')}m ${String(d % 60).padStart(2, '0')}s`);
    };
    tick();
    if (runStats.status === 'running') {
      const id = setInterval(tick, 1000);
      return () => clearInterval(id);
    }
  }, [runStats.status, runStats.started_at, activeRunMeta?.started_at]);

  const instruments = [
    {
      ref: '1.01', label: 'BRANCHES',
      value: <><span>{completed}</span><span className="text-steel text-lg font-normal"> / {total || '—'}</span></>,
      sub: total > 0 ? `${Math.round((completed / total) * 100)}% COVERAGE` : 'STANDBY',
      color: 'text-slate',
    },
    {
      ref: '1.02', label: 'BREAKTHROUGHS',
      value: <span className={breakthroughs > 0 ? 'text-maroon' : 'text-slate'}>{breakthroughs > 0 ? '◆ ' : ''}{breakthroughs}</span>,
      sub: completed > 0 ? `${((breakthroughs / completed) * 100).toFixed(1)}% BYPASS` : '0% OBSERVED',
      color: breakthroughs > 0 ? 'text-maroon' : 'text-slate',
    },
    {
      ref: '1.03', label: 'DEFENDED',
      value: <span className={defended > 0 ? 'text-olive' : 'text-slate'}>{defended > 0 ? '✓ ' : ''}{defended}</span>,
      sub: completed > 0 ? `${((defended / completed) * 100).toFixed(1)}% RESISTANCE` : '100% CLEAN',
      color: defended > 0 ? 'text-olive' : 'text-slate',
    },
    {
      ref: '1.04', label: 'MEAN RISK',
      value: <span className={runStats.avg_risk_score >= 0.7 ? 'text-maroon' : runStats.avg_risk_score >= 0.4 ? 'text-camel' : 'text-slate'}>
        {runStats.avg_risk_score.toFixed(2)}
      </span>,
      sub: runStats.avg_risk_score >= 0.7 ? 'CRITICAL' : runStats.avg_risk_score >= 0.4 ? 'ELEVATED' : 'NOMINAL',
      color: 'text-slate',
    },
    {
      ref: '1.05', label: 'RUN DURATION',
      value: <span className="text-slate">{elapsed}</span>,
      sub: <span className="flex items-center gap-1.5">
        <span className={`w-1.5 h-1.5 rounded-full ${streamHealth === 'connected' ? 'bg-olive animate-pulse-dot' : streamHealth === 'paused' ? 'bg-camel' : 'bg-steel/40'}`} />
        {streamHealth === 'connected' ? 'STREAM ACTIVE' : streamHealth === 'paused' ? 'STREAM PAUSED' : runStats.status.toUpperCase()}
      </span>,
      color: 'text-slate',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 divide-y md:divide-y-0 md:divide-x divide-hairline hairline-bottom select-none">
      {instruments.map((inst, i) => (
        <div
          key={inst.ref}
          className={`flex flex-col justify-between ${
            i === 0
              ? 'py-5 pr-4 md:py-6 md:pr-6 md:pl-0'
              : i === 4
              ? 'py-5 pl-4 md:py-6 md:pl-6 max-md:col-span-2'
              : 'p-4 md:p-6'
          }`}
        >
          <div>
            <div className="text-xs font-mono text-steel mb-1">{inst.ref}</div>
            <div className="text-xs font-semibold uppercase tracking-[0.02em] text-slate mb-2">{inst.label}</div>
          </div>
          <div>
            <div className="font-mono text-2xl md:text-3xl font-bold tabular-nums leading-none">
              {inst.value}
            </div>
            <div className="text-[10px] font-mono text-steel mt-2 uppercase truncate">{inst.sub}</div>
          </div>
        </div>
      ))}
    </div>
  );
};

// ── Execution Circuit Progress Bar ─────────────────────────────────────────
export const ExecutionCircuit: React.FC<{
  onFilterByStatus?: (s: string) => void;
  activeStatusFilter?: string;
}> = ({ onFilterByStatus, activeStatusFilter }) => {
  const liveTasks = usePipelineStore(s => s.liveTasks);
  const runStats  = usePipelineStore(s => s.runStats);

  const tasks = Object.values(liveTasks);
  const total = Math.max(tasks.length, runStats.total_tasks || 0);
  const pct = (n: number) => total > 0 ? (n / total) * 100 : 0;

  const queued       = tasks.filter(t => t.status === 'queued').length;
  const mutating     = tasks.filter(t => t.status === 'mutating').length;
  const transmitting = tasks.filter(t => t.status === 'transmitting').length;
  const scoring      = tasks.filter(t => t.status === 'scoring').length;
  const breakthroughs = tasks.filter(t => t.is_breakthrough || t.status === 'breakthrough').length;
  const defended     = tasks.filter(t => t.status === 'defended' || (t.status === 'completed' && !t.is_breakthrough)).length;
  const unresolved   = tasks.filter(t => t.status === 'unresolved' || t.status === 'failed').length;
  const completed    = breakthroughs + defended;

  const segments = [
    { label: 'QUEUED',       count: queued,       color: 'bg-hairline',    filter: 'QUEUED' },
    { label: 'MUTATING',     count: mutating,     color: 'bg-steel/60',    filter: 'ACTIVE' },
    { label: 'TRANSMITTING', count: transmitting, color: 'bg-powder',      filter: 'ACTIVE' },
    { label: 'SCORING',      count: scoring,      color: 'bg-camel',       filter: 'ACTIVE' },
    { label: 'DEFENDED',     count: defended,     color: 'bg-olive',       filter: 'DEFENDED' },
    { label: 'BREAKTHROUGH',  count: breakthroughs, color: 'bg-maroon',   filter: 'BREAKTHROUGH' },
    { label: 'UNRESOLVED',   count: unresolved,   color: 'bg-maroon/40',  filter: 'UNRESOLVED' },
  ].filter(s => s.count > 0 || total === 0);

  return (
    <div className="py-3 hairline-bottom space-y-1.5">
      <div className="flex items-center justify-between font-mono text-[10px] text-steel mb-1">
        <span className="uppercase font-bold text-slate tracking-wider">EXECUTION CIRCUIT</span>
        <span className="tabular-nums">{completed} / {total || '—'} COMPLETE ({total > 0 ? Math.round((completed / total) * 100) : 0}%)</span>
      </div>

      <div className="h-2 w-full bg-linen flex overflow-hidden">
        {total === 0 ? (
          <div className="w-full h-full animate-sweep" />
        ) : (
          segments.map(seg => (
            <VTooltip key={seg.label + seg.filter} content={`${seg.label}: ${seg.count}`}>
              <button
                onClick={() => onFilterByStatus?.(seg.filter)}
                style={{ width: `${Math.max(pct(seg.count), 1.5)}%` }}
                className={`h-full ${seg.color} transition-all hover:opacity-80 cursor-pointer`}
                aria-label={`${seg.label}: ${seg.count}`}
              />
            </VTooltip>
          ))
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 font-mono text-[10px]">
        <button onClick={() => onFilterByStatus?.('ALL')} className={`transition-colors cursor-pointer ${activeStatusFilter === 'ALL' ? 'text-slate font-bold' : 'text-taupe hover:text-slate'}`}>
          ALL: {tasks.length}
        </button>
        {segments.map((seg) => (
          <React.Fragment key={seg.label}>
            <span className="h-3 w-px bg-hairline" />
            <button
              onClick={() => onFilterByStatus?.(seg.filter)}
              className={`flex items-center gap-1.5 transition-colors cursor-pointer ${activeStatusFilter === seg.filter ? 'text-slate font-bold' : 'text-taupe hover:text-slate'}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${seg.color}`} />
              {seg.label}: <strong className="tabular-nums text-slate">{seg.count}</strong>
            </button>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

// ── Main Command Bar ───────────────────────────────────────────────────────
export const CommandBar: React.FC<CommandBarProps> = ({
  filters, onFilterChange, onResetFilters, counts,
  availableTechniques, availableHarmTypes, viewMode, onViewModeChange,
}) => {
  const activeRunId  = usePipelineStore(s => s.activeRunId);
  const activeRunMeta = usePipelineStore(s => s.activeRunMeta);
  const setActiveRun = usePipelineStore(s => s.setActiveRun);
  const setActiveRunMeta = usePipelineStore(s => s.setActiveRunMeta);
  const streamHealth = usePipelineStore(s => s.streamHealth);
  const triggerReconnect = usePipelineStore(s => s.triggerReconnect);
  const { density, setDensity } = useWorkspaceStore();

  const [runs, setRuns] = useState<Run[]>([]);
  const [scopeOpen, setScopeOpen] = useState(false);
  const [techOpen, setTechOpen] = useState(false);
  const [harmOpen, setHarmOpen] = useState(false);

  const scopeRef = useRef<HTMLDivElement>(null);
  const techRef  = useRef<HTMLDivElement>(null);
  const harmRef  = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.listRuns(20, 0).then(r => r?.runs && setRuns(r.runs)).catch(() => {});
  }, []);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (scopeRef.current && !scopeRef.current.contains(e.target as Node)) setScopeOpen(false);
      if (techRef.current  && !techRef.current.contains(e.target as Node))  setTechOpen(false);
      if (harmRef.current  && !harmRef.current.contains(e.target as Node))  setHarmOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  useEffect(() => {
    const kd = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement !== searchRef.current && !(document.activeElement instanceof HTMLInputElement)) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', kd);
    return () => window.removeEventListener('keydown', kd);
  }, []);

  const handleSelectRun = (run: Run | null) => {
    if (!run) { setActiveRun('all'); setActiveRunMeta(null); }
    else {
      setActiveRun(run.id);
      setActiveRunMeta({ domain: run.domain, endpoint_id: run.endpoint_id, endpoint_name: run.endpoint_id, attacker_model: run.attacker_model, judge_model: run.judge_model, started_at: run.created_at });
    }
    setScopeOpen(false);
  };

  const activeFilterCount =
    (filters.status !== 'ALL' ? 1 : 0) + (filters.technique !== 'ALL' ? 1 : 0) +
    (filters.harmType !== 'ALL' ? 1 : 0) + (filters.minRisk > 0 ? 1 : 0) + (filters.searchQuery.trim() !== '' ? 1 : 0);

  const statusPills = [
    { id: 'ALL',          label: 'ALL',         count: counts.all,          dot: 'bg-slate' },
    { id: 'BREAKTHROUGH', label: 'BREACH',       count: counts.breakthrough, dot: 'bg-maroon' },
    { id: 'DEFENDED',     label: 'DEF',          count: counts.defended,    dot: 'bg-olive' },
    { id: 'ACTIVE',       label: 'ACTIVE',       count: counts.active,      dot: 'bg-powder' },
    { id: 'QUEUED',       label: 'QUEUED',       count: counts.queued,      dot: 'bg-hairline' },
    { id: 'UNRESOLVED',   label: 'FAIL',         count: counts.unresolved,  dot: 'bg-maroon/50' },
  ];

  const domainLabel = activeRunMeta?.domain || 'ALL CAMPAIGNS';
  const scopeLabel = activeRunId === 'all' ? 'GLOBAL STREAM' : `#${activeRunId?.slice(0, 8)}`;

  return (
    <div className="w-full select-none border-b border-hairline font-mono" aria-label="Mission Control Command Bar">

      {/* ── Strip 1: Title + Scope + Stream Health + Search + Density ── */}
      <div className="flex items-center gap-0 hairline-bottom h-12">

        {/* Title block */}
        <div className="flex items-center gap-3 px-0 pr-5 shrink-0 hairline-right h-full">
          <h1 className="text-sm font-bold tracking-[0.12em] text-slate uppercase font-sans">
            MISSION CONTROL
          </h1>
          <div className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${streamHealth === 'connected' ? 'bg-olive animate-pulse-dot' : streamHealth === 'paused' ? 'bg-camel' : streamHealth === 'connecting' ? 'bg-powder' : 'bg-steel/40'}`} />
            <span className="text-[9px] text-steel uppercase tracking-wider">
              {streamHealth === 'connected' ? 'LIVE' : streamHealth === 'paused' ? 'PAUSED' : streamHealth === 'connecting' ? 'CONNECTING' : 'IDLE'}
            </span>
          </div>
        </div>

        {/* Scope Dropdown */}
        <div className="relative shrink-0 hairline-right h-full" ref={scopeRef}>
          <button
            onClick={() => setScopeOpen(v => !v)}
            className="flex items-center gap-2 px-4 h-full text-xs font-bold uppercase hover:bg-linen/50 transition-colors cursor-pointer text-slate"
            aria-expanded={scopeOpen}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${activeRunId === 'all' ? 'bg-olive' : 'bg-powder'}`} />
            <span>{scopeLabel}</span>
            <span className="text-taupe text-[9px] hidden sm:inline">· {domainLabel.replace(/_/g, ' ').toUpperCase()}</span>
            <ChevronDown size={11} className={`text-steel transition-transform ${scopeOpen ? 'rotate-180' : ''}`} />
          </button>

          {scopeOpen && (
            <div className="absolute left-0 top-full w-72 bg-ivory border border-hairline shadow-2xl z-50 py-1 text-xs animate-fade-in">
              <button onClick={() => handleSelectRun(null)}
                className={`w-full text-left px-3 py-2 hover:bg-linen flex items-center justify-between cursor-pointer ${activeRunId === 'all' ? 'bg-linen font-bold text-slate' : 'text-steel'}`}>
                <span>GLOBAL STREAM (ALL)</span>
                <span className="text-[10px] text-olive font-bold">LIVE</span>
              </button>
              <div className="hairline-top my-1" />
              <div className="px-3 py-1 text-[10px] text-taupe uppercase">RECENT CAMPAIGNS</div>
              {runs.length === 0
                ? <div className="px-3 py-2 text-[11px] text-taupe">No campaigns recorded.</div>
                : runs.map(r => (
                  <button key={r.id} onClick={() => handleSelectRun(r)}
                    className={`w-full text-left px-3 py-1.5 hover:bg-linen flex items-center justify-between cursor-pointer ${activeRunId === r.id ? 'bg-linen font-bold text-slate' : 'text-slate'}`}>
                    <div className="truncate pr-2">
                      <span className="font-bold">#{r.id.slice(0, 6)}</span>{' '}
                      <span className="text-steel text-[11px] uppercase">({r.domain})</span>
                    </div>
                    <span className="text-[10px] text-taupe shrink-0">{r.status}</span>
                  </button>
                ))
              }
            </div>
          )}
        </div>

        {/* Stream paused indicator */}
        {streamHealth === 'paused' && (
          <button onClick={triggerReconnect}
            className="flex items-center gap-1.5 px-3 h-full hairline-right text-camel hover:bg-camel-muted transition-colors cursor-pointer shrink-0"
            title="Stream paused — click to reconnect">
            <AlertTriangle size={12} />
            <span className="text-[10px] font-bold uppercase">RECONNECT</span>
          </button>
        )}
        {streamHealth === 'connecting' && (
          <div className="flex items-center gap-1.5 px-3 h-full hairline-right text-powder shrink-0">
            <RefreshCw size={11} className="animate-spin" />
            <span className="text-[10px] uppercase">CONNECTING</span>
          </div>
        )}

        {/* Search — grows to fill remaining space */}
        <div className="relative flex-1 h-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-steel pointer-events-none" />
          <input
            ref={searchRef}
            type="text"
            value={filters.searchQuery}
            onChange={e => onFilterChange({ searchQuery: e.target.value })}
            placeholder="Search prompts, techniques, task IDs [/]"
            className="w-full h-full pl-10 pr-16 bg-transparent text-[11px] font-mono text-slate placeholder:text-taupe focus:bg-linen/30 focus:outline-none transition-all"
            aria-label="Search specimens"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
            {filters.searchQuery && (
              <button onClick={() => onFilterChange({ searchQuery: '' })} className="text-steel hover:text-slate cursor-pointer"><X size={12} /></button>
            )}
            <kbd className="hidden sm:inline px-1.5 py-0.5 text-[9px] text-taupe bg-linen border border-hairline">/</kbd>
          </div>
        </div>

        {/* Right edge controls — Grouped by full-height vertical lines, options within by smaller lines */}
        <div className="flex items-stretch h-full shrink-0 hairline-left font-mono text-[10px]">
          {/* Density Group */}
          <div className="flex items-center gap-2 px-4 h-full border-r border-hairline">
            {(['comfortable', 'compact', 'research'] as const).map((d, i) => {
              const isActive = density === d;
              const label = d === 'comfortable' ? 'COMF' : d === 'compact' ? 'COMP' : 'RSRCH';
              return (
                <React.Fragment key={d}>
                  {i > 0 && <span className="h-3 w-px bg-hairline" />}
                  <button
                    onClick={() => setDensity(d)}
                    className={`transition-colors cursor-pointer uppercase tracking-wider ${
                      isActive ? 'text-slate font-bold' : 'text-taupe hover:text-slate'
                    }`}
                    title={`${d} density`}
                  >
                    {label}
                  </button>
                </React.Fragment>
              );
            })}
          </div>

          {/* View Mode Group */}
          <div className="flex items-center gap-2 px-4 h-full">
            <button
              onClick={() => onViewModeChange('table')}
              className={`transition-colors cursor-pointer p-0.5 ${
                viewMode === 'table' ? 'text-slate' : 'text-taupe hover:text-slate'
              }`}
              title="Table view"
              aria-label="Table view"
            >
              <List size={13} strokeWidth={viewMode === 'table' ? 2.5 : 1.75} />
            </button>
            <span className="h-3 w-px bg-hairline" />
            <button
              onClick={() => onViewModeChange('grid')}
              className={`transition-colors cursor-pointer p-0.5 ${
                viewMode === 'grid' ? 'text-slate' : 'text-taupe hover:text-slate'
              }`}
              title="Grid view"
              aria-label="Grid view"
            >
              <LayoutGrid size={13} strokeWidth={viewMode === 'grid' ? 2.5 : 1.75} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Strip 2: Status pills + dimension dropdowns ── */}
      <div className="flex items-stretch gap-0 h-9 overflow-x-auto">

        {/* Status Group — Grouped by full-height line, options inside by small lines */}
        <div className="flex items-center gap-2.5 px-3 h-full border-r border-hairline shrink-0 font-mono text-[10px]">
          {statusPills.map((tab, idx) => {
            const isActive = filters.status === tab.id;
            return (
              <React.Fragment key={tab.id}>
                {idx > 0 && <span className="h-3 w-px bg-hairline" />}
                <button
                  onClick={() => onFilterChange({ status: tab.id })}
                  className={`flex items-center gap-1.5 transition-colors cursor-pointer uppercase tracking-wider whitespace-nowrap ${
                    isActive ? 'text-slate font-bold' : 'text-taupe hover:text-slate'
                  }`}
                  role="tab"
                  aria-selected={isActive}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${tab.dot}`} />
                  <span>{tab.label}</span>
                  <span className={`tabular-nums text-[9px] ${isActive ? 'text-slate font-bold' : 'text-taupe'}`}>
                    {tab.count}
                  </span>
                </button>
              </React.Fragment>
            );
          })}
        </div>

        {/* Technique dropdown */}
        <div className="relative shrink-0 border-r border-hairline h-full flex items-center" ref={techRef}>
          <button
            onClick={() => { setTechOpen(v => !v); setHarmOpen(false); }}
            className={`flex items-center gap-2 px-3 h-full text-[10px] font-mono uppercase tracking-wider transition-colors cursor-pointer whitespace-nowrap ${
              filters.technique !== 'ALL' ? 'text-slate font-bold' : 'text-steel hover:text-slate'
            }`}
          >
            <span className="text-taupe">TECH:</span>
            <span>{filters.technique === 'ALL' ? 'ALL' : filters.technique.replace(/_/g, ' ').slice(0, 16)}</span>
            <ChevronDown size={10} className={`transition-transform ${techOpen ? 'rotate-180' : ''}`} />
          </button>
          {techOpen && (
            <div className="absolute left-0 top-full w-64 bg-ivory border border-hairline shadow-2xl z-50 py-1 font-mono text-xs max-h-64 overflow-y-auto animate-fade-in">
              {['ALL', ...availableTechniques].map(t => (
                <button key={t} onClick={() => { onFilterChange({ technique: t }); setTechOpen(false); }}
                  className={`w-full text-left px-3 py-2 hover:bg-linen flex items-center justify-between cursor-pointer ${filters.technique === t ? 'bg-linen font-bold text-slate' : 'text-slate'}`}>
                  <span className="truncate">{t === 'ALL' ? 'ALL TECHNIQUES' : t.replace(/_/g, ' ').toUpperCase()}</span>
                  {filters.technique === t && <Check size={11} className="shrink-0 text-slate" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Harm dropdown */}
        <div className="relative shrink-0 border-r border-hairline h-full flex items-center" ref={harmRef}>
          <button
            onClick={() => { setHarmOpen(v => !v); setTechOpen(false); }}
            className={`flex items-center gap-2 px-3 h-full text-[10px] font-mono uppercase tracking-wider transition-colors cursor-pointer whitespace-nowrap ${
              filters.harmType !== 'ALL' ? 'text-slate font-bold' : 'text-steel hover:text-slate'
            }`}
          >
            <span className="text-taupe">HARM:</span>
            <span>{filters.harmType === 'ALL' ? 'ALL' : filters.harmType.replace(/_/g, ' ').slice(0, 14)}</span>
            <ChevronDown size={10} className={`transition-transform ${harmOpen ? 'rotate-180' : ''}`} />
          </button>
          {harmOpen && (
            <div className="absolute left-0 top-full w-64 bg-ivory border border-hairline shadow-2xl z-50 py-1 font-mono text-xs max-h-64 overflow-y-auto animate-fade-in">
              {['ALL', ...availableHarmTypes].map(h => (
                <button key={h} onClick={() => { onFilterChange({ harmType: h }); setHarmOpen(false); }}
                  className={`w-full text-left px-3 py-2 hover:bg-linen flex items-center justify-between cursor-pointer ${filters.harmType === h ? 'bg-linen font-bold text-slate' : 'text-slate'}`}>
                  <span className="truncate">{h === 'ALL' ? 'ALL HARM TYPES' : h.replace(/_/g, ' ').toUpperCase()}</span>
                  {filters.harmType === h && <Check size={11} className="shrink-0 text-slate" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Min Risk Group — Grouped by full-height line, options inside by small lines */}
        <div className="flex items-center gap-2 px-3 h-full border-r border-hairline shrink-0 font-mono text-[10px]">
          <span className="text-taupe text-[9px] uppercase tracking-wider">MIN RISK:</span>
          {[{ v: 0, l: 'ANY' }, { v: 0.4, l: '≥0.40' }, { v: 0.7, l: '≥0.70' }, { v: 0.85, l: 'CRIT' }].map((lvl, idx) => {
            const isActive = filters.minRisk === lvl.v;
            return (
              <React.Fragment key={lvl.v}>
                {idx > 0 && <span className="h-3 w-px bg-hairline" />}
                <button
                  onClick={() => onFilterChange({ minRisk: lvl.v })}
                  className={`transition-colors cursor-pointer uppercase tracking-wider ${
                    isActive ? 'text-slate font-bold' : 'text-taupe hover:text-slate'
                  }`}
                >
                  {lvl.l}
                </button>
              </React.Fragment>
            );
          })}
        </div>

        {/* Reset Action */}
        {activeFilterCount > 0 && (
          <button
            onClick={onResetFilters}
            className="flex items-center gap-1.5 px-3 h-full text-[10px] font-mono font-bold uppercase text-steel hover:text-maroon hover:bg-maroon/10 transition-colors cursor-pointer whitespace-nowrap ml-auto"
          >
            <RotateCcw size={11} />
            <span>RESET ({activeFilterCount})</span>
          </button>
        )}
      </div>
    </div>
  );
};

// Re-export InstrumentCluster for use in Overview
export { InstrumentCluster };
