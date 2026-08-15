import React, { useState, useEffect } from 'react';
import { usePipelineStore } from '../../stores/pipelineStore';
import { api } from '../../utils/api';
import type { Run } from '../../types/domain';
import { VTooltip } from '../ui';
import { ChevronDown, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface MissionControlHeaderProps {
  onFilterByStatus?: (status: string) => void;
  activeStatusFilter?: string;
}

export const MissionControlHeader: React.FC<MissionControlHeaderProps> = ({
  onFilterByStatus,
  activeStatusFilter = 'ALL',
}) => {
  const navigate = useNavigate();
  const liveTasks = usePipelineStore((s) => s.liveTasks);
  const runStats = usePipelineStore((s) => s.runStats);
  const activeRunId = usePipelineStore((s) => s.activeRunId);
  const activeRunMeta = usePipelineStore((s) => s.activeRunMeta);
  const setActiveRun = usePipelineStore((s) => s.setActiveRun);
  const setActiveRunMeta = usePipelineStore((s) => s.setActiveRunMeta);

  const [availableRuns, setAvailableRuns] = useState<Run[]>([]);
  const [runSelectorOpen, setRunSelectorOpen] = useState(false);

  useEffect(() => {
    api.listRuns(20, 0)
      .then((res) => {
        if (res?.runs) setAvailableRuns(res.runs);
      })
      .catch(() => {});
  }, []);

  const handleSelectRun = (run: Run | null) => {
    if (!run) {
      setActiveRun('all');
      setActiveRunMeta(null);
    } else {
      setActiveRun(run.id);
      setActiveRunMeta({
        domain: run.domain,
        endpoint_id: run.endpoint_id,
        endpoint_name: run.endpoint_id,
        attacker_model: run.attacker_model,
        judge_model: run.judge_model,
        started_at: run.created_at,
      });
    }
    setRunSelectorOpen(false);
  };

  const tasks = Object.values(liveTasks);
  const totalCount = Math.max(tasks.length, runStats.total_tasks || 0);

  const queuedCount = tasks.filter((t) => t.status === 'queued').length;
  const mutatingCount = tasks.filter((t) => t.status === 'mutating').length;
  const transmittingCount = tasks.filter((t) => t.status === 'transmitting').length;
  const scoringCount = tasks.filter((t) => t.status === 'scoring').length;
  const breakthroughCount = tasks.filter((t) => t.is_breakthrough || t.status === 'breakthrough').length;
  const defendedCount = tasks.filter((t) => t.status === 'defended' || (t.status === 'completed' && !t.is_breakthrough)).length;
  const unresolvedCount = tasks.filter((t) => t.status === 'unresolved' || t.status === 'failed').length;

  const activeBranchesCount = mutatingCount + transmittingCount + scoringCount;
  const completedCount = breakthroughCount + defendedCount;

  // Real Elapsed Duration
  const [elapsedDisplay, setElapsedDisplay] = useState('00m 00s');

  useEffect(() => {
    const startedAtStr = activeRunMeta?.started_at || runStats.started_at;
    if (!startedAtStr || runStats.status === 'idle') {
      setElapsedDisplay('00m 00s');
      return;
    }

    const startedTime = new Date(startedAtStr).getTime();
    if (isNaN(startedTime)) {
      setElapsedDisplay('00m 00s');
      return;
    }

    const updateTimer = () => {
      const now = Date.now();
      const diffSec = Math.max(0, Math.floor((now - startedTime) / 1000));
      const m = Math.floor(diffSec / 60);
      const s = diffSec % 60;
      setElapsedDisplay(`${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`);
    };

    if (runStats.status === 'running') {
      updateTimer();
      const timer = setInterval(updateTimer, 1000);
      return () => clearInterval(timer);
    } else {
      updateTimer();
    }
  }, [runStats.status, runStats.started_at, activeRunMeta?.started_at]);

  const targetModelLabel =
    activeRunMeta?.endpoint_name ||
    runStats.endpoint_name ||
    (activeRunId === 'all' ? 'All Target Models' : `Endpoint #${activeRunId?.slice(0, 8)}`);

  const domainLabel = activeRunMeta?.domain || runStats.domain || 'Multi-Domain';
  const activeTechniques = Array.from(new Set(tasks.map((t) => t.technique).filter(Boolean)));

  const narrativeSentence = (() => {
    if (tasks.length === 0 && runStats.status === 'idle') {
      return 'System standby — Redis Streams listener connected. Awaiting red-team campaign dispatch.';
    }
    if (runStats.status === 'completed') {
      return `Completed evaluation for ${domainLabel} on ${targetModelLabel}: ${breakthroughCount} breakthroughs confirmed out of ${totalCount} task branches.`;
    }
    if (activeBranchesCount > 0) {
      return `Adversarial sweep active for ${domainLabel} on ${targetModelLabel}: ${activeBranchesCount} of ${totalCount || tasks.length} branches executing across ${activeTechniques.length || 1} technique lanes.`;
    }
    return `Evaluated ${completedCount} of ${totalCount || tasks.length} adversarial branches against ${targetModelLabel}.`;
  })();

  const pct = (count: number) => (totalCount > 0 ? (count / totalCount) * 100 : 0);

  const segments = [
    { label: 'QUEUED', count: queuedCount, pct: pct(queuedCount), color: 'bg-hairline', filter: 'QUEUED' },
    { label: 'MUTATING', count: mutatingCount, pct: pct(mutatingCount), color: 'bg-steel/60', filter: 'MUTATING' },
    { label: 'TRANSMITTING', count: transmittingCount, pct: pct(transmittingCount), color: 'bg-powder', filter: 'TRANSMITTING' },
    { label: 'SCORING', count: scoringCount, pct: pct(scoringCount), color: 'bg-camel', filter: 'SCORING' },
    { label: 'DEFENDED', count: defendedCount, pct: pct(defendedCount), color: 'bg-olive', filter: 'DEFENDED' },
    { label: 'BREAKTHROUGH', count: breakthroughCount, pct: pct(breakthroughCount), color: 'bg-maroon', filter: 'BREAKTHROUGH' },
    { label: 'UNRESOLVED', count: unresolvedCount, pct: pct(unresolvedCount), color: 'bg-maroon/40', filter: 'UNRESOLVED' },
  ].filter((s) => s.count > 0 || totalCount === 0);

  return (
    <section className="w-full select-none" aria-label="Mission Control Header & Telemetry">
      {/* 1. Page Title Header: Subtitle directly below Title */}
      <div className="py-6 hairline-bottom flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-medium tracking-tight text-slate uppercase">
            MISSION CONTROL
          </h1>
          <p className="text-xs font-mono text-steel tracking-widest uppercase mt-1">
            // LIVE ADVERSARIAL TELEMETRY
          </p>
        </div>

        {/* Action Button */}
        <button
          onClick={() => navigate('/dashboard/endpoints')}
          className="flex items-center gap-2 px-5 py-2.5 bg-slate text-parchment font-mono text-xs font-bold uppercase transition-all hover:bg-slate/90 shadow-xs shrink-0 cursor-pointer self-start md:self-auto"
        >
          <Plus size={14} strokeWidth={2.5} />
          <span>NEW CAMPAIGN</span>
        </button>
      </div>

      {/* 2. Run Scope & Target Specimen Strip (Open layout, no box-in-a-box) */}
      <div className="py-4 hairline-bottom flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1.5 flex-1 min-w-0">
          {/* Multi-Run Selector Dropdown */}
          <div className="flex items-center gap-3 font-mono text-xs">
            <span className="text-taupe uppercase text-[10px]">ACTIVE SCOPE:</span>
            <div className="relative">
              <button
                onClick={() => setRunSelectorOpen((v) => !v)}
                className="flex items-center gap-1.5 text-slate font-bold uppercase hover:text-slate/80 cursor-pointer py-0.5"
                aria-expanded={runSelectorOpen}
              >
                <span className={`w-2 h-2 rounded-full ${activeRunId === 'all' ? 'bg-olive animate-pulse' : 'bg-powder'}`} />
                <span className="underline decoration-hairline underline-offset-4">
                  {activeRunId === 'all' ? 'GLOBAL STREAM (ALL ACTIVE RUNS)' : `CAMPAIGN #${activeRunId?.slice(0, 8)}`}
                </span>
                <ChevronDown size={12} className={`text-steel transition-transform ${runSelectorOpen ? 'rotate-180' : ''}`} />
              </button>

              {runSelectorOpen && (
                <div className="absolute left-0 top-full mt-2 w-80 bg-ivory border border-hairline shadow-2xl z-50 py-1 font-mono text-xs animate-fade-in">
                  <button
                    onClick={() => handleSelectRun(null)}
                    className={`w-full text-left px-3 py-2 hover:bg-linen flex items-center justify-between cursor-pointer ${
                      activeRunId === 'all' ? 'bg-linen font-bold text-slate' : 'text-steel'
                    }`}
                  >
                    <span>GLOBAL STREAM (ALL RUNS)</span>
                    <span className="text-[10px] text-olive font-bold">LIVE BUS</span>
                  </button>
                  <div className="hairline-top my-1" />
                  <div className="px-3 py-1 text-[10px] text-taupe uppercase">RECENT CAMPAIGNS</div>
                  {availableRuns.length === 0 ? (
                    <div className="px-3 py-2 text-[11px] text-taupe">No historical runs recorded.</div>
                  ) : (
                    availableRuns.map((r) => (
                      <button
                        key={r.id}
                        onClick={() => handleSelectRun(r)}
                        className={`w-full text-left px-3 py-1.5 hover:bg-linen flex items-center justify-between cursor-pointer ${
                          activeRunId === r.id ? 'bg-linen font-bold text-slate' : 'text-slate'
                        }`}
                      >
                        <div className="truncate pr-2">
                          <span className="font-bold">#{r.id.slice(0, 6)}</span>{' '}
                          <span className="text-steel uppercase text-[11px]">({r.domain})</span>
                        </div>
                        <span className="text-[10px] text-taupe shrink-0">{r.status}</span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          <p className="text-sm font-sans text-slate leading-relaxed">
            {narrativeSentence}
          </p>
        </div>

        {/* Target Model & Domain Metadata */}
        <div className="flex items-center gap-6 font-mono text-xs shrink-0 pt-2 lg:pt-0">
          <div>
            <span className="text-taupe uppercase text-[9px] tracking-wider block">ACTIVE TARGET MODEL</span>
            <span className="text-slate font-bold text-xs uppercase block mt-0.5 truncate max-w-[200px]">
              {targetModelLabel}
            </span>
          </div>
          <div className="h-6 w-px bg-hairline" />
          <div>
            <span className="text-taupe uppercase text-[9px] tracking-wider block">SECURITY DOMAIN</span>
            <span className="text-slate font-bold text-xs uppercase block mt-0.5">
              {domainLabel}
            </span>
          </div>
        </div>
      </div>

      {/* 3. Branch Execution Circuit Progress Line (Slim, elegant 3px track) */}
      <div className="py-3 hairline-bottom space-y-2">
        <div className="flex items-center justify-between font-mono text-xs text-steel">
          <span className="uppercase text-[10px] font-bold text-slate tracking-wider">EXECUTION CIRCUIT</span>
          <span className="text-[10px] tabular-nums">
            {completedCount} / {totalCount || '—'} BRANCHES COMPLETED ({totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0}%)
          </span>
        </div>

        <div className="h-1.5 w-full bg-linen flex overflow-hidden">
          {totalCount === 0 || tasks.length === 0 ? (
            <div className="w-full h-full bg-hairline/50 flex items-center justify-center" />
          ) : (
            segments.map((seg) => (
              <VTooltip key={seg.label} content={`${seg.label}: ${seg.count} (${seg.pct.toFixed(1)}%) — Click to filter`}>
                <button
                  onClick={() => onFilterByStatus?.(seg.filter)}
                  style={{ width: `${Math.max(seg.pct, 2)}%` }}
                  className={`h-full ${seg.color} transition-all duration-300 hover:opacity-80 cursor-pointer ${
                    activeStatusFilter === seg.filter ? 'ring-2 ring-slate' : ''
                  }`}
                  aria-label={`Filter by ${seg.label}: ${seg.count}`}
                />
              </VTooltip>
            ))
          )}
        </div>

        {/* Minimal dot legend */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 font-mono text-[10px] text-steel pt-0.5">
          <button
            onClick={() => onFilterByStatus?.('ALL')}
            className={`hover:text-slate transition-colors cursor-pointer ${activeStatusFilter === 'ALL' ? 'text-slate font-bold underline' : ''}`}
          >
            ALL: {tasks.length}
          </button>
          {segments.map((seg) => (
            <button
              key={seg.label}
              onClick={() => onFilterByStatus?.(seg.filter)}
              className={`flex items-center gap-1.5 hover:text-slate transition-colors cursor-pointer ${
                activeStatusFilter === seg.filter ? 'text-slate font-bold underline' : ''
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${seg.color}`} />
              <span>{seg.label}: <strong className="tabular-nums font-mono text-slate">{seg.count}</strong></span>
            </button>
          ))}
        </div>
      </div>

      {/* 4. Swiss Telemetry Row (Open, clean vertical hairline dividers, no outer box) */}
      <div className="grid grid-cols-2 md:grid-cols-5 divide-y md:divide-y-0 md:divide-x divide-hairline hairline-bottom">
        {/* 1.01 TOTAL BRANCHES */}
        <div className="py-5 pr-4 md:py-6 md:pr-6 md:pl-0 flex flex-col justify-between">
          <div>
            <div className="text-xs font-mono text-steel mb-1">1.01</div>
            <div className="text-xs font-semibold uppercase tracking-[0.02em] text-slate mb-2">
              TOTAL BRANCHES
            </div>
          </div>
          <div>
            <div className="font-mono text-2xl md:text-3xl font-bold text-slate tabular-nums leading-none">
              {completedCount} <span className="text-steel text-sm font-normal">/ {totalCount || '—'}</span>
            </div>
            <div className="text-[10px] font-mono text-steel mt-2 uppercase truncate">
              {totalCount > 0 ? `${Math.round((completedCount / totalCount) * 100)}% COVERAGE` : 'STANDBY'}
            </div>
          </div>
        </div>

        {/* 1.02 BREAKTHROUGHS */}
        <div className="p-4 md:p-6 flex flex-col justify-between">
          <div>
            <div className="text-xs font-mono text-steel mb-1">1.02</div>
            <div className="text-xs font-semibold uppercase tracking-[0.02em] text-slate mb-2">
              BREAKTHROUGHS
            </div>
          </div>
          <div>
            <div className={`font-mono text-2xl md:text-3xl font-bold tabular-nums leading-none flex items-center gap-1.5 ${
              breakthroughCount > 0 ? 'text-maroon' : 'text-slate'
            }`}>
              {breakthroughCount > 0 && <span className="text-sm">◆</span>}
              {breakthroughCount}
            </div>
            <div className="text-[10px] font-mono text-steel mt-2 uppercase truncate">
              {completedCount > 0 ? `${((breakthroughCount / completedCount) * 100).toFixed(1)}% BYPASS RATE` : '0% OBSERVED'}
            </div>
          </div>
        </div>

        {/* 1.03 DEFENDED VECTORS */}
        <div className="p-4 md:p-6 flex flex-col justify-between">
          <div>
            <div className="text-xs font-mono text-steel mb-1">1.03</div>
            <div className="text-xs font-semibold uppercase tracking-[0.02em] text-slate mb-2">
              DEFENDED VECTORS
            </div>
          </div>
          <div>
            <div className={`font-mono text-2xl md:text-3xl font-bold tabular-nums leading-none flex items-center gap-1.5 ${
              defendedCount > 0 ? 'text-olive' : 'text-slate'
            }`}>
              {defendedCount > 0 && <span className="text-sm">✓</span>}
              {defendedCount}
            </div>
            <div className="text-[10px] font-mono text-steel mt-2 uppercase truncate">
              {completedCount > 0 ? `${((defendedCount / completedCount) * 100).toFixed(1)}% RESISTANCE` : '100% DEFENDED'}
            </div>
          </div>
        </div>

        {/* 1.04 MEAN RISK SCORE */}
        <div className="p-4 md:p-6 flex flex-col justify-between">
          <div>
            <div className="text-xs font-mono text-steel mb-1">1.04</div>
            <div className="text-xs font-semibold uppercase tracking-[0.02em] text-slate mb-2">
              MEAN RISK SCORE
            </div>
          </div>
          <div>
            <div className={`font-mono text-2xl md:text-3xl font-bold tabular-nums leading-none ${
              runStats.avg_risk_score >= 0.7 ? 'text-maroon' : runStats.avg_risk_score >= 0.4 ? 'text-camel' : 'text-slate'
            }`}>
              {runStats.avg_risk_score.toFixed(2)}
            </div>
            <div className="text-[10px] font-mono text-steel mt-2 uppercase truncate">
              {runStats.avg_risk_score >= 0.7 ? 'CRITICAL RISK' : runStats.avg_risk_score >= 0.4 ? 'ELEVATED RISK' : 'NOMINAL RESILIENCE'}
            </div>
          </div>
        </div>

        {/* 1.05 RUN DURATION */}
        <div className="py-5 pl-4 md:py-6 md:pl-6 flex flex-col justify-between max-md:col-span-2">
          <div>
            <div className="text-xs font-mono text-steel mb-1">1.05</div>
            <div className="text-xs font-semibold uppercase tracking-[0.02em] text-slate mb-2">
              RUN DURATION
            </div>
          </div>
          <div>
            <div className="font-mono text-2xl md:text-3xl font-bold text-slate tabular-nums leading-none">
              {elapsedDisplay}
            </div>
            <div className="text-[10px] font-mono text-steel mt-2 uppercase flex items-center gap-1.5 truncate">
              <span className={`w-1.5 h-1.5 rounded-full ${runStats.status === 'running' ? 'bg-olive animate-pulse' : 'bg-steel/40'}`} />
              {runStats.status === 'running' ? 'STREAM BUS ACTIVE' : runStats.status.toUpperCase()}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
