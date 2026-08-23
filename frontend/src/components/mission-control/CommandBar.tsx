import React, { useState, useEffect, useMemo, useRef } from 'react';
import { usePipelineStore } from '../../stores/pipelineStore';
import { useWorkspaceStore } from '../../stores/workspaceStore';
import { useLauncherStore } from '../../stores/launcherStore';
import { api } from '../../utils/api';
import type { Run } from '../../types/domain';
import type { FilterState } from '../../types/filters';
import { computeTaskMetrics } from '../../utils/taskMetrics';
import { useHotkeyFocus } from '../../hooks/useHotkeyFocus';
import { TelemetryRow } from '../ui';
import { SegmentFilter } from '../ui/SegmentFilter';
import { VTooltip } from '../ui';
import {
  ChevronDown, Search, X, List, LayoutGrid, RotateCcw,
  RefreshCw, AlertTriangle, Check, Plus
} from 'lucide-react';

interface CommandBarProps {
  filters: FilterState;
  onFilterChange: (f: Partial<FilterState>) => void;
  onResetFilters: () => void;
  viewMode: 'table' | 'grid';
  onViewModeChange: (m: 'table' | 'grid') => void;
}

// ── Instrument Cluster (Swiss telemetry) ──────────────────────────────────────
const InstrumentCluster: React.FC = () => {
  const liveTasks      = usePipelineStore(s => s.liveTasks);
  const runStats       = usePipelineStore(s => s.runStats);
  const activeRunMeta  = usePipelineStore(s => s.activeRunMeta);
  const streamHealth   = usePipelineStore(s => s.streamHealth);

  const tasks = useMemo(() => Object.values(liveTasks), [liveTasks]);
  const metrics = useMemo(() => computeTaskMetrics(tasks, runStats), [tasks, runStats]);

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

  const cells = [
    {
      index: '1.01',
      label: 'BRANCHES',
      value: <><span>{metrics.completed}</span><span className="text-steel text-lg font-normal"> / {metrics.total || '—'}</span></>,
      sublabel: metrics.total > 0 ? `${metrics.coveragePct}% COVERAGE` : 'STANDBY',
    },
    {
      index: '1.02',
      label: 'BREAKTHROUGHS',
      value: <span className={metrics.breakthroughs > 0 ? 'text-maroon' : 'text-slate'}>{metrics.breakthroughs > 0 ? '◆ ' : ''}{metrics.breakthroughs}</span>,
      sublabel: metrics.completed > 0 ? `${metrics.bypassPct}% BYPASS` : '0% OBSERVED',
    },
    {
      index: '1.03',
      label: 'DEFENDED',
      value: <span className={metrics.defended > 0 ? 'text-olive' : 'text-slate'}>{metrics.defended > 0 ? '✓ ' : ''}{metrics.defended}</span>,
      sublabel: metrics.completed > 0 ? `${metrics.resistancePct}% RESISTANCE` : '100% CLEAN',
    },
    {
      index: '1.04',
      label: 'MEAN RISK',
      value: (
        <span className={runStats.avg_risk_score >= 0.7 ? 'text-maroon' : runStats.avg_risk_score >= 0.4 ? 'text-camel' : 'text-slate'}>
          {runStats.avg_risk_score.toFixed(2)}
        </span>
      ),
      sublabel: runStats.avg_risk_score >= 0.7 ? 'CRITICAL' : runStats.avg_risk_score >= 0.4 ? 'ELEVATED' : 'NOMINAL',
    },
    {
      index: '1.05',
      label: 'RUN DURATION',
      value: <span className="text-slate">{elapsed}</span>,
      sublabel: (
        <span className="flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full ${streamHealth === 'connected' ? 'bg-olive animate-pulse-dot' : streamHealth === 'paused' ? 'bg-camel' : 'bg-steel/40'}`} />
          {streamHealth === 'connected' ? 'STREAM ACTIVE' : streamHealth === 'paused' ? 'STREAM PAUSED' : runStats.status.toUpperCase()}
        </span>
      ),
    },
  ];

  return <TelemetryRow cells={cells} ariaLabel="Execution instruments" />;
};

// ── Execution Circuit Progress Bar ─────────────────────────────────────────
export const ExecutionCircuit: React.FC<{
  onFilterByStatus?: (s: string) => void;
  activeStatusFilter?: string;
}> = ({ onFilterByStatus, activeStatusFilter }) => {
  const liveTasks = usePipelineStore(s => s.liveTasks);
  const runStats  = usePipelineStore(s => s.runStats);

  const tasks = useMemo(() => Object.values(liveTasks), [liveTasks]);
  const m = useMemo(() => computeTaskMetrics(tasks, runStats), [tasks, runStats]);
  const pct = (n: number) => m.total > 0 ? (n / m.total) * 100 : 0;

  const mutating     = tasks.filter(t => t.status === 'mutating').length;
  const transmitting = tasks.filter(t => t.status === 'transmitting').length;
  const scoring      = tasks.filter(t => t.status === 'scoring').length;

  const segments = [
    { label: 'QUEUED',       count: m.queued,        color: 'bg-hairline',    filter: 'QUEUED' },
    { label: 'MUTATING',     count: mutating,        color: 'bg-steel/60',    filter: 'ACTIVE' },
    { label: 'TRANSMITTING', count: transmitting,    color: 'bg-powder',      filter: 'ACTIVE' },
    { label: 'SCORING',      count: scoring,         color: 'bg-camel',       filter: 'ACTIVE' },
    { label: 'DEFENDED',     count: m.defended,      color: 'bg-olive',       filter: 'DEFENDED' },
    { label: 'BREAKTHROUGH', count: m.breakthroughs, color: 'bg-maroon',      filter: 'BREAKTHROUGH' },
    { label: 'UNRESOLVED',   count: m.unresolved,    color: 'bg-maroon/40',   filter: 'UNRESOLVED' },
  ].filter(s => s.count > 0 || m.total === 0);

  return (
    <div className="py-3 hairline-bottom space-y-1.5">
      <div className="flex items-center justify-between font-mono text-[10px] text-steel mb-1">
        <span className="uppercase font-bold text-slate tracking-wider">EXECUTION CIRCUIT</span>
        <span className="tabular-nums">{m.completed} / {m.total || '—'} COMPLETE ({m.coveragePct}%)</span>
      </div>

      <div className="h-2 w-full bg-linen flex overflow-hidden">
        {m.total === 0 ? (
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

      <SegmentFilter
        ariaLabel="Filter by execution state"
        value={activeStatusFilter ?? 'ALL'}
        onChange={(id) => onFilterByStatus?.(id)}
        options={[
          { id: 'ALL', label: 'ALL', count: tasks.length },
          ...segments.map((s) => ({ id: s.filter, label: s.label, count: s.count, dot: s.color })),
        ]}
      />
    </div>
  );
};

// ── Main Command Bar ───────────────────────────────────────────────────────
export const CommandBar: React.FC<CommandBarProps> = ({
  filters, onFilterChange, onResetFilters, viewMode, onViewModeChange,
}) => {
  const activeRunId  = usePipelineStore(s => s.activeRunId);
  const activeRunMeta = usePipelineStore(s => s.activeRunMeta);
  const setActiveRun = usePipelineStore(s => s.setActiveRun);
  const setActiveRunMeta = usePipelineStore(s => s.setActiveRunMeta);
  const streamHealth = usePipelineStore(s => s.streamHealth);
  const lastEventAt  = usePipelineStore(s => s.lastEventAt);
  const eventCount   = usePipelineStore(s => s.eventCount);
  const triggerReconnect = usePipelineStore(s => s.triggerReconnect);
  const intelligenceFeed = usePipelineStore(s => s.intelligenceFeed);
  const { density, setDensity } = useWorkspaceStore();
  const openLauncher = useLauncherStore((s) => s.openLauncher);

  const [runs, setRuns] = useState<Run[]>([]);
  const [scopeOpen, setScopeOpen] = useState(false);
  const [techOpen, setTechOpen] = useState(false);
  const [harmOpen, setHarmOpen] = useState(false);
  const [staleSeconds, setStaleSeconds] = useState(0);

  const scopeRef = useRef<HTMLDivElement>(null);
  const techRef  = useRef<HTMLDivElement>(null);
  const harmRef  = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  useHotkeyFocus(searchRef);

  // Facet options derive from live data — single source with the ledger.
  const liveTasks = usePipelineStore(s => s.liveTasks);
  const tasksArray = useMemo(() => Object.values(liveTasks), [liveTasks]);

  const availableTechniques = useMemo(() => {
    const s = new Set<string>();
    tasksArray.forEach(t => t.technique && s.add(t.technique));
    return Array.from(s).sort();
  }, [tasksArray]);

  const availableHarmTypes = useMemo(() => {
    const s = new Set<string>();
    tasksArray.forEach(t => t.harm_type && s.add(t.harm_type));
    return Array.from(s).sort();
  }, [tasksArray]);

  const counts = useMemo(() => ({
    all:          tasksArray.length,
    breakthrough: tasksArray.filter(t => t.is_breakthrough || t.status === 'breakthrough').length,
    defended:     tasksArray.filter(t => t.status === 'defended' || (t.status === 'completed' && !t.is_breakthrough)).length,
    active:       tasksArray.filter(t => ['mutating', 'transmitting', 'scoring'].includes(t.status)).length,
    queued:       tasksArray.filter(t => t.status === 'queued').length,
    unresolved:   tasksArray.filter(t => t.status === 'unresolved' || t.status === 'failed').length,
  }), [tasksArray]);

  useEffect(() => {
    let cancelled = false;
    api.listRuns(20, 0)
      .then(r => { if (!cancelled && r?.runs) setRuns(r.runs); })
      .catch(() => { /* scope dropdown falls back to GLOBAL STREAM only */ });
    return () => { cancelled = true; };
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

  // Stream-staleness diagnostics (resurrected from the orphaned StreamStatusBanner):
  // while paused, surface how stale the feed is so "paused" is actionable.
  useEffect(() => {
    if (streamHealth !== 'paused' || !lastEventAt) { setStaleSeconds(0); return; }
    const compute = () =>
      setStaleSeconds(Math.max(0, Math.floor((Date.now() - new Date(lastEventAt).getTime()) / 1000)));
    compute();
    const id = setInterval(compute, 1000);
    return () => clearInterval(id);
  }, [streamHealth, lastEventAt]);

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
    { id: 'ALL',          label: 'ALL',    count: counts.all,          dot: 'bg-slate' },
    { id: 'BREAKTHROUGH', label: 'BREACH', count: counts.breakthrough, dot: 'bg-maroon' },
    { id: 'DEFENDED',     label: 'DEF',    count: counts.defended,     dot: 'bg-olive' },
    { id: 'ACTIVE',       label: 'ACTIVE', count: counts.active,       dot: 'bg-powder' },
    { id: 'QUEUED',       label: 'QUEUED', count: counts.queued,       dot: 'bg-hairline' },
    { id: 'UNRESOLVED',   label: 'FAIL',   count: counts.unresolved,   dot: 'bg-maroon/50' },
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

        {/* Stream paused/connecting diagnostics */}
        {streamHealth === 'paused' && (
          <button onClick={triggerReconnect}
            className="flex items-center gap-1.5 px-3 h-full hairline-right text-camel hover:bg-camel-muted transition-colors cursor-pointer shrink-0"
            title={lastEventAt ? `Last event ${staleSeconds}s ago · ${eventCount} events received this session — click to reconnect` : 'Stream paused — click to reconnect'}>
            <AlertTriangle size={12} />
            <span className="text-[10px] font-bold uppercase hidden md:inline">
              {lastEventAt ? `STALE ${staleSeconds}s · ${eventCount} EVT` : 'RECONNECT'}
            </span>
            <span className="text-[10px] font-bold uppercase md:hidden">RECONNECT</span>
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
              <button onClick={() => onFilterChange({ searchQuery: '' })} className="text-steel hover:text-slate cursor-pointer" aria-label="Clear search"><X size={12} /></button>
            )}
            <kbd className="hidden sm:inline px-1.5 py-0.5 text-[9px] text-taupe bg-linen border border-hairline">/</kbd>
          </div>
        </div>

        {/* Right edge controls — Grouped by full-height vertical lines, options within by smaller lines */}
        <div className="flex items-stretch h-full shrink-0 hairline-left font-mono text-[10px]">
          {/* Launch Group */}
          <div className="flex items-center px-4 h-full border-r border-hairline">
            <button
              onClick={openLauncher}
              className="flex items-center gap-1.5 transition-colors cursor-pointer uppercase tracking-wider text-slate font-bold hover:text-maroon"
              title="Launch new campaign"
            >
              <Plus size={12} strokeWidth={2.5} />
              <span className="hidden lg:inline">CAMPAIGN</span>
            </button>
          </div>

          {/* Intel badge (compact viewports — full rail is xl-only) */}
          {intelligenceFeed.length > 0 && (
            <div className="flex items-center px-4 h-full border-r border-hairline xl:hidden">
              <span className="flex items-center gap-1.5 text-camel font-bold" title={`${intelligenceFeed.length} intel alerts`}>
                <AlertTriangle size={12} />
                <span className="tabular-nums">{intelligenceFeed.length}</span>
              </span>
            </div>
          )}

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

        {/* Status Group */}
        <div className="px-3 h-full border-r border-hairline shrink-0 flex items-center">
          <SegmentFilter
            ariaLabel="Filter by task outcome"
            value={filters.status}
            onChange={(id) => onFilterChange({ status: id as FilterState['status'] })}
            options={statusPills}
          />
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

        {/* Min Risk Group */}
        <div className="px-3 h-full border-r border-hairline shrink-0 flex items-center">
          <SegmentFilter
            leadingLabel="MIN RISK:"
            ariaLabel="Filter by minimum risk score"
            value={String(filters.minRisk)}
            onChange={(id) => onFilterChange({ minRisk: Number(id) })}
            options={[
              { id: '0',    label: 'ANY' },
              { id: '0.4',  label: '≥0.40' },
              { id: '0.7',  label: '≥0.70' },
              { id: '0.85', label: 'CRIT' },
            ]}
          />
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
