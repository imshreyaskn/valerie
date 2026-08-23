import type { ForensicCaseItem, Disposition } from '../types/domain';
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

export function saveCases(cases: ForensicCaseItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cases));
  } catch (e) {
    console.warn('Failed to save investigation cases to localStorage:', e);
  }
}

function commit(next: ForensicCaseItem[]): ForensicCaseItem[] {
  saveCases(next);
  window.dispatchEvent(new Event('valerie-investigation-cases-changed'));
  return next;
}

/**
 * Converts a backend Finding into a board-ready forensic case.
 * Shared by the Findings pin action and any future pin surface so the
 * InvestigationBoard can never end up data-orphaned.
 */
export function pinFindingAsCase(finding: Finding): ForensicCaseItem[] {
  const now = new Date().toISOString();
  const existing = getInvestigationCases();
  if (existing.some((c) => c.id === finding.id)) return existing;

  const evidence = Array.isArray(finding.evidence) ? finding.evidence : [];

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
    adversarialPrompt: String(evidence[0]?.payload?.tokens ?? ''),
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

  return commit([caseItem, ...existing]);
}

export function unpinCase(caseId: string): ForensicCaseItem[] {
  return commit(getInvestigationCases().filter((c) => c.id !== caseId));
}

export function removeCase(caseId: string): ForensicCaseItem[] {
  return unpinCase(caseId);
}

export function updateCaseNotes(caseId: string, notes: string): ForensicCaseItem[] {
  const next = getInvestigationCases().map((c) =>
    c.id === caseId ? { ...c, analystNotes: notes, updatedAt: new Date().toISOString() } : c
  );
  return commit(next);
}

export function setCaseDisposition(caseId: string, disposition: Disposition): ForensicCaseItem[] {
  const next = getInvestigationCases().map((c) =>
    c.id === caseId ? { ...c, disposition, updatedAt: new Date().toISOString() } : c
  );
  return commit(next);
}
