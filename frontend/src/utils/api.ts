import type {
  Endpoint,
  CreateEndpointPayload,
  Run,
  CreateRunPayload,
  Finding,
  WeaknessCluster,
  KnowledgeSearchResult,
  ApiKeyItem,
  CreatedApiKey,
  UserMe,
  RunResultsResponse,
} from '../types/domain';

const API_URL = import.meta.env.VITE_API_URL || '/api';

async function fetchWithAuth<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('vl_jwt');
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `API Error: ${response.statusText}`);
  }

  const contentLength = response.headers.get('content-length');
  if (contentLength === '0') return null as T;

  return response.json();
}

export const api = {
  // User Management
  getMe: (): Promise<UserMe> => fetchWithAuth<UserMe>('/users/me'),
  deleteMe: (): Promise<void> => fetchWithAuth<void>('/users/me', { method: 'DELETE' }),

  // API Key Management
  listKeys: (): Promise<{ keys: ApiKeyItem[] }> => fetchWithAuth<{ keys: ApiKeyItem[] }>('/keys/'),
  createKey: (label: string): Promise<CreatedApiKey> =>
    fetchWithAuth<CreatedApiKey>('/keys/', { method: 'POST', body: JSON.stringify({ label }) }),
  revokeKey: (keyId: string): Promise<void> => fetchWithAuth<void>(`/keys/${keyId}`, { method: 'DELETE' }),

  // Endpoint Registry
  listEndpoints: (): Promise<{ endpoints: Endpoint[] }> => fetchWithAuth<{ endpoints: Endpoint[] }>('/endpoints/'),
  createEndpoint: (data: CreateEndpointPayload): Promise<Endpoint> =>
    fetchWithAuth<Endpoint>('/endpoints/', { method: 'POST', body: JSON.stringify(data) }),
  deleteEndpoint: (id: string): Promise<void> => fetchWithAuth<void>(`/endpoints/${id}`, { method: 'DELETE' }),
  testEndpoint: (id: string): Promise<{ status: string; detail?: string }> =>
    fetchWithAuth<{ status: string; detail?: string }>(`/endpoints/${id}/test`, { method: 'POST' }),

  // Campaign / Run Pipelines
  listRuns: (limit = 50, offset = 0): Promise<{ runs: Run[] }> =>
    fetchWithAuth<{ runs: Run[] }>(`/runs/?limit=${limit}&offset=${offset}`),
  getRun: (id: string): Promise<Run> => fetchWithAuth<Run>(`/runs/${id}`),
  createRun: (config: CreateRunPayload): Promise<{ run_id: string; status: string }> =>
    fetchWithAuth<{ run_id: string; status: string }>('/runs/', { method: 'POST', body: JSON.stringify(config) }),
  getResults: (runId: string): Promise<RunResultsResponse> =>
    fetchWithAuth<RunResultsResponse>(`/runs/${runId}/results`),

  // Authentication
  authLogin: (credentials: { email: string; password?: string }): Promise<{ access_token: string }> =>
    fetchWithAuth<{ access_token: string }>('/users/login', { method: 'POST', body: JSON.stringify(credentials) }),
  authRegister: (credentials: { email: string; password?: string }): Promise<{ access_token: string }> =>
    fetchWithAuth<{ access_token: string }>('/users/register', { method: 'POST', body: JSON.stringify(credentials) }),

  // Threat Knowledge & Vector Embeddings
  getFindings: (limit = 50, offset = 0): Promise<{ findings: Finding[] }> =>
    fetchWithAuth<{ findings: Finding[] }>(`/knowledge/findings?limit=${limit}&offset=${offset}`),
  getWeaknesses: (limit = 50, offset = 0): Promise<{ weaknesses: WeaknessCluster[] }> =>
    fetchWithAuth<{ weaknesses: WeaknessCluster[] }>(`/knowledge/weaknesses?limit=${limit}&offset=${offset}`),
  searchKnowledge: (query: string, limit = 10): Promise<{ results: KnowledgeSearchResult[] }> =>
    fetchWithAuth<{ results: KnowledgeSearchResult[] }>('/knowledge/search', {
      method: 'POST',
      body: JSON.stringify({ query, limit }),
    }),

  // Lineage & Forensic Intelligence
  getLineage: (runId: string, taskId: string): Promise<Record<string, unknown>> =>
    fetchWithAuth<Record<string, unknown>>(`/lineage/runs/${runId}/tasks/${taskId}`),
  getPromptLineage: (promptId: string): Promise<Record<string, unknown>> =>
    fetchWithAuth<Record<string, unknown>>(`/lineage/${promptId}`),
  getIntelligenceAnomalies: (): Promise<Record<string, unknown>> =>
    fetchWithAuth<Record<string, unknown>>('/intelligence/anomalies'),
  getIntelligenceClusters: (): Promise<Record<string, unknown>> =>
    fetchWithAuth<Record<string, unknown>>('/intelligence/clusters'),
  getIntelligenceCoverage: (): Promise<Record<string, unknown>> =>
    fetchWithAuth<Record<string, unknown>>('/intelligence/coverage'),
  getDomainHarmTypes: (domain: string): Promise<{ harm_types: string[] }> =>
    fetchWithAuth<{ harm_types: string[] }>(`/domains/${domain}/harm-types`),
};
