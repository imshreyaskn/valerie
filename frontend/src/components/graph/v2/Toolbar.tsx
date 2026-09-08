/**
 * v2/Toolbar.tsx
 * Unified Campaign Graph Navigation & Command Bar.
 * Combines search, filter segments, mutation expansion controls, and viewport controls
 * with the Swiss Old Money aesthetic.
 */
import { memo, useRef } from 'react';
import { useGraphStore } from './store/graphStore';
import { usePipelineStore } from '../../../stores/pipelineStore';
import type { StatusFilter } from '../../../types/filters';
import { hasActiveFilters } from '../../../types/filters';
import { useReactFlow } from '@xyflow/react';
import {
  Search,
  X,
  Maximize2,
  RotateCcw,
  UnfoldVertical,
  FoldVertical,
} from 'lucide-react';

interface Props {
  onFitView?: () => void;
}

const STATUS_FILTERS: { label: string; value: StatusFilter }[] = [
  { label: 'ALL', value: 'ALL' },
  { label: 'BREACHES', value: 'BREAKTHROUGH' },
  { label: 'DEFENDED', value: 'DEFENDED' },
  { label: 'ACTIVE', value: 'ACTIVE' },
  { label: 'QUEUED', value: 'QUEUED' },
];

export const Toolbar = memo(function Toolbar({ onFitView }: Props) {
  const filters = useGraphStore((s) => s.filters);
  const setFilters = useGraphStore((s) => s.setFilters);
  const resetFilters = useGraphStore((s) => s.resetFilters);

  const expandedTaskIds = useGraphStore((s) => s.expandedTaskIds);
  const expandAllTasks = useGraphStore((s) => s.expandAllTasks);
  const collapseAll = useGraphStore((s) => s.collapseAll);

  const liveTasks = usePipelineStore((s) => s.liveTasks);
  const streamHealth = usePipelineStore((s) => s.streamHealth);
  const { fitView } = useReactFlow();

  const searchInputRef = useRef<HTMLInputElement>(null);
  const allTaskIds = Object.keys(liveTasks);
  const allExpanded = allTaskIds.length > 0 && expandedTaskIds.length >= allTaskIds.length;
  const isFiltering = hasActiveFilters(filters);

  const handleToggleExpandAll = () => {
    if (allExpanded) {
      collapseAll();
    } else {
      expandAllTasks(allTaskIds);
    }
  };

  const handleFit = () => {
    if (onFitView) {
      onFitView();
    } else {
      fitView({ duration: 300, padding: 0.15 });
    }
  };

  return (
    <div className="absolute top-3 left-3 right-3 z-20 flex flex-wrap items-center justify-between gap-2 p-1.5 bg-ivory/95 backdrop-blur-md border border-hairline shadow-sm pointer-events-auto">
      {/* Left: Search & Scope */}
      <div className="flex items-center gap-2">
        {/* Stream Health Indicator */}
        <div className="flex items-center gap-1.5 px-2 py-1 bg-parchment border border-hairline font-mono text-[10px] font-bold text-slate">
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              streamHealth === 'connected'
                ? 'bg-olive'
                : streamHealth === 'connecting'
                ? 'bg-camel animate-pulse'
                : 'bg-taupe'
            }`}
          />
          <span className="uppercase tracking-wider">
            {streamHealth === 'connected' ? 'LIVE STREAM' : streamHealth.toUpperCase()}
          </span>
        </div>

        {/* Search Input */}
        <div className="relative flex items-center">
          <Search size={12} className="absolute left-2 text-steel pointer-events-none" />
          <input
            ref={searchInputRef}
            type="text"
            value={filters.searchQuery}
            onChange={(e) => setFilters({ searchQuery: e.target.value })}
            placeholder="SEARCH SPECIMENS / PROMPTS..."
            className="w-48 sm:w-60 h-7 pl-6 pr-6 bg-parchment border border-hairline font-mono text-[10px] uppercase text-slate placeholder:text-taupe focus:outline-hidden focus:border-slate"
          />
          {filters.searchQuery && (
            <button
              type="button"
              onClick={() => setFilters({ searchQuery: '' })}
              className="absolute right-2 text-steel hover:text-slate cursor-pointer"
            >
              <X size={11} />
            </button>
          )}
        </div>
      </div>

      {/* Center: Status Filter Pills */}
      <div className="flex items-center gap-1">
        {STATUS_FILTERS.map(({ label, value }) => {
          const isActive = filters.status === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => setFilters({ status: value })}
              className={`h-7 px-2.5 font-mono text-[9px] font-bold uppercase tracking-wider transition-colors cursor-pointer border ${
                isActive
                  ? 'bg-slate text-parchment border-slate'
                  : 'bg-parchment text-steel border-hairline hover:border-steel hover:text-slate'
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Right: Actions (Expand/Collapse, Reset, Fit View) */}
      <div className="flex items-center gap-1.5">
        {/* Toggle Expand / Collapse All Chains */}
        <button
          type="button"
          onClick={handleToggleExpandAll}
          className="flex items-center gap-1 h-7 px-2.5 bg-parchment border border-hairline hover:border-steel text-slate font-mono text-[9px] font-bold uppercase tracking-wider transition-colors cursor-pointer"
          title={allExpanded ? 'Collapse all mutation chains' : 'Expand all mutation chains'}
        >
          {allExpanded ? (
            <>
              <FoldVertical size={12} className="text-steel" />
              <span>COLLAPSE ALL</span>
            </>
          ) : (
            <>
              <UnfoldVertical size={12} className="text-steel" />
              <span>EXPAND ALL</span>
            </>
          )}
        </button>

        {/* Clear Filters (if active) */}
        {isFiltering && (
          <button
            type="button"
            onClick={resetFilters}
            className="flex items-center gap-1 h-7 px-2 bg-maroon-muted border border-maroon/30 text-maroon font-mono text-[9px] font-bold uppercase tracking-wider hover:bg-maroon hover:text-parchment transition-colors cursor-pointer"
            title="Reset active filters"
          >
            <RotateCcw size={11} />
            <span>RESET</span>
          </button>
        )}

        {/* Fit Viewport Button */}
        <button
          type="button"
          onClick={handleFit}
          className="flex items-center justify-center w-7 h-7 bg-parchment border border-hairline hover:border-slate text-slate transition-colors cursor-pointer"
          title="Fit view to all nodes"
        >
          <Maximize2 size={12} />
        </button>
      </div>
    </div>
  );
});
