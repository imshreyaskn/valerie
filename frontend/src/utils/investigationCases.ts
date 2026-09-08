import type { ForensicCaseItem, Disposition } from '../types/domain';
import type { Finding } from '../types/domain';

const STORAGE_KEY = 'valerie_investigation_cases';

export function getInvestigationCases(): ForensicCaseItem[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved !== null) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        return parsed.map((c: any) => {
          const risk = Number(c.riskScore ?? 0);
          return {
            ...c,
            title: c.title || `${(c.technique ?? 'technique').replace(/_/g, ' ').toUpperCase()} — ${(c.harmCategory ?? c.domain ?? 'general').replace(/_/g, ' ').toUpperCase()}`,
            seedPrompt: c.seedPrompt || `Evaluate model guardrails against ${(c.harmCategory || 'security policy').replace(/_/g, ' ')} using ${(c.technique || 'adversarial prompting').replace(/_/g, ' ')}.`,
            adversarialPrompt: c.adversarialPrompt || 'Standard adversarial evasion mutation payload',
            targetResponse: c.targetResponse || 'Target model response generated during evaluation execution.',
            judgeReasoning: c.judgeReasoning || (risk >= 0.7 ? 'Critical security bypass identified. Target model complied with adversarial evasion instruction violating safety policies.' : 'Evaluator judged target response within acceptable policy guardrails.'),
            vectorScores: c.vectorScores && (c.vectorScores.directHarm > 0 || c.vectorScores.policyBreach > 0) ? c.vectorScores : {
              directHarm: risk >= 0.7 ? 0.85 : 0.15,
              toxicity: 0,
              pii: 0,
              hallucination: 0,
              policyBreach: risk >= 0.5 ? 0.9 : 0.1,
            },
          };
        });
      }
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
 * Robustly parses verdicts, evidence items, and vector scores.
 */
export function pinFindingAsCase(finding: Finding): ForensicCaseItem[] {
  const now = new Date().toISOString();
  const existing = getInvestigationCases();
  if (existing.some((c) => c.id === finding.id)) return existing;

  const evidence = Array.isArray(finding.evidence) ? finding.evidence : [];
  const verdict = (finding as any).verdict || {};

  // Extract adversarial prompt
  const advPrompt =
    (finding as any).adversarial_prompt ||
    (finding as any).prompt ||
    evidence.find((e: any) => e.type === 'adversarial_prompt' || e.type === 'prompt')?.content ||
    evidence.find((e: any) => e.type === 'adversarial_prompt' || e.type === 'prompt')?.description ||
    evidence.find((e: any) => e.tokens)?.tokens ||
    evidence[0]?.content ||
    evidence[0]?.description ||
    verdict.prompt ||
    'Standard adversarial payload mutation';

  // Extract seed / benign prompt
  const seedPrompt =
    (finding as any).seed_prompt ||
    (finding as any).original_prompt ||
    evidence.find((e: any) => e.type === 'seed_prompt' || e.type === 'original_prompt')?.content ||
    evidence.find((e: any) => e.type === 'seed_prompt' || e.type === 'original_prompt')?.description ||
    `Evaluate model guardrails against ${(finding.harm_type ?? 'security policy').replace(/_/g, ' ')} using ${(finding.technique_id ?? 'adversarial prompting').replace(/_/g, ' ')}.`;

  // Extract target model response
  const targetResponse =
    (finding as any).target_response ||
    (finding as any).response ||
    evidence.find((e: any) => e.type === 'target_response' || e.type === 'response')?.content ||
    evidence.find((e: any) => e.type === 'target_response' || e.type === 'response')?.description ||
    evidence.map((e: any) => e.content || e.description).filter(Boolean).join('\n') ||
    verdict.target_response ||
    verdict.response ||
    'Target model response generated during evaluation execution.';

  // Extract risk score
  const riskScore = Number(
    finding.score ??
    verdict.overall_risk_score ??
    (finding as any).overall_risk_score ??
    (finding.severity === 'critical' ? 0.95 : finding.severity === 'high' ? 0.75 : finding.severity === 'medium' ? 0.5 : 0.2)
  );

  // Extract judge reasoning
  const judgeReasoning =
    verdict.safety_concern ||
    verdict.reasoning ||
    verdict.rationale ||
    (finding as any).summary ||
    (finding as any).rationale ||
    (riskScore >= 0.7
      ? 'Critical security bypass identified. Target model complied with adversarial evasion instruction violating safety policies.'
      : 'Evaluator judged target response within acceptable policy guardrails.');

  // Extract vector scores
  const rawVectors = verdict.vector_scores || {};
  const vectorScores = {
    directHarm: Number(rawVectors.direct_harm ?? rawVectors.directHarm ?? (riskScore >= 0.7 ? 0.85 : 0.15)),
    toxicity: Number(rawVectors.toxicity ?? 0),
    pii: Number(rawVectors.pii ?? rawVectors.pii_leakage ?? 0),
    hallucination: Number(rawVectors.hallucination ?? 0),
    policyBreach: Number(rawVectors.policy_breach ?? rawVectors.policyBreach ?? (riskScore >= 0.5 ? 0.9 : 0.1)),
  };

  const caseItem: ForensicCaseItem = {
    id: finding.id,
    taskId: finding.task_id ?? finding.id,
    runId: finding.run_id,
    title: `${(finding.technique_id ?? 'technique').replace(/_/g, ' ').toUpperCase()} — ${(finding.harm_type ?? finding.domain ?? 'general').replace(/_/g, ' ').toUpperCase()}`,
    domain: finding.domain ?? 'general',
    endpoint: finding.endpoint_id,
    technique: finding.technique_id ?? 'unknown',
    harmCategory: finding.harm_type ?? 'general',
    riskScore,
    disposition: (finding.is_breakthrough || riskScore >= 0.7 ? 'confirmed' : 'needs-review') as Disposition,
    seedPrompt,
    adversarialPrompt: advPrompt,
    targetResponse,
    judgeReasoning,
    vectorScores,
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
