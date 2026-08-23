import React, { useEffect, useState, useMemo, useRef } from 'react';
import { api } from '../utils/api';
import { PageHeader, StatusBadge, ActionButton } from '../components/ui';
import { useNavigate } from 'react-router-dom';
import { usePipelineStore } from '../stores/pipelineStore';
import { CampaignLauncher } from '../components/campaigns/CampaignLauncher';
import { CampaignGraphModal } from '../components/graph/CampaignGraphModal';
import type { Run } from '../types/domain';
import {
  Search, X, List, LayoutGrid, Plus, ChevronRight,
  ExternalLink, Copy, Check, Filter, RotateCcw, Network
} from 'lucide-react';

export default function Evaluations() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [graphRun, setGraphRun] = useState<Run | null>(null);
  const [showLauncher, setShowLauncher] = useState(false);

  const navigate = useNavigate();
  const setActiveRun = usePipelineStore((s) => s.setActiveRun);
  const setActiveRunMeta = usePipelineStore((s) => s.setActiveRunMeta);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [domainFilter, setDomainFilter] = useState('ALL');
  const [endpointFilter, setEndpointFilter] = useState('ALL');
  const [minRisk, setMinRisk] = useState<number>(0);

  const searchInputRef = useRef<HTMLInputElement>(null);

  const loadRuns = () => {
    api.listRuns(50, 0)
      .then((res) => {
        setRuns(res?.runs || []);
      })
      .catch((err) => {
        console.error('[Campaigns] API error:', err);
      });
  };

  useEffect(() => {
    loadRuns();
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

  // Navigate to Mission Control with active run scope
  const handleOpenInMissionControl = (run: Run) => {
    setActiveRun(run.id);
    setActiveRunMeta({
      domain: run.domain,
      endpoint_id: run.endpoint_id,
      endpoint_name: run.endpoint_id,
      attacker_model: run.attacker_model,
      judge_model: run.judge_model,
      started_at: run.created_at,
    });
    navigate('/dashboard');
  };

  const copyRunId = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Telemetry Aggregations
  const totalCampaigns = runs.length;
  const activeRunsCount = runs.filter((r) => r.status === 'running').length;
  const totalBreaches = runs.reduce((sum, r) => sum + (r.successful_attacks || 0), 0);
  const totalTasks = runs.reduce((sum, r) => sum + (r.total_tasks || 0), 0);
  const totalDefended = Math.max(0, totalTasks - totalBreaches);

  const validScores = runs.map((r) => r.avg_risk_score).filter((s) => s > 0);
  const meanRiskScore = validScores.length
    ? validScores.reduce((a, b) => a + b, 0) / validScores.length
    : 0;

  const defenseRate = totalTasks > 0 ? (totalDefended / totalTasks) * 100 : 100;

  // Filter Dropdown Options
  const availableDomains = useMemo(() => {
    const set = new Set<string>();
    runs.forEach((r) => {
      if (r.domain) set.add(r.domain);
    });
    return Array.from(set).sort();
  }, [runs]);

  const availableEndpoints = useMemo(() => {
    const set = new Set<string>();
    runs.forEach((r) => {
      if (r.endpoint_id) set.add(r.endpoint_id);
    });
    return Array.from(set).sort();
  }, [runs]);

  // Counts for status tabs
  const statusCounts = useMemo(() => {
    return {
      all: runs.length,
      completed: runs.filter((r) => r.status === 'completed').length,
      running: runs.filter((r) => r.status === 'running').length,
      failed: runs.filter((r) => r.status === 'failed').length,
    };
  }, [runs]);

  // Filtered Runs
  const filteredRuns = useMemo(() => {
    return runs.filter((run) => {
      if (statusFilter !== 'ALL' && run.status !== statusFilter.toLowerCase()) {
        return false;
      }
      if (domainFilter !== 'ALL' && run.domain?.toLowerCase() !== domainFilter.toLowerCase()) {
        return false;
      }
      if (endpointFilter !== 'ALL' && run.endpoint_id !== endpointFilter) {
        return false;
      }
      if (minRisk > 0 && (run.avg_risk_score || 0) < minRisk) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesId = run.id?.toLowerCase().includes(q);
        const matchesDomain = run.domain?.toLowerCase().includes(q);
        const matchesEndpoint = run.endpoint_id?.toLowerCase().includes(q);
        const matchesAttacker = run.attacker_model?.toLowerCase().includes(q);
        const matchesJudge = run.judge_model?.toLowerCase().includes(q);

        if (!matchesId && !matchesDomain && !matchesEndpoint && !matchesAttacker && !matchesJudge) {
          return false;
        }
      }
      return true;
    });
  }, [runs, statusFilter, domainFilter, endpointFilter, minRisk, searchQuery]);

  const hasActiveFilters =
    statusFilter !== 'ALL' ||
    domainFilter !== 'ALL' ||
    endpointFilter !== 'ALL' ||
    minRisk > 0 ||
    searchQuery.trim() !== '';

  const handleResetFilters = () => {
    setStatusFilter('ALL');
    setDomainFilter('ALL');
    setEndpointFilter('ALL');
    setMinRisk(0);
    setSearchQuery('');
  };

  const statusTabs = [
    { id: 'ALL', label: 'ALL CAMPAIGNS', count: statusCounts.all, dot: 'bg-slate' },
    { id: 'COMPLETED', label: 'COMPLETED', count: statusCounts.completed, dot: 'bg-olive' },
    { id: 'RUNNING', label: 'RUNNING / LIVE', count: statusCounts.running, dot: 'bg-camel' },
    { id: 'FAILED', label: 'FAILED / TIMEOUT', count: statusCounts.failed, dot: 'bg-maroon' },
  ];

  return (
    <section className="flex flex-col w-full hairline-bottom animate-fade-in pb-16" aria-label="Campaigns Ledger">
      {/* ── 1. Page Header ── */}
      <PageHeader
        title="CAMPAIGNS"
        subtitle="HISTORICAL EVALUATION LEDGER & RUN ARCHIVE"
        action={
          <ActionButton
            variant="primary"
            icon={showLauncher ? <X size={14} /> : <Plus size={14} strokeWidth={2.5} />}
            onClick={() => setShowLauncher((v) => !v)}
          >
            {showLauncher ? 'CLOSE LAUNCHER' : 'NEW CAMPAIGN'}
          </ActionButton>
        }
      />

      {/* ── Canonical 5-Stage Campaign Launcher Drawer ── */}
      <CampaignLauncher
        isOpen={showLauncher}
        onClose={() => setShowLauncher(false)}
        onRunCreated={() => {
          setShowLauncher(false);
          loadRuns();
        }}
      />

      {/* ── 2. Swiss Telemetry Row (Exact Landing Page Standard) ── */}
      <div className="grid grid-cols-2 md:grid-cols-5 divide-y md:divide-y-0 md:divide-x divide-hairline hairline-bottom select-none">
        {/* 1.01 TOTAL CAMPAIGNS */}
        <div className="py-5 pr-4 md:py-6 md:pr-6 md:pl-0 flex flex-col justify-between">
          <div>
            <div className="text-xs font-mono text-steel mb-1">1.01</div>
            <div className="text-xs font-semibold uppercase tracking-[0.02em] text-slate mb-2">
              TOTAL CAMPAIGNS
            </div>
          </div>
          <div>
            <div className="font-mono text-2xl md:text-3xl font-bold text-slate tabular-nums leading-none">
              {totalCampaigns} <span className="text-steel text-sm font-normal">RUNS</span>
            </div>
            <div className="text-[10px] font-mono text-steel mt-2 uppercase truncate">
              {totalTasks} TASK BRANCHES EVALUATED
            </div>
          </div>
        </div>

        {/* 1.02 ACTIVE SWEEPS */}
        <div className="p-4 md:p-6 flex flex-col justify-between">
          <div>
            <div className="text-xs font-mono text-steel mb-1">1.02</div>
            <div className="text-xs font-semibold uppercase tracking-[0.02em] text-slate mb-2">
              ACTIVE SWEEPS
            </div>
          </div>
          <div>
            <div className="font-mono text-2xl md:text-3xl font-bold tabular-nums leading-none flex items-center gap-2 text-slate">
              {activeRunsCount > 0 && <span className="w-2 h-2 rounded-full bg-olive animate-pulse" />}
              {activeRunsCount}
            </div>
            <div className="text-[10px] font-mono text-steel mt-2 uppercase truncate">
              {activeRunsCount > 0 ? 'CONCURRENT WORKERS ACTIVE' : 'NO IN-FLIGHT SWEEPS'}
            </div>
          </div>
        </div>

        {/* 1.03 CONFIRMED BREACHES */}
        <div className="p-4 md:p-6 flex flex-col justify-between">
          <div>
            <div className="text-xs font-mono text-steel mb-1">1.03</div>
            <div className="text-xs font-semibold uppercase tracking-[0.02em] text-slate mb-2">
              TOTAL BREAKTHROUGHS
            </div>
          </div>
          <div>
            <div className={`font-mono text-2xl md:text-3xl font-bold tabular-nums leading-none flex items-center gap-1.5 ${
              totalBreaches > 0 ? 'text-maroon' : 'text-slate'
            }`}>
              {totalBreaches > 0 && <span className="text-sm">◆</span>}
              {totalBreaches}
            </div>
            <div className="text-[10px] font-mono text-steel mt-2 uppercase truncate">
              {totalTasks > 0 ? `${((totalBreaches / totalTasks) * 100).toFixed(1)}% OVERALL BYPASS RATE` : '0% OBSERVED'}
            </div>
          </div>
        </div>

        {/* 1.04 MEAN RISK SCORE */}
        <div className="p-4 md:p-6 flex flex-col justify-between">
          <div>
            <div className="text-xs font-mono text-steel mb-1">1.04</div>
            <div className="text-xs font-semibold uppercase tracking-[0.02em] text-slate mb-2">
              AGGREGATE RISK
            </div>
          </div>
          <div>
            <div className={`font-mono text-2xl md:text-3xl font-bold tabular-nums leading-none ${
              meanRiskScore >= 0.7 ? 'text-maroon' : meanRiskScore >= 0.4 ? 'text-camel' : 'text-slate'
            }`}>
              {meanRiskScore.toFixed(2)}
            </div>
            <div className="text-[10px] font-mono text-steel mt-2 uppercase truncate">
              {meanRiskScore >= 0.7 ? 'HIGH RISK PORTFOLIO' : meanRiskScore >= 0.4 ? 'MODERATE RISK' : 'NOMINAL RESILIENCE'}
            </div>
          </div>
        </div>

        {/* 1.05 DEFENSE RESILIENCE */}
        <div className="py-5 pl-4 md:py-6 md:pl-6 flex flex-col justify-between max-md:col-span-2">
          <div>
            <div className="text-xs font-mono text-steel mb-1">1.05</div>
            <div className="text-xs font-semibold uppercase tracking-[0.02em] text-slate mb-2">
              DEFENSE RESILIENCE
            </div>
          </div>
          <div>
            <div className="font-mono text-2xl md:text-3xl font-bold text-olive tabular-nums leading-none">
              {defenseRate.toFixed(1)}%
            </div>
            <div className="text-[10px] font-mono text-steel mt-2 uppercase truncate">
              {totalDefended} VECTORS REPELLED
            </div>
          </div>
        </div>
      </div>

      {/* ── 3. Multifaceted Search & Dimension Console (3-Tier Standard) ── */}
      <div className="w-full hairline-bottom select-none py-4 space-y-3 font-mono" aria-label="Campaign Filters">
        {/* ROW 1: Omnibar Search & View Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[280px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-steel pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search campaigns by Run ID, domain, target model, or attacker model [/]"
              className="w-full pl-10 pr-16 py-2 bg-linen/50 border border-hairline text-xs font-mono text-slate placeholder:text-taupe focus:bg-ivory focus:border-slate focus:outline-none transition-all shadow-2xs"
              aria-label="Search campaigns"
            />
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
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

          {/* View Mode Switcher — Vertical Line Hierarchy */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-linen/40 border border-hairline shrink-0 self-end sm:self-auto font-mono text-[10px]">
            <button
              onClick={() => setViewMode('table')}
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
              onClick={() => setViewMode('grid')}
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

        {/* ROW 2: Status Lifecycle Tabs — Grouped by Vertical Hairlines */}
        <div className="flex items-center gap-2.5 overflow-x-auto pb-1 scrollbar-none font-mono text-[10px]">
          {statusTabs.map((tab, idx) => {
            const isActive = statusFilter === tab.id;
            return (
              <React.Fragment key={tab.id}>
                {idx > 0 && <span className="h-3 w-px bg-hairline" />}
                <button
                  onClick={() => setStatusFilter(tab.id)}
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

        {/* ROW 3: Dimensions & Facets (Full-Width Responsive Row) */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1 text-xs w-full">
          {/* Domain Dropdown */}
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <select
                value={domainFilter}
                onChange={(e) => setDomainFilter(e.target.value)}
                className="w-full px-3 py-2 bg-linen/40 border border-hairline text-slate font-mono text-xs uppercase cursor-pointer hover:border-steel focus:outline-none focus:border-slate"
                aria-label="Filter by domain"
              >
                <option value="ALL">ALL DOMAINS ({availableDomains.length})</option>
                {availableDomains.map((d) => (
                  <option key={d} value={d}>
                    {d.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Endpoint Dropdown */}
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <select
                value={endpointFilter}
                onChange={(e) => setEndpointFilter(e.target.value)}
                className="w-full px-3 py-2 bg-linen/40 border border-hairline text-slate font-mono text-xs uppercase cursor-pointer hover:border-steel focus:outline-none focus:border-slate"
                aria-label="Filter by target endpoint"
              >
                <option value="ALL">ALL TARGET ENDPOINTS ({availableEndpoints.length})</option>
                {availableEndpoints.map((ep) => (
                  <option key={ep} value={ep}>
                    {ep.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Risk Level Segment — Vertical Line Hierarchy */}
          <div className="flex items-center gap-2 px-3 py-2 bg-linen/40 border border-hairline font-mono text-[10px] shrink-0 self-stretch sm:self-auto justify-between sm:justify-start">
            <span className="text-taupe uppercase text-[9px] tracking-wider">MIN RISK:</span>
            <div className="flex items-center gap-2">
              {[
                { val: 0, label: 'ANY' },
                { val: 0.4, label: '≥0.40' },
                { val: 0.7, label: '≥0.70' },
                { val: 0.85, label: 'CRIT' },
              ].map((lvl, idx) => (
                <React.Fragment key={lvl.val}>
                  {idx > 0 && <span className="h-3 w-px bg-hairline" />}
                  <button
                    onClick={() => setMinRisk(lvl.val)}
                    className={`transition-colors cursor-pointer uppercase tracking-wider ${
                      minRisk === lvl.val ? 'text-slate font-bold' : 'text-taupe hover:text-slate'
                    }`}
                  >
                    {lvl.label}
                  </button>
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* Reset Action */}
          {hasActiveFilters && (
            <button
              onClick={handleResetFilters}
              className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-mono text-steel hover:text-maroon hover:bg-maroon/10 border border-hairline hover:border-maroon/30 transition-all cursor-pointer uppercase font-bold shrink-0"
              title="Reset all active filters"
            >
              <RotateCcw size={12} />
              <span>RESET</span>
            </button>
          )}
        </div>
      </div>

      {/* ── 4. Campaigns Table / Grid ── */}
      {filteredRuns.length > 0 ? (
        viewMode === 'grid' ? (
          /* Grid View Mode */
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 py-4" role="region" aria-label="Campaigns Grid">
            {filteredRuns.map((run, idx) => {
              const indexStr = String(idx + 1).padStart(2, '0');
              const isCompleted = run.status === 'completed';
              const isRunning = run.status === 'running';
              const isFailed = run.status === 'failed';
              const breachPct = run.total_tasks > 0 ? Math.round((run.successful_attacks / run.total_tasks) * 100) : 0;

              return (
                <div
                  key={run.id}
                  onClick={() => handleOpenInMissionControl(run)}
                  className="p-5 bg-ivory border border-hairline hover:border-steel/60 hover:shadow-xs transition-all cursor-pointer select-none space-y-4"
                  role="button"
                  tabIndex={0}
                >
                  <div className="flex items-center justify-between font-mono text-xs">
                    <span className="text-steel font-bold">#{indexStr}</span>
                    <StatusBadge
                      label={String(run.status)}
                      variant={isCompleted ? 'olive' : isRunning ? 'camel' : isFailed ? 'maroon' : 'default'}
                      pulse={isRunning}
                    />
                  </div>

                  <div>
                    <h3 className="font-mono text-sm font-bold text-slate uppercase truncate">
                      {run.domain}
                    </h3>
                    <p className="font-mono text-xs text-steel uppercase truncate mt-0.5">
                      TARGET: {run.endpoint_id}
                    </p>
                  </div>

                  {/* Breach Ratio Bar */}
                  <div className="space-y-1.5 font-mono text-xs">
                    <div className="flex items-center justify-between text-[10px] text-steel">
                      <span>BRANCH BREACH RATIO</span>
                      <span className={`font-bold tabular-nums ${run.successful_attacks > 0 ? 'text-maroon' : 'text-slate'}`}>
                        {run.successful_attacks} / {run.total_tasks} ({breachPct}%)
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-linen flex overflow-hidden border border-hairline">
                      <div
                        style={{ width: `${breachPct}%` }}
                        className={`h-full ${run.successful_attacks > 0 ? 'bg-maroon' : 'bg-olive'}`}
                      />
                    </div>
                  </div>

                  {/* Footer Meta */}
                  <div className="flex items-center justify-between font-mono text-xs pt-2 hairline-top">
                    <div>
                      <span className="text-[9px] text-taupe uppercase block">TIMESTAMP</span>
                      <span className="text-[11px] text-steel">
                        {new Date(run.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[9px] text-taupe uppercase block">RISK INDEX</span>
                      <span className={`text-base font-bold tabular-nums ${
                        run.avg_risk_score >= 0.7 ? 'text-maroon' : run.avg_risk_score >= 0.4 ? 'text-camel' : 'text-slate'
                      }`}>
                        {run.avg_risk_score.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 flex items-center justify-between gap-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); setGraphRun(run); }}
                      className="flex items-center gap-1.5 px-2 py-1.5 font-mono text-[9px] font-bold uppercase tracking-wider text-steel border border-hairline hover:text-slate hover:border-steel/60 transition-colors cursor-pointer"
                    >
                      <Network size={10} />
                      GRAPH
                    </button>
                    <span className="text-xs font-mono font-bold text-slate hover:underline flex items-center gap-1 uppercase">
                      <span>INSPECT</span>
                      <ExternalLink size={12} />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Tabular Ledger View Mode (Canonical Swiss Layout) */
          <div className="w-full hairline-bottom select-none font-mono" role="region" aria-label="Campaigns Table">
            {/* Table Headers */}
            <div className="hidden md:grid md:grid-cols-[60px_180px_1fr_160px_110px_110px_100px] items-center p-0 hairline-bottom bg-linen/30 text-xs font-semibold uppercase text-steel">
              <div className="p-3 md:p-4 hairline-right">#</div>
              <div className="p-3 md:p-4 hairline-right">DOMAIN &amp; TARGET</div>
              <div className="p-3 md:p-4 hairline-right">RUN SPECIFICATION &amp; TIMESTAMP</div>
              <div className="p-3 md:p-4 hairline-right text-center">BREACH RATIO</div>
              <div className="p-3 md:p-4 hairline-right text-right">RISK INDEX</div>
              <div className="p-3 md:p-4 text-center hairline-right">STATUS</div>
              <div className="p-3 md:p-4 text-center"><span className="sr-only">Actions</span></div>
            </div>

            {/* Rows */}
            <div className="divide-y divide-hairline">
              {filteredRuns.map((run, idx) => {
                const indexStr = String(idx + 1).padStart(2, '0');
                const isCompleted = run.status === 'completed';
                const isRunning = run.status === 'running';
                const isFailed = run.status === 'failed';
                const breachPct = run.total_tasks > 0 ? Math.round((run.successful_attacks / run.total_tasks) * 100) : 0;

                return (
                  <div key={run.id} className="transition-colors hover:bg-linen/40 bg-ivory">
                    <div
                      onClick={() => handleOpenInMissionControl(run)}
                      className="grid grid-cols-1 md:grid-cols-[60px_180px_1fr_160px_110px_110px_100px] items-center p-0 cursor-pointer group"
                      role="button"
                      tabIndex={0}
                      title="Click to load campaign in Mission Control"
                    >
                      {/* # Index */}
                      <div className="p-3 md:p-4 text-sm font-mono text-steel md:hairline-right select-none flex items-center justify-between">
                        <span>{indexStr}</span>
                        {isRunning && <span className="w-2 h-2 rounded-full bg-olive animate-pulse md:hidden" />}
                      </div>

                      {/* Domain & Target */}
                      <div className="p-3 md:p-4 md:hairline-right min-w-0">
                        <p className="text-xs font-bold uppercase tracking-tight text-slate truncate">
                          {run.domain}
                        </p>
                        <p className="text-[10px] text-steel uppercase truncate mt-0.5">
                          TARGET: {run.endpoint_id}
                        </p>
                      </div>

                      {/* Run ID, Config & Timestamp */}
                      <div className="p-3 md:p-4 md:hairline-right min-w-0 text-xs">
                        <div className="flex items-center gap-2">
                          <code className="font-bold text-slate">#{run.id.slice(0, 8)}</code>
                          <button
                            onClick={(e) => copyRunId(e, run.id)}
                            className="text-steel hover:text-slate p-0.5"
                            title="Copy Run ID"
                          >
                            {copiedId === run.id ? <Check size={11} className="text-olive" /> : <Copy size={11} />}
                          </button>
                          <span className="text-taupe">·</span>
                          <span className="text-steel text-[11px] truncate">
                            {new Date(run.created_at).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-[10px] text-taupe mt-1 truncate">
                          ATTACKER: {run.attacker_model || 'default'} · JUDGE: {run.judge_model || 'default'}
                        </p>
                      </div>

                      {/* Breach Ratio & Progress Bar */}
                      <div className="p-3 md:p-4 md:hairline-right text-left md:text-center space-y-1">
                        <div className="flex items-center justify-between md:justify-center gap-2">
                          <span className={`font-mono text-xs font-bold tabular-nums ${
                            run.successful_attacks > 0 ? 'text-maroon' : 'text-slate'
                          }`}>
                            {run.successful_attacks} / {run.total_tasks}
                          </span>
                          <span className="text-[9px] text-taupe uppercase">({breachPct}%)</span>
                        </div>
                        <div className="h-1 w-full max-w-[100px] mx-auto bg-linen flex overflow-hidden border border-hairline">
                          <div
                            style={{ width: `${breachPct}%` }}
                            className={`h-full ${run.successful_attacks > 0 ? 'bg-maroon' : 'bg-olive'}`}
                          />
                        </div>
                      </div>

                      {/* Risk Score */}
                      <div className="p-3 md:p-4 md:hairline-right text-left md:text-right">
                        <span className={`font-mono text-base font-bold tabular-nums block leading-tight ${
                          run.avg_risk_score >= 0.7 ? 'text-maroon' : run.avg_risk_score >= 0.4 ? 'text-camel' : 'text-slate'
                        }`}>
                          {run.avg_risk_score.toFixed(2)}
                        </span>
                        <span className="text-[9px] text-taupe uppercase block">
                          {run.avg_risk_score >= 0.7 ? 'CRITICAL' : run.avg_risk_score >= 0.4 ? 'ELEVATED' : 'NOMINAL'}
                        </span>
                      </div>

                      {/* State Badge */}
                      <div className="p-3 md:p-4 md:hairline-right flex items-center justify-start md:justify-center">
                        <StatusBadge
                          label={String(run.status)}
                          variant={isCompleted ? 'olive' : isRunning ? 'camel' : isFailed ? 'maroon' : 'default'}
                          pulse={isRunning}
                        />
                      </div>

                      {/* Actions: Graph + Inspect */}
                      <div className="p-3 md:p-4 flex items-center justify-center gap-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); setGraphRun(run); }}
                          className="flex items-center gap-1 px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-wider text-steel border border-hairline hover:bg-slate hover:text-parchment hover:border-slate transition-colors cursor-pointer"
                          title="Open Execution Graph"
                        >
                          <Network size={10} />
                          <span>GRAPH</span>
                        </button>
                        <ChevronRight size={14} className="text-steel group-hover:text-slate group-hover:translate-x-0.5 transition-all shrink-0" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )
      ) : hasActiveFilters ? (
        /* Empty Filter State */
        <div className="p-12 text-center font-mono hairline-bottom bg-linen/20">
          <Filter className="w-5 h-5 text-steel/50 mx-auto mb-2" strokeWidth={1.5} />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate">
            NO CAMPAIGNS MATCH CURRENT FILTERS
          </h3>
          <p className="text-[11px] text-taupe mt-1">
            Try resetting status, domain, endpoint, or risk criteria.
          </p>
          <button
            onClick={handleResetFilters}
            className="mt-3 px-3 py-1.5 border border-hairline bg-cream text-slate font-mono text-xs font-bold uppercase hover:bg-slate hover:text-parchment transition-colors cursor-pointer"
          >
            RESET ALL FILTERS
          </button>
        </div>
      ) : (
        /* Clean Minimal Empty State Row */
        <div className="py-16 px-6 text-center font-mono select-none hairline-bottom bg-linen/20">
          <p className="text-xs font-bold uppercase text-slate">NO CAMPAIGNS EXECUTED YET</p>
          <p className="text-[11px] text-steel mt-1 max-w-md mx-auto">
            Click '+ NEW CAMPAIGN' in the header to select a target endpoint and dispatch your first evaluation sweep.
          </p>
        </div>
      )}
      <CampaignGraphModal run={graphRun} onClose={() => setGraphRun(null)} />
    </section>
  );
}
