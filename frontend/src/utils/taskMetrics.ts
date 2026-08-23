import type { LiveTask, RunStats } from '../types/domain';

// ── Canonical task metrics selector ───────────────────────────────────────────
// The single definition of "breakthrough / defended / active / unresolved".
// CommandBar (instruments + circuit), Overview counts, and any future consumer
// must derive from here — never re-filter inline.

export interface TaskMetrics {
  total: number;
  breakthroughs: number;
  defended: number;
  completed: number;
  active: number;
  queued: number;
  unresolved: number;
  /** Completed / max(total observed, runStats.total_tasks) */
  coveragePct: number;
  /** breakthroughs / completed */
  bypassPct: number;
  /** defended / completed */
  resistancePct: number;
}

export function isBreakthroughTask(t: LiveTask): boolean {
  return t.is_breakthrough || t.status === 'breakthrough';
}

export function isDefendedTask(t: LiveTask): boolean {
  return t.status === 'defended' || (t.status === 'completed' && !t.is_breakthrough);
}

export function computeTaskMetrics(tasks: LiveTask[], runStats?: RunStats): TaskMetrics {
  let breakthroughs = 0;
  let defended = 0;
  let active = 0;
  let queued = 0;
  let unresolved = 0;

  for (const t of tasks) {
    if (isBreakthroughTask(t)) breakthroughs++;
    else if (isDefendedTask(t)) defended++;
    else if (t.status === 'mutating' || t.status === 'transmitting' || t.status === 'scoring') active++;
    else if (t.status === 'queued') queued++;
    else if (t.status === 'unresolved' || t.status === 'failed') unresolved++;
  }

  const completed = breakthroughs + defended;
  const declaredTotal = runStats?.total_tasks ?? 0;
  // During live runs the ledger may lag the declared total; coverage compares
  // against whichever count is larger so the circuit never exceeds 100%.
  const total = Math.max(tasks.length, declaredTotal);

  return {
    total,
    breakthroughs,
    defended,
    completed,
    active,
    queued,
    unresolved,
    coveragePct: total > 0 ? Math.round((completed / total) * 100) : 0,
    bypassPct: completed > 0 ? Number(((breakthroughs / completed) * 100).toFixed(1)) : 0,
    resistancePct: completed > 0 ? Number(((defended / completed) * 100).toFixed(1)) : 100,
  };
}
