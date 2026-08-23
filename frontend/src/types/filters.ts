import type { LiveTask } from './domain';

// ── Canonical task filter contract ────────────────────────────────────────────
// Single source of truth for Mission Control filtering. The UI (CommandBar)
// and the predicate (matchesFilters) both live off this type so the filter
// engine can never fork again.

export type StatusFilter =
  | 'ALL'
  | 'BREAKTHROUGH'
  | 'DEFENDED'
  | 'ACTIVE'
  | 'QUEUED'
  | 'UNRESOLVED';

export interface FilterState {
  status: StatusFilter;
  technique: string;
  harmType: string;
  minRisk: number;
  searchQuery: string;
}

export const DEFAULT_FILTERS: FilterState = {
  status: 'ALL',
  technique: 'ALL',
  harmType: 'ALL',
  minRisk: 0,
  searchQuery: '',
};

const ACTIVE_STATUSES = ['mutating', 'transmitting', 'scoring'];

function matchesStatus(task: LiveTask, status: StatusFilter): boolean {
  switch (status) {
    case 'ALL':
      return true;
    case 'BREAKTHROUGH':
      return task.is_breakthrough || task.status === 'breakthrough';
    case 'DEFENDED':
      return task.status === 'defended' || (task.status === 'completed' && !task.is_breakthrough);
    case 'ACTIVE':
      return ACTIVE_STATUSES.includes(task.status);
    case 'QUEUED':
      return task.status === 'queued';
    case 'UNRESOLVED':
      return task.status === 'unresolved' || task.status === 'failed';
    default:
      return true;
  }
}

export function matchesFilters(task: LiveTask, f: FilterState): boolean {
  if (!matchesStatus(task, f.status)) return false;
  if (f.technique !== 'ALL' && task.technique !== f.technique) return false;
  if (f.harmType !== 'ALL' && task.harm_type !== f.harmType) return false;
  if (f.minRisk > 0 && (task.risk_score || 0) < f.minRisk) return false;
  if (f.searchQuery.trim()) {
    const q = f.searchQuery.toLowerCase();
    const haystacks = [task.prompt, task.adversarial_prompt, task.task_id, task.technique, task.harm_type];
    if (!haystacks.some(v => v?.toLowerCase().includes(q))) return false;
  }
  return true;
}

export function hasActiveFilters(f: FilterState): boolean {
  return (
    f.status !== 'ALL' ||
    f.technique !== 'ALL' ||
    f.harmType !== 'ALL' ||
    f.minRisk > 0 ||
    f.searchQuery.trim() !== ''
  );
}
