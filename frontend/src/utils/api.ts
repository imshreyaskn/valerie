const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

async function fetchWithAuth(endpoint: string, options: RequestInit = {}) {
  const token = localStorage.getItem('vl_jwt');
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }
  
  const contentLength = response.headers.get('content-length');
  if (contentLength === '0') return null;

  return response.json();
}

export const api = {
  getMe: () => fetchWithAuth('/users/me'),
  deleteMe: () => fetchWithAuth('/users/me', { method: 'DELETE' }),
  
  listKeys: () => fetchWithAuth('/keys/'),
  createKey: (label: string) => fetchWithAuth('/keys/', { method: 'POST', body: JSON.stringify({ label }) }),
  revokeKey: (keyId: string) => fetchWithAuth(`/keys/${keyId}`, { method: 'DELETE' }),
  
  listEndpoints: () => fetchWithAuth('/endpoints/'),
  createEndpoint: (data: any) => fetchWithAuth('/endpoints/', { method: 'POST', body: JSON.stringify(data) }),
  deleteEndpoint: (id: string) => fetchWithAuth(`/endpoints/${id}`, { method: 'DELETE' }),
  testEndpoint: (id: string) => fetchWithAuth(`/endpoints/${id}/test`, { method: 'POST' }),
  
  listRuns: (limit=50, offset=0) => fetchWithAuth(`/runs/?limit=${limit}&offset=${offset}`),
  getRun: (id: string) => fetchWithAuth(`/runs/${id}`),
  createRun: (config: any) => fetchWithAuth('/runs/', { method: 'POST', body: JSON.stringify(config) }),
  
  getResults: (runId: string) => fetchWithAuth(`/runs/${runId}/results`),
  
  authLogin: (credentials: any) => fetchWithAuth('/users/login', { method: 'POST', body: JSON.stringify(credentials) }),
  authRegister: (credentials: any) => fetchWithAuth('/users/register', { method: 'POST', body: JSON.stringify(credentials) }),
  
  getFindings: (limit=50, offset=0) => fetchWithAuth(`/knowledge/findings?limit=${limit}&offset=${offset}`),
  getWeaknesses: (limit=50, offset=0) => fetchWithAuth(`/knowledge/weaknesses?limit=${limit}&offset=${offset}`),
  searchKnowledge: (query: string, limit=10) => fetchWithAuth('/knowledge/search', { method: 'POST', body: JSON.stringify({ query, limit }) }),

  // Lineage & Intelligence APIs
  getLineage: (runId: string, taskId: string) => fetchWithAuth(`/lineage/runs/${runId}/tasks/${taskId}`),
  getPromptLineage: (promptId: string) => fetchWithAuth(`/lineage/${promptId}`),
  getIntelligenceAnomalies: () => fetchWithAuth('/intelligence/anomalies'),
  getIntelligenceClusters: () => fetchWithAuth('/intelligence/clusters'),
  getIntelligenceCoverage: () => fetchWithAuth('/intelligence/coverage'),
  getDomainHarmTypes: (domain: string) => fetchWithAuth(`/domains/${domain}/harm-types`),
  
  get: (url: string) => fetchWithAuth(url),
};
