import { useEffect, useState, useMemo, useCallback } from 'react';
import { usePipelineStore } from '../stores/pipelineStore';
import { useWorkspaceStore } from '../stores/workspaceStore';
import { useRunStream } from '../hooks/useRunStream';
import { CommandBar, InstrumentCluster, ExecutionCircuit } from '../components/mission-control/CommandBar';
import type { FilterState } from '../types/filters';
import { DEFAULT_FILTERS, matchesFilters, hasActiveFilters as filtersActive } from '../types/filters';
import { SpecimenLedger } from '../components/mission-control/SpecimenLedger';
import { IntelligenceFeed } from '../components/IntelligenceFeed';
import { HERO_ASCII_ART } from '../constants/ascii';
import { AlertTriangle, X } from 'lucide-react';

export default function Overview() {
  const { setActiveRun, activeRunId } = usePipelineStore();
  const openInspector  = useWorkspaceStore(s => s.openInspector);
  const openPromptDiff = useWorkspaceStore(s => s.openPromptDiff);
  const selectedEntity = useWorkspaceStore(s => s.selectedEntity);

  useRunStream(activeRunId || 'all');

  useEffect(() => {
    if (!activeRunId) setActiveRun('all');
  }, [activeRunId, setActiveRun]);

  const liveTasks  = usePipelineStore(s => s.liveTasks);
  const feedCount  = usePipelineStore(s => s.intelligenceFeed.length);
  const tasksArray = useMemo(() => Object.values(liveTasks), [liveTasks]);

  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  // Compact-viewports intel drawer: the fixed right rail is lg+; below that
  // alerts remain reachable instead of silently hidden.
  const [mobileFeedOpen, setMobileFeedOpen] = useState(false);

  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);

  const handleFilterChange  = useCallback((f: Partial<FilterState>) => setFilters(p => ({ ...p, ...f })), []);
  const handleResetFilters  = useCallback(() => setFilters(DEFAULT_FILTERS), []);

  const filteredTasks = useMemo(
    () => tasksArray.filter(task => matchesFilters(task, filters)),
    [tasksArray, filters]
  );

  const selectedTaskId = selectedEntity?.type === 'task' ? selectedEntity.id : null;
  const handleSelectTask = useCallback((id: string) => openInspector({ type: 'task', id }), [openInspector]);
  const hasActiveFilters = filtersActive(filters);

  return (
    // Full-viewport two-pane layout — no scrolling at this level
    <div className="flex flex-col h-full min-h-0 animate-fade-in w-full relative">

      {/* ── Valerie ASCII Specimen Logo Header ── */}
      <div className="w-full flex items-center justify-center py-6 mb-4 select-none overflow-hidden shrink-0">
        <pre
          className="font-mono font-black text-slate whitespace-pre overflow-hidden select-none text-[0.24rem] sm:text-[0.30rem] md:text-[0.36rem]"
          style={{ WebkitTextStroke: '0.4px var(--color-slate)', lineHeight: '1.08' }}
          aria-hidden="true"
        >
          {HERO_ASCII_ART}
        </pre>
      </div>

      {/* ── Unified Command Bar (title + scope + search + launch + filters) ── */}
      <CommandBar
        filters={filters}
        onFilterChange={handleFilterChange}
        onResetFilters={handleResetFilters}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />

      {/* ── Instrument Cluster ── */}
      <InstrumentCluster />

      {/* ── Execution Circuit ── */}
      <ExecutionCircuit
        onFilterByStatus={status => handleFilterChange({ status: status as FilterState['status'] })}
        activeStatusFilter={filters.status}
      />

      {/* ── Compact-viewport intel trigger (rail is lg+) ── */}
      {feedCount > 0 && (
        <button
          onClick={() => setMobileFeedOpen(true)}
          className="lg:hidden flex items-center gap-2 px-3 py-2 hairline-bottom bg-camel-muted text-camel font-mono text-[10px] font-bold uppercase tracking-wider cursor-pointer shrink-0"
        >
          <AlertTriangle size={12} />
          {feedCount} INTEL ALERT{feedCount === 1 ? '' : 'S'} — VIEW FEED
        </button>
      )}

      {/* ── Main split-pane: Ledger (left) + Intel Feed (right) ── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* Ledger — scrollable independently */}
        <div className="flex-1 min-w-0 overflow-y-auto" aria-label="Forensic Specimen Ledger">
          <SpecimenLedger
            tasks={filteredTasks}
            selectedTaskId={selectedTaskId}
            onSelectTask={handleSelectTask}
            onOpenDiff={(taskId) => openPromptDiff(activeRunId || 'all', taskId)}
            viewMode={viewMode}
            hasActiveFilters={hasActiveFilters}
            onResetFilters={handleResetFilters}
          />
        </div>

        {/* Intelligence Feed — fixed-width right rail (lg+) */}
        <div className="hidden lg:flex lg:w-80 shrink-0 flex-col min-h-0">
          <IntelligenceFeed />
        </div>
      </div>

      {/* Intel drawer for compact viewports */}
      {mobileFeedOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-label="Intelligence feed">
          <div
            className="absolute inset-0 bg-slate/40 backdrop-blur-sm"
            onClick={() => setMobileFeedOpen(false)}
          />
          <div className="absolute top-0 right-0 h-full w-[22rem] max-w-[92vw] bg-parchment border-l border-hairline shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 bg-linen hairline-bottom">
              <span className="font-mono text-[10px] font-bold tracking-widest uppercase text-slate">INTELLIGENCE FEED</span>
              <button onClick={() => setMobileFeedOpen(false)} className="text-steel hover:text-slate cursor-pointer p-1" aria-label="Close intelligence feed">
                <X size={14} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto min-h-0">
              <IntelligenceFeed />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
