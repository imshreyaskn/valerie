import { useEffect, useState, useMemo, useCallback } from 'react';
import { usePipelineStore } from '../stores/pipelineStore';
import { useWorkspaceStore } from '../stores/workspaceStore';
import { useRunStream } from '../hooks/useRunStream';
import { CommandBar, InstrumentCluster, ExecutionCircuit } from '../components/mission-control/CommandBar';
import type { FilterState } from '../components/mission-control/MissionControlFilters';
import { SpecimenLedger } from '../components/mission-control/SpecimenLedger';
import { IntelligenceFeed } from '../components/IntelligenceFeed';
import { PromptDiffModal } from '../components/PromptDiffModal';
import { HERO_ASCII_ART } from '../constants/ascii';

export default function Overview() {
  const { setActiveRun, activeRunId } = usePipelineStore();
  const openInspector  = useWorkspaceStore(s => s.openInspector);
  const selectedEntity = useWorkspaceStore(s => s.selectedEntity);

  useRunStream(activeRunId || 'all');

  useEffect(() => {
    if (!activeRunId) setActiveRun('all');
  }, [activeRunId, setActiveRun]);

  const liveTasks  = usePipelineStore(s => s.liveTasks);
  const tasksArray = useMemo(() => Object.values(liveTasks), [liveTasks]);

  const [diffTaskId, setDiffTaskId] = useState<string | null>(null);
  const [viewMode, setViewMode]     = useState<'table' | 'grid'>('table');

  const [filters, setFilters] = useState<FilterState>({
    status: 'ALL', technique: 'ALL', harmType: 'ALL', minRisk: 0, searchQuery: '',
  });

  const handleFilterChange  = useCallback((f: Partial<FilterState>) => setFilters(p => ({ ...p, ...f })), []);
  const handleResetFilters  = useCallback(() => setFilters({ status: 'ALL', technique: 'ALL', harmType: 'ALL', minRisk: 0, searchQuery: '' }), []);

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

  const filteredTasks = useMemo(() => tasksArray.filter(task => {
    if (filters.status !== 'ALL') {
      if (filters.status === 'BREAKTHROUGH' && !task.is_breakthrough && task.status !== 'breakthrough') return false;
      if (filters.status === 'DEFENDED' && task.status !== 'defended' && (task.status !== 'completed' || task.is_breakthrough)) return false;
      if (filters.status === 'ACTIVE' && !['mutating', 'transmitting', 'scoring'].includes(task.status)) return false;
      if (filters.status === 'QUEUED' && task.status !== 'queued') return false;
      if (filters.status === 'UNRESOLVED' && task.status !== 'unresolved' && task.status !== 'failed') return false;
    }
    if (filters.technique !== 'ALL' && task.technique !== filters.technique) return false;
    if (filters.harmType !== 'ALL' && task.harm_type !== filters.harmType) return false;
    if (filters.minRisk > 0 && (task.risk_score || 0) < filters.minRisk) return false;
    if (filters.searchQuery.trim()) {
      const q = filters.searchQuery.toLowerCase();
      if (![task.prompt, task.adversarial_prompt, task.task_id, task.technique, task.harm_type].some(v => v?.toLowerCase().includes(q))) return false;
    }
    return true;
  }), [tasksArray, filters]);

  const selectedTaskId = selectedEntity?.type === 'task' ? selectedEntity.id : null;
  const handleSelectTask = useCallback((id: string) => openInspector({ type: 'task', id }), [openInspector]);
  const hasActiveFilters = filters.status !== 'ALL' || filters.technique !== 'ALL' || filters.harmType !== 'ALL' || filters.minRisk > 0 || filters.searchQuery.trim() !== '';

  return (
    // Full-viewport two-pane layout — no scrolling at this level
    <div className="flex flex-col h-full min-h-0 animate-fade-in w-full">

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

      {/* ── Unified Command Bar (title + scope + search + filters) ── */}
      <CommandBar
        filters={filters}
        onFilterChange={handleFilterChange}
        onResetFilters={handleResetFilters}
        counts={counts}
        availableTechniques={availableTechniques}
        availableHarmTypes={availableHarmTypes}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />

      {/* ── Instrument Cluster ── */}
      <InstrumentCluster />

      {/* ── Execution Circuit ── */}
      <ExecutionCircuit
        onFilterByStatus={status => handleFilterChange({ status })}
        activeStatusFilter={filters.status}
      />

      {/* ── Main split-pane: Ledger (left) + Intel Feed (right) ── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* Ledger — scrollable independently */}
        <div className="flex-1 min-w-0 overflow-y-auto" aria-label="Forensic Specimen Ledger">
          <SpecimenLedger
            tasks={filteredTasks}
            selectedTaskId={selectedTaskId}
            onSelectTask={handleSelectTask}
            onOpenDiff={id => setDiffTaskId(id)}
            viewMode={viewMode}
            hasActiveFilters={hasActiveFilters}
            onResetFilters={handleResetFilters}
          />
        </div>

        {/* Intelligence Feed — fixed-width right panel, scrolls independently */}
        <div className="hidden xl:flex xl:w-80 shrink-0 flex-col min-h-0">
          <IntelligenceFeed />
        </div>
      </div>

      {/* Prompt evolution diff modal */}
      {diffTaskId && (
        <PromptDiffModal
          runId={activeRunId || 'all'}
          taskId={diffTaskId}
          open={!!diffTaskId}
          onOpenChange={open => !open && setDiffTaskId(null)}
        />
      )}
    </div>
  );
}
