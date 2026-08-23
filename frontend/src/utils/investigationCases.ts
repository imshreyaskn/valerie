import type { ForensicCaseItem, Disposition } from '../pages/InvestigationBoard';
import type { Finding } from '../types/domain';

const STORAGE_KEY = 'valerie_investigation_cases';

export function getInvestigationCases(): ForensicCaseItem[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved !== null) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed as ForensicCaseItem[];
    }
  } catch (e) {
    console.warn('Failed to load investigation cases from localStorage:', e);
  }
  return [];
}

function saveCases(cases: ForensicCaseItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cases));
  } catch (e) {
    console.warn('Failed to save investigation cases to localStorage:', e);
  }
}

/**
 * Converts a backend Finding into a board-ready forensic case.
 * Shared by the Findings pin action and any future pin surfaces so the
 * InvestigationBoard can never end up data-orphaned again (audit H6).
 */
export function pinFindingAsCase(finding: Finding): ForensicCaseItem[] {
  const now = new Date().toISOString();
  const existing = getInvestigationCases();
  if (existing.some((c) => c.id === finding.id)) return existing;

  const evidence = Array.isArray(finding.evidence) ? finding.evidence : [];
  const firstEvidenceText = String(evidence[0]?.payload?.tokens ?? '');

  const caseItem: ForensicCaseItem = {
    id: finding.id,
    taskId: finding.task_id ?? finding.id,
    runId: finding.run_id,
    title: `${(finding.technique_id ?? 'technique').replace(/_/g, ' ').toUpperCase()} — ${(finding.harm_type ?? 'general').replace(/_/g, ' ')}`,
    domain: finding.domain ?? 'general',
    endpoint: finding.endpoint_id,
    technique: finding.technique_id ?? 'unknown',
    harmCategory: finding.harm_type ?? 'general',
    riskScore: finding.score ?? 0,
    disposition: (finding.is_breakthrough ? 'confirmed' : 'needs-review') as Disposition,
    seedPrompt: '',
    adversarialPrompt: firstEvidenceText,
    targetResponse: evidence.map((e) => e.description).filter(Boolean).join('\n'),
    judgeReasoning: '',
    vectorScores: {
      directHarm: finding.score ?? 0,
      toxicity: 0,
      pii: 0,
      hallucination: 0,
      policyBreach: 0,
    },
    analystNotes: '',
    pinnedAt: now,
    updatedAt: now,
  };

  const next = [caseItem, ...existing];
  saveCases(next);
  return next;
}

export function unpinCase(caseId: string): ForensicCaseItem[] {
  const next = getInvestigationCases().filter((c) => c.id !== caseId);
  saveCases(next);
  return next;
}

export function updateCaseNotes(caseId: string, notes: string): ForensicCaseItem[] {
  const next = getInvestigationCases().map((c) =>
    c.id === caseId ? { ...c, analystNotes: notes, updatedAt: new Date().toISOString() } : c
  );
  saveCases(next);
  return next;
}
