import React, { useState, useMemo } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown, Filter, Radio } from 'lucide-react';
import type { LiveTask } from '../../types/domain';
import { TaskRow } from './TaskRow';
import { TaskStateBadge } from './TaskStateBadge';
import { useWorkspaceStore } from '../../stores/workspaceStore';
import { usePipelineStore } from '../../stores/pipelineStore';

interface SpecimenLedgerProps {
  tasks: LiveTask[];
  selectedTaskId: string | null;
  onSelectTask: (taskId: string) => void;
  onOpenDiff?: (taskId: string) => void;
  viewMode: 'table' | 'grid';
  hasActiveFilters: boolean;
  onResetFilters: () => void;
}

type SortField = 'index' | 'risk_score' | 'last_updated' | 'technique' | 'status';
type SortOrder = 'asc' | 'desc';

export const SpecimenLedger: React.FC<SpecimenLedgerProps> = ({
  tasks,
  selectedTaskId,
  onSelectTask,
  onOpenDiff,
  viewMode,
  hasActiveFilters,
  onResetFilters,
}) => {
  const { density } = useWorkspaceStore();
  const liveTasks = usePipelineStore((s) => s.liveTasks);
  const allTasksCount = Object.keys(liveTasks).length;

  const [sortField, setSortField] = useState<SortField>('last_updated');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const sortedTasks = useMemo(() => {
    return [...tasks].sort((a, b) => {
      let comparison = 0;
      if (sortField === 'risk_score') {
        comparison = (a.risk_score || 0) - (b.risk_score || 0);
      } else if (sortField === 'last_updated') {
        comparison = (a.last_updated || '').localeCompare(b.last_updated || '');
      } else if (sortField === 'technique') {
        comparison = (a.technique || '').localeCompare(b.technique || '');
      } else if (sortField === 'status') {
        comparison = (a.status || '').localeCompare(b.status || '');
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [tasks, sortField, sortOrder]);

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown size={10} className="text-taupe opacity-40" />;
    return sortOrder === 'asc' ? (
      <ArrowUp size={10} className="text-slate font-bold" />
    ) : (
      <ArrowDown size={10} className="text-slate font-bold" />
    );
  };

  // Grid View Mode
  if (viewMode === 'grid') {
    if (tasks.length === 0) {
      return (
        <div className="w-full py-16 px-6 text-center font-mono select-none">
          {hasActiveFilters && allTasksCount > 0 ? (
            <>
              <Filter className="w-6 h-6 text-steel/50 mx-auto mb-2" strokeWidth={1.5} />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate">
                NO SPECIMENS MATCH CURRENT FILTERS
              </h3>
              <p className="text-[11px] text-taupe mt-1">
                0 of {allTasksCount} branches match your active filter criteria.
              </p>
              <button
                onClick={onResetFilters}
                className="mt-3 px-3 py-1.5 border border-hairline bg-cream text-slate text-xs font-bold uppercase hover:bg-slate hover:text-parchment transition-colors cursor-pointer"
              >
                RESET ALL FILTERS
              </button>
            </>
          ) : (
            <>
              <Radio size={20} className="text-olive animate-pulse mx-auto mb-2" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate">
                STREAM EVENT LISTENER ACTIVE
              </h3>
              <p className="text-[11px] text-steel mt-1 max-w-sm mx-auto">
                Awaiting dispatched task branches on Redis Streams. Live specimens will appear here automatically.
              </p>
            </>
          )}
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 py-4" role="region" aria-label="Specimen Grid">
        {sortedTasks.map((task, idx) => {
          const isSelected = task.task_id === selectedTaskId;
          return (
            <div
              key={task.task_id}
              onClick={() => onSelectTask(task.task_id)}
              className={`p-4 bg-ivory border transition-all cursor-pointer select-none space-y-3 ${
                isSelected
                  ? 'border-slate ring-2 ring-slate'
                  : 'border-hairline hover:border-steel/60 hover:bg-linen/20'
              }`}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelectTask(task.task_id);
                }
              }}
            >
              <div className="flex items-center justify-between font-mono text-xs">
                <span className="text-steel font-bold">#{String(idx + 1).padStart(2, '0')}</span>
                <TaskStateBadge status={task.status} isBreakthrough={task.is_breakthrough} />
              </div>

              <div>
                <p className="font-mono text-xs font-bold text-slate uppercase truncate">
                  {task.harm_type.replace(/_/g, ' ')}
                </p>
                <p className="font-mono text-[10px] text-steel uppercase truncate">
                  {task.technique.replace(/_/g, ' ')}
                </p>
              </div>

              <div className="p-2.5 bg-linen/50 border border-hairline font-mono text-[11px] space-y-1">
                <p className="text-steel truncate">
                  <span className="text-taupe uppercase text-[9px] mr-1">SEED:</span>
                  {task.prompt || '—'}
                </p>
                <p className={`truncate font-medium ${task.is_breakthrough ? 'text-maroon font-semibold' : 'text-slate'}`}>
                  <span className="text-maroon uppercase text-[9px] mr-1">MUT:</span>
                  {task.adversarial_prompt || task.prompt || '—'}
                </p>
              </div>

              <div className="flex items-center justify-between font-mono text-xs pt-1 hairline-top">
                <span className="text-taupe uppercase text-[10px]">ITER {task.iterations || 1}</span>
                <span className={`font-bold text-sm tabular-nums ${
                  task.is_breakthrough || task.risk_score >= 0.7 ? 'text-maroon' : task.risk_score >= 0.4 ? 'text-camel' : 'text-slate'
                }`}>
                  {task.risk_score.toFixed(2)} <span className="text-[10px] text-taupe font-normal uppercase">RISK</span>
                </span>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // Tabular Ledger View Mode (Canonical Landing Page Grid Structure)
  return (
    <div className="w-full select-none font-mono" role="region" aria-label="Forensic Specimen Ledger">
      {/* Table Column Headers */}
      <div className="grid grid-cols-1 md:grid-cols-[50px_160px_1fr_130px_80px_80px_35px] items-center p-0 h-12 hairline-bottom bg-linen/30 text-xs font-semibold uppercase text-steel whitespace-nowrap">
        {/* Index */}
        <button
          onClick={() => handleSort('index')}
          className="h-full px-3 md:px-4 text-left md:hairline-right hover:text-slate transition-colors flex items-center gap-1 cursor-pointer"
        >
          <span>#</span>
          {renderSortIcon('index')}
        </button>

        {/* Harm Category & Technique */}
        <button
          onClick={() => handleSort('technique')}
          className="h-full px-3 md:px-4 text-left md:hairline-right hover:text-slate transition-colors flex items-center justify-between cursor-pointer"
        >
          <span className="truncate">HARM / TECHNIQUE</span>
          {renderSortIcon('technique')}
        </button>

        {/* Prompts Specimen */}
        <div className="h-full px-3 md:px-4 text-left md:hairline-right flex items-center">
          <span className="truncate">PROMPT SPECIMEN</span>
        </div>

        {/* Status */}
        <button
          onClick={() => handleSort('status')}
          className="h-full px-3 md:px-4 text-left md:text-center md:hairline-right hover:text-slate transition-colors flex items-center justify-start md:justify-center gap-1 cursor-pointer"
        >
          <span>STATE</span>
          {renderSortIcon('status')}
        </button>

        {/* Iterations */}
        <div className="h-full px-3 md:px-4 text-center md:hairline-right flex items-center justify-center">
          <span>ITER</span>
        </div>

        {/* Risk Score */}
        <button
          onClick={() => handleSort('risk_score')}
          className="h-full px-3 md:px-4 text-right md:hairline-right hover:text-slate transition-colors flex items-center justify-end gap-1 cursor-pointer"
        >
          <span>RISK</span>
          {renderSortIcon('risk_score')}
        </button>

        {/* Action column */}
        <div className="h-full px-3 md:px-4 flex items-center justify-center text-center">
          <span className="sr-only">Inspect</span>
        </div>
      </div>

      {/* Rows Container or Clean Minimal Inline Empty State */}
      {sortedTasks.length > 0 ? (
        <div className="divide-y divide-hairline">
          {sortedTasks.map((task, idx) => (
            <TaskRow
              key={task.task_id}
              task={task}
              index={idx}
              isSelected={task.task_id === selectedTaskId}
              density={density}
              onClick={() => onSelectTask(task.task_id)}
              onOpenDiff={() => onOpenDiff?.(task.task_id)}
            />
          ))}
        </div>
      ) : hasActiveFilters && allTasksCount > 0 ? (
        <div className="py-16 px-6 text-center select-none">
          <Filter className="w-5 h-5 text-steel/60 mx-auto mb-2.5" strokeWidth={1.75} />
          <p className="text-xs font-bold text-slate uppercase tracking-wider">NO SPECIMENS MATCH CURRENT FILTERS</p>
          <p className="text-[11px] text-steel mt-1 leading-relaxed max-w-xs mx-auto">0 of {allTasksCount} branches match your active filter criteria.</p>
          <button
            onClick={onResetFilters}
            className="mt-3 px-3 py-1 bg-slate text-parchment text-xs font-bold uppercase transition-colors cursor-pointer"
          >
            RESET ALL FILTERS
          </button>
        </div>
      ) : (
        <div className="py-16 px-6 text-center select-none">
          <Radio size={20} strokeWidth={1.75} className="text-olive animate-pulse mx-auto mb-2.5" />
          <p className="text-xs font-bold text-slate uppercase tracking-wider">STREAM EVENT LISTENER ACTIVE</p>
          <p className="text-[11px] text-steel mt-1 leading-relaxed max-w-sm mx-auto">
            Awaiting dispatched task branches on Redis Streams. Live specimens will appear here automatically.
          </p>
        </div>
      )}
    </div>
  );
};
