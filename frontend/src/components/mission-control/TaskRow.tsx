import { memo } from 'react';
import { ChevronRight, GitCompare } from 'lucide-react';
import type { LiveTask } from '../../types/domain';
import { TaskStateBadge } from './TaskStateBadge';
import { VTooltip } from '../ui';

interface TaskRowProps {
  task: LiveTask;
  index: number;
  isSelected: boolean;
  density: 'comfortable' | 'compact' | 'research';
  onClick: () => void;
  /** Opens the prompt-evolution lineage diff for this task. */
  onOpenDiff?: () => void;
}

export const TaskRow = memo<TaskRowProps>(
  ({
    task,
    index,
    isSelected,
    density,
    onClick,
    onOpenDiff,
  }) => {
    const indexStr = String(index + 1).padStart(2, '0');

    const getRiskScoreColor = () => {
      if (task.is_breakthrough || task.risk_score >= 0.7) return 'text-maroon';
      if (task.risk_score >= 0.4) return 'text-camel';
      return 'text-slate';
    };

    const padClass =
      density === 'research'
        ? 'py-1.5 px-2 text-xs'
        : density === 'compact'
        ? 'py-2.5 px-3 text-xs'
        : 'py-3.5 px-4 text-xs';

    return (
      <div
        onClick={onClick}
        className={`grid grid-cols-1 md:grid-cols-[50px_160px_1fr_130px_80px_80px_35px] items-center p-0 hairline-bottom transition-all duration-150 cursor-pointer group select-none ${
          isSelected
            ? 'bg-cream/80 border-l-4 border-l-slate shadow-2xs'
            : 'hover:bg-linen/70 bg-ivory hover:translate-x-[1px]'
        }`}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick();
          }
        }}
        aria-selected={isSelected}
        aria-label={`Task ${task.task_id}: ${task.harm_type}, technique ${task.technique}, risk ${task.risk_score.toFixed(2)}, status ${task.status}`}
      >
        {/* 1. Index */}
        <div className={`${padClass} font-mono text-steel md:hairline-right select-none flex items-center justify-between`}>
          <span>{indexStr}</span>
          {task.is_breakthrough && (
            <span className="w-1.5 h-1.5 rounded-full bg-maroon md:hidden" title="Breakthrough" />
          )}
        </div>

        {/* 2. Harm Category & Attack Technique */}
        <div className={`${padClass} md:hairline-right min-w-0 font-mono`}>
          <p className="text-[11px] font-bold text-slate truncate uppercase tracking-tight">
            {task.harm_type.replace(/_/g, ' ')}
          </p>
          <p className="text-[10px] text-steel truncate uppercase mt-0.5">
            {task.technique.replace(/_/g, ' ')}
          </p>
        </div>

        {/* 3. Prompts Specimen (Seed & Mutated) */}
        <div className={`${padClass} md:hairline-right min-w-0 font-mono text-[11px] space-y-1`}>
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-[9px] font-bold text-taupe uppercase shrink-0 select-none bg-linen px-1 py-0.2 border border-hairline">
              SEED
            </span>
            <VTooltip content={task.prompt || 'No seed prompt available'}>
              <p className="text-steel truncate cursor-help flex-1">
                {task.prompt || '—'}
              </p>
            </VTooltip>
          </div>

          <div className="flex items-center gap-1.5 min-w-0">
            <span className={`text-[9px] font-bold uppercase shrink-0 select-none px-1 py-0.2 border ${
              task.is_breakthrough
                ? 'bg-maroon text-parchment border-maroon'
                : 'bg-linen text-slate border-hairline'
            }`}>
              MUTATION
            </span>
            <VTooltip content={task.adversarial_prompt || task.prompt || 'Awaiting mutation generation'}>
              <p className={`truncate cursor-help flex-1 font-medium ${
                task.is_breakthrough ? 'text-maroon font-semibold' : 'text-slate'
              }`}>
                {task.adversarial_prompt || task.prompt || '—'}
              </p>
            </VTooltip>
          </div>
        </div>

        {/* 4. Task State Machine Badge */}
        <div className={`${padClass} md:hairline-right flex items-center justify-start md:justify-center`}>
          <TaskStateBadge
            status={task.status}
            isBreakthrough={task.is_breakthrough}
            pulse={task.status === 'mutating' || task.status === 'scoring'}
          />
        </div>

        {/* 5. Iterations Counter */}
        <div className={`${padClass} md:hairline-right font-mono text-center select-none`}>
          <span className="text-slate font-semibold">{task.iterations || 1}</span>
          <span className="text-[9px] text-taupe block uppercase">
            / {task.max_iterations ?? 3}
          </span>
        </div>

        {/* 6. Measured Risk Score (harmonic judge aggregate) */}
        <div className={`${padClass} md:hairline-right font-mono text-right tabular-nums select-none`}>
          <span className={`font-bold text-sm ${getRiskScoreColor()}`}>
            {task.risk_score.toFixed(2)}
          </span>
        </div>

        {/* 7. Action & Chevron */}
        <div className="h-full px-2 flex items-center justify-center gap-1 text-steel group-hover:text-slate">
          {onOpenDiff && (
            <VTooltip content="Open evolution lineage diff">
              <button
                onClick={(e) => { e.stopPropagation(); onOpenDiff(); }}
                className="p-0.5 hover:text-maroon transition-colors cursor-pointer"
                aria-label={`Open lineage diff for task ${task.task_id}`}
              >
                <GitCompare size={13} />
              </button>
            </VTooltip>
          )}
          <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
        </div>
      </div>
    );
  },
  (prev, next) =>
    prev.task === next.task &&
    prev.isSelected === next.isSelected &&
    prev.density === next.density &&
    prev.index === next.index
);

TaskRow.displayName = 'TaskRow';
