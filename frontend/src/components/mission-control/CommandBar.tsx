import React, { useState, useEffect, useMemo, useRef } from 'react';
import { usePipelineStore } from '../../stores/pipelineStore';
import { useLauncherStore } from '../../stores/launcherStore';
import { api } from '../../utils/api';
import type { Run } from '../../types/domain';
import type { FilterState } from '../../types/filters';
import { computeTaskMetrics } from '../../utils/taskMetrics';
import { useHotkeyFocus } from '../../hooks/useHotkeyFocus';
import { parseUtcDate } from '../../utils/date';
import { TelemetryRow, ConfirmModal, AnimatedNumber } from '../ui';
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
const InstrumentCluster: React.FC = React.memo(() => {
  const activeRunId    = usePipelineStore(s => s.activeRunId);
  const liveTasks      = usePipelineStore(s => s.liveTasks);
  const runStats       = usePipelineStore(s => s.runStats);
  const activeRunMeta  = usePipelineStore(s => s.activeRunMeta);
  const streamHealth   = usePipelineStore(s => s.streamHealth);

  const tasks = useMemo(() => Object.values(liveTasks), [liveTasks]);
  const metrics = useMemo(() => computeTaskMetrics(tasks, runStats), [tasks, runStats]);

  const isGlobalStream = !activeRunId || activeRunId === 'all';
  const isFailed = !isGlobalStream && (runStats.status === 'failed' || activeRunMeta?.status === 'failed' || Boolean(activeRunMeta?.error_message));
  const isCompleted = !isGlobalStream && !isFailed && (runStats.status === 'completed' || activeRunMeta?.status === 'completed' || (metrics.total > 0 && metrics.completed >= metrics.total));
  const isRunning = !isGlobalStream && !isFailed && !isCompleted && (runStats.status === 'running' || activeRunMeta?.status === 'running');
  const currentStatus = isGlobalStream ? 'live' : isFailed ? 'failed' : isCompleted ? 'completed' : isRunning ? 'running' : 'idle';

  const [elapsed, setElapsed] = useState('00m 00s');
  useEffect(() => {
    if (isGlobalStream) {
      setElapsed('00m 00s');
      return;
    }

    const startStr = activeRunMeta?.started_at || runStats.started_at;
    if (!startStr || currentStatus === 'idle') {
      setElapsed('00m 00s');
      return;
    }
    const t0 = parseUtcDate(startStr).getTime();
    if (isNaN(t0)) {
      setElapsed('00m 00s');
      return;
    }

    if (isCompleted) {
      const endStr = activeRunMeta?.completed_at || runStats.completed_at;
      let t1: number | null = null;
      if (endStr) {
        const parsed = parseUtcDate(endStr).getTime();
        if (!isNaN(parsed) && parsed >= t0) t1 = parsed;
      }
      if (t1 === null && tasks.length > 0) {
        const taskTimes = tasks
          .map(t => new Date(t.last_updated || t.created_at || '').getTime())
          .filter(t => !isNaN(t) && t >= t0);
        if (taskTimes.length > 0) {
          t1 = Math.max(...taskTimes);
        }
      }
      if (t1 === null) {
        t1 = t0;
      }
      const d = Math.max(0, Math.floor((t1 - t0) / 1000));
      setElapsed(`${String(Math.floor(d / 60)).padStart(2, '0')}m ${String(d % 60).padStart(2, '0')}s`);
      return;
    }

    if (isFailed) {
      return;
    }

    const tick = () => {
      const d = Math.max(0, Math.floor((Date.now() - t0) / 1000));
      setElapsed(`${String(Math.floor(d / 60)).padStart(2, '0')}m ${String(d % 60).padStart(2, '0')}s`);
    };

    tick();
    if (isRunning) {
      const id = setInterval(tick, 1000);
      return () => clearInterval(id);
    }
  }, [isGlobalStream, currentStatus, isFailed, isCompleted, isRunning, runStats.started_at, activeRunMeta?.started_at, runStats.completed_at, activeRunMeta?.completed_at, tasks]);

  const cells = [
    {
      index: '1.01',
      label: 'BRANCHES',
      value: (
        <>
          <AnimatedNumber value={metrics.completed} />
          <span className="text-steel text-lg font-normal">
            {' '}/ {metrics.total > 0 ? <AnimatedNumber value={metrics.total} /> : '—'}
          </span>
        </>
      ),
      sublabel: metrics.total > 0 ? (
        <>
          <AnimatedNumber value={metrics.coveragePct} suffix="%" /> COVERAGE
        </>
      ) : 'STANDBY',
    },
    {
      index: '1.02',
      label: 'BREAKTHROUGHS',
      value: (
        <span className={metrics.breakthroughs > 0 ? 'text-maroon' : 'text-slate'}>
          {metrics.breakthroughs > 0 ? '◆ ' : ''}
          <AnimatedNumber value={metrics.breakthroughs} />
        </span>
      ),
      sublabel: metrics.completed > 0 ? (
        <>
          <AnimatedNumber value={metrics.bypassPct} suffix="%" /> BYPASS
        </>
      ) : '0% OBSERVED',
    },
    {
      index: '1.03',
      label: 'DEFENDED',
      value: (
        <span className={metrics.defended > 0 ? 'text-olive' : 'text-slate'}>
          {metrics.defended > 0 ? '✓ ' : ''}
          <AnimatedNumber value={metrics.defended} />
        </span>
      ),
      sublabel: metrics.completed > 0 ? (
        <>
          <AnimatedNumber value={metrics.resistancePct} suffix="%" /> RESISTANCE
        </>
      ) : '100% CLEAN',
    },
    {
      index: '1.04',
      label: 'MEAN RISK',
      value: (
        <span className={runStats.avg_risk_score >= 0.7 ? 'text-maroon' : runStats.avg_risk_score >= 0.4 ? 'text-camel' : 'text-slate'}>
          <AnimatedNumber value={runStats.avg_risk_score} decimals={2} />
        </span>
      ),
      sublabel: runStats.avg_risk_score >= 0.7 ? 'CRITICAL' : runStats.avg_risk_score >= 0.4 ? 'ELEVATED' : 'NOMINAL',
    },
    {
      index: '1.05',
      label: 'EXECUTION TIME',
      value: isGlobalStream ? '00m 00s' : elapsed,
      sublabel: (
        <span className="flex items-center gap-1.5 font-mono">
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              streamHealth === 'connected' && isRunning
                ? 'bg-olive animate-pulse'
                : streamHealth === 'connecting'
                ? 'bg-camel animate-pulse'
                : isCompleted
                ? 'bg-olive'
                : isFailed
                ? 'bg-maroon'
                : 'bg-steel'
            }`}
          />
          <span>
            {isGlobalStream
              ? 'STREAM ACTIVE'
              : isFailed
              ? 'TERMINATED'
              : isCompleted
              ? 'COMPLETED'
              : isRunning
              ? 'STREAM ACTIVE'
              : String(currentStatus || 'IDLE').toUpperCase()}
          </span>
        </span>
      ),
    },
  ];

  return <TelemetryRow cells={cells} ariaLabel="Execution instruments" />;
});

InstrumentCluster.displayName = 'InstrumentCluster';

// ── Execution Circuit Progress Bar ─────────────────────────────────────────
export const ExecutionCircuit: React.FC<{
  onFilterByStatus?: (s: string) => void;
  activeStatusFilter?: string;
}> = React.memo(({ onFilterByStatus, activeStatusFilter }) => {
  const liveTasks = usePipelineStore(s => s.liveTasks);
  const runStats  = usePipelineStore(s => s.runStats);

  const tasks = useMemo(() => Object.values(liveTasks), [liveTasks]);
  const m = useMemo(() => computeTaskMetrics(tasks, runStats), [tasks, runStats]);
  const pct = (n: number) => m.total > 0 ? (n / m.total) * 100 : 0;

  const mutating     = tasks.filter(t => t.status === 'mutating').length;
  const transmitting = tasks.filter(t => t.status === 'transmitting').length;
  const scoring      = tasks.filter(t => t.status === 'scoring').length;
  const activeCount  = mutating + transmitting + scoring;

  const barSegments = [
    { label: 'QUEUED',       count: m.queued,        color: 'bg-hairline',    filter: 'QUEUED' },
    { label: 'MUTATING',     count: mutating,        color: 'bg-steel/60',    filter: 'ACTIVE' },
    { label: 'TRANSMITTING', count: transmitting,    color: 'bg-powder',      filter: 'ACTIVE' },
    { label: 'SCORING',      count: scoring,         color: 'bg-camel',       filter: 'ACTIVE' },
    { label: 'DEFENDED',     count: m.defended,      color: 'bg-olive',       filter: 'DEFENDED' },
    { label: 'BREAKTHROUGH', count: m.breakthroughs, color: 'bg-maroon',      filter: 'BREAKTHROUGH' },
    { label: 'UNRESOLVED',   count: m.unresolved,    color: 'bg-maroon/40',   filter: 'UNRESOLVED' },
  ].filter(s => s.count > 0 || m.total === 0);

  const filterOptions = [
    { id: 'ALL',          label: 'ALL',          count: tasks.length },
    { id: 'QUEUED',       label: 'QUEUED',       count: m.queued,        dot: 'bg-hairline' },
    { id: 'ACTIVE',       label: 'ACTIVE',       count: activeCount,     dot: 'bg-camel' },
    { id: 'DEFENDED',     label: 'DEFENDED',     count: m.defended,      dot: 'bg-olive' },
    { id: 'BREAKTHROUGH', label: 'BREAKTHROUGH', count: m.breakthroughs, dot: 'bg-maroon' },
    { id: 'UNRESOLVED',   label: 'UNRESOLVED',   count: m.unresolved,    dot: 'bg-maroon/40' },
  ].filter(opt => opt.id === 'ALL' || (opt.count ?? 0) > 0 || m.total === 0);

  return (
    <div className="py-3 hairline-bottom space-y-1.5">
      <div className="flex items-center justify-between font-mono text-[10px] text-steel mb-1">
        <span className="uppercase font-bold text-slate tracking-wider">EXECUTION CIRCUIT</span>
        <span className="tabular-nums">
          <AnimatedNumber value={m.completed} /> / {m.total > 0 ? <AnimatedNumber value={m.total} /> : '—'} COMPLETE (<AnimatedNumber value={m.coveragePct} suffix="%" />)
        </span>
      </div>

      <div className="h-2 w-full bg-linen flex overflow-hidden">
        {m.total === 0 ? (
          <div className="w-full h-full animate-sweep" />
        ) : (
          barSegments.map((seg, idx) => (
            <VTooltip key={`${seg.label}-${idx}`} content={`${seg.label}: ${seg.count}`}>
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
        options={filterOptions}
      />
    </div>
  );
});

ExecutionCircuit.displayName = 'ExecutionCircuit';

// ── Main Command Bar ───────────────────────────────────────────────────────
export const CommandBar: React.FC<CommandBarProps> = React.memo(({
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

  const [showAbortConfirm, setShowAbortConfirm] = useState(false);
  const [isAborting, setIsAborting] = useState(false);

  const isSelectedRunRunning = Boolean(
    activeRunId &&
    activeRunId !== 'all' &&
    activeRunMeta?.status === 'running' &&
    !activeRunMeta?.error_message
  );

  const handleConfirmAbort = async () => {
    if (!activeRunId || activeRunId === 'all') return;
    setIsAborting(true);
    try {
      await api.cancelRun(activeRunId);
      setActiveRunMeta(activeRunMeta ? { ...activeRunMeta, status: 'failed', error_message: 'Campaign aborted by operator' } : null);
    } catch (err) {
      console.error('Failed to abort run:', err);
    } finally {
      setIsAborting(false);
      setShowAbortConfirm(false);
    }
  };

  const domainLabel = activeRunMeta?.domain || 'ALL CAMPAIGNS';
  const scopeLabel = activeRunId === 'all' ? 'GLOBAL STREAM' : `#${activeRunId?.slice(0, 8)}`;

  return (
    <div className="w-full select-none border-b border-hairline font-mono" aria-label="Mission Control Command Bar">
      <ConfirmModal
        isOpen={showAbortConfirm}
        onClose={() => setShowAbortConfirm(false)}
        onConfirm={handleConfirmAbort}
        title="ABORT RUNNING CAMPAIGN"
        subtitle="FORENSIC CONTROL · OPERATOR OVERRIDE"
        description={`Are you sure you want to abort campaign #${activeRunId?.slice(0, 8)}? All in-flight attack mutations and scoring workers will terminate immediately.`}
        confirmLabel="ABORT CAMPAIGN"
        cancelLabel="CONTINUE RUN"
        variant="danger"
        isPending={isAborting}
      />

      {/* ── Strip 1: Title + Scope + Stream Health + Search + Density ── */}
      <div className="flex items-center gap-0 hairline-bottom h-12">

        {/* Title block */}
        <div className="flex items-center px-0 pr-5 shrink-0 hairline-right h-full">
          <h1 className="text-sm font-bold tracking-[0.12em] text-slate uppercase font-sans">
            MISSION CONTROL
          </h1>
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

        {/* Right edge controls — Grouped by full-height vertical lines */}
        <div className="flex items-stretch h-full shrink-0 hairline-left font-mono text-[10px]">
          {/* Active Run Controls (Abort / Re-run) */}
          {activeRunId && activeRunId !== 'all' && (
            <div className="flex items-center px-3 h-full border-r border-hairline">
              {isSelectedRunRunning ? (
                <button
                  onClick={() => setShowAbortConfirm(true)}
                  className="flex items-center gap-1.5 px-2.5 py-1 bg-maroon-muted text-maroon border border-maroon/40 font-bold uppercase hover:bg-maroon hover:text-parchment transition-colors cursor-pointer"
                  title="Abort running campaign"
                >
                  <span className="w-1.5 h-1.5 bg-maroon animate-ping rounded-full" />
                  <span>ABORT RUN</span>
                </button>
              ) : (
                <button
                  onClick={() => {
                    openLauncher({
                      endpoint_id: activeRunMeta?.endpoint_id,
                      domain: activeRunMeta?.domain,
                      attacker_model: activeRunMeta?.attacker_model,
                      judge_model: activeRunMeta?.judge_model,
                    });
                  }}
                  className="flex items-center gap-1.5 px-2.5 py-1 bg-linen text-slate border border-hairline font-bold uppercase hover:bg-slate hover:text-parchment transition-colors cursor-pointer"
                  title="Re-run this campaign with same settings"
                >
                  <RotateCcw size={11} />
                  <span>RE-RUN</span>
                </button>
              )}
            </div>
          )}

          {/* Launch Group */}
          <div className="flex items-center px-4 h-full border-r border-hairline">
            <button
              onClick={() => openLauncher()}
              className="flex items-center gap-1.5 transition-colors cursor-pointer uppercase tracking-wider text-slate font-bold hover:text-maroon"
              title="Launch new campaign"
            >
              <Plus size={12} strokeWidth={2.5} />
              <span className="hidden lg:inline">CAMPAIGN</span>
            </button>
          </div>

          {/* Intel badge (compact viewports — full rail is lg+) */}
          {intelligenceFeed.length > 0 && (
            <div className="flex items-center px-4 h-full border-r border-hairline lg:hidden">
              <span className="flex items-center gap-1.5 text-camel font-bold" title={`${intelligenceFeed.length} intel alerts`}>
                <AlertTriangle size={12} />
                <span className="tabular-nums">{intelligenceFeed.length}</span>
              </span>
            </div>
          )}

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
});

CommandBar.displayName = 'CommandBar';

// Re-export InstrumentCluster for use in Overview
export { InstrumentCluster };

