/**
 * Valerie Core Domain Type Definitions
 * Strict contracts for endpoints, runs, findings, weaknesses, and telemetry.
 */

export type EndpointProvider = 'openai_compat' | 'anthropic' | 'gemini' | 'custom';

export interface Endpoint {
  id: string;
  name: string;
  provider: EndpointProvider;
  base_url: string;
  api_key?: string;
  created_at?: string;
  is_active?: boolean;
}

export interface CreateEndpointPayload {
  name: string;
  provider: EndpointProvider | string;
  base_url: string;
  api_key?: string;
}

export type RunStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface Run {
  id: string;
  domain: string;
  status: RunStatus | string;
  created_at: string;
  successful_attacks: number;
  total_tasks: number;
  avg_risk_score: number;
  endpoint_id?: string;
  attacker_model?: string;
  judge_model?: string;
}

export interface CreateRunPayload {
  domain: string;
  endpoint_id: string;
  attacker_model: string;
  judge_model: string;
  attacker_api_key?: string;
  judge_api_key?: string;
  selected_techniques: string[];
  max_iterations: number;
  risk_threshold: number;
}

export type FindingSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface EvidenceItem {
  type: string;
  description: string;
  payload?: Record<string, unknown>;
  timestamp?: string;
}

export interface Finding {
  id: string;
  run_id: string;
  endpoint_id: string;
  technique_id: string;
  harm_type?: string;
  severity: FindingSeverity;
  is_breakthrough: boolean;
  score: number;
  evidence: EvidenceItem[];
  created_at: string;
  task_id?: string;
  domain?: string;
}

export interface WeaknessCluster {
  trend?: string;
  id: string;
  name: string;
  description: string;
  finding_ids: string[];
  affected_endpoint_ids: string[];
  cluster_density?: number;
  created_at: string;
}

export interface KnowledgeSearchResult {
  id: string;
  text: string;
  task_id: string;
  iteration: number;
  distance?: number;
  run_id?: string;
}

// ── Investigation board contract ──────────────────────────────────────────────
// Lives in the shared type module so pages never import from pages.
export type Disposition = 'confirmed' | 'needs-review' | 'duplicate' | 'false-positive';

export interface ForensicCaseItem {
  id: string;
  taskId: string;
  runId: string;
  title: string;
  domain: string;
  endpoint: string;
  technique: string;
  harmCategory: string;
  riskScore: number;
  disposition: Disposition;
  seedPrompt: string;
  adversarialPrompt: string;
  targetResponse: string;
  judgeReasoning: string;
  vectorScores: {
    directHarm: number;
    toxicity: number;
    pii: number;
    hallucination: number;
    policyBreach: number;
  };
  analystNotes: string;
  pinnedAt: string;
  updatedAt: string;
}

export interface ApiKeyItem {
  id: string;
  label: string;
  key_prefix: string;
  created_at?: string;
  last_used_at?: string;
}

export interface CreatedApiKey {
  id: string;
  label: string;
  api_key: string;
}

export interface UserMe {
  uid: string;
  email: string;
  role?: string;
  created_at?: string;
}

export type TaskStatus =
  | 'queued'
  | 'mutating'
  | 'transmitting'
  | 'scoring'
  | 'completed'
  | 'failed'
  | 'breakthrough'
  | 'defended'
  | 'unresolved';

/** One iteration record (backend extension — optional) */
export interface IterationRecord {
  iteration: number;
  adversarial_prompt?: string;
  target_response?: string;
  risk_score?: number;
  judge_reasoning?: string;
  vector_scores?: VectorScores;
}

/** Node in a lineage chain (backend extension — optional) */
export interface LineageNode {
  iter: number;
  label: 'seed' | 'refinement' | 'pivot' | string;
  risk_score?: number;
}

/** Structured judge verdict (backend extension — optional) */
export interface JudgeVerdict {
  label: string;
  confidence?: number;
  rationale?: string;
}

export interface VectorScores {
  direct_harm?: number;
  toxicity?: number;
  pii?: number;
  hallucination?: number;
  policy_breach?: number;
  novelty?: number;
  diversity?: number;
  realism?: number;
  transferability?: number;
  semantic_quality?: number;
  [key: string]: number | undefined;
}

export interface LiveTask {
  task_id: string;
  run_id?: string;
  endpoint_id?: string;
  endpoint_name?: string;
  harm_type: string;
  technique: string;
  harm_type_group?: string;        // backend ext 4: grouping key
  status: TaskStatus;
  iterations: number;
  max_iterations?: number;
  risk_score: number;
  is_breakthrough: boolean;
  prompt?: string;
  adversarial_prompt?: string;
  target_response?: string;
  judge_reasoning?: string;
  vector_scores?: VectorScores;
  latency_ms?: number;
  error_message?: string;
  created_at?: string;
  last_updated: string;
  // backend extension 1: per-iteration history
  iterations_history?: IterationRecord[];
  // backend extension: lineage chain
  lineage_chain?: LineageNode[];
  // backend extension: structured judge verdict
  judge_verdict?: JudgeVerdict;
}

export interface RunStats {
  total_tasks: number;
  completed_tasks: number;
  successful_attacks: number;
  defended_tasks?: number;
  unresolved_tasks?: number;
  avg_risk_score: number;
  median_risk_score?: number;
  status: 'queued' | 'running' | 'completed' | 'failed' | string;
  domain?: string;
  endpoint_name?: string;
  started_at?: string;
}

export interface IntelligenceAlert {
  id: string;
  timestamp: string;
  type: 'anomaly.detected' | 'weakness.discovered' | 'anomaly' | 'cluster_formed' | 'rate_limit' | 'breakthrough_streak' | string;
  severity: 'critical' | 'high' | 'medium' | 'warning' | 'info' | string;
  message: string;
  payload: Record<string, unknown>;
  task_id?: string;
  run_id?: string;
}

export interface HistoricalTaskResult {
  id?: string;
  task_id?: string;
  technique_id?: string;
  harm_type?: string;
  is_breakthrough?: boolean;
  overall_risk_score?: number;
  iterations?: number;
  adversarial_prompt?: string;
  target_response?: string;
}

export interface RunResultsResponse {
  run_id: string;
  results: HistoricalTaskResult[];
  total_results?: number;
}
