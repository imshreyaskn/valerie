import { useEffect, useState, useMemo, useRef } from 'react';
import { api } from '../utils/api';
import { Trash2, X, Plus, Play, RefreshCw, Radio, Search } from 'lucide-react';
import { PageHeader, ActionButton, StatusBadge } from '../components/ui';
import { TelemetryRow } from '../components/ui/TelemetryRow';
import { useLauncherStore } from '../stores/launcherStore';
import { useHotkeyFocus } from '../hooks/useHotkeyFocus';
import { useCachedQuery, invalidate } from '../utils/queryCache';
import type { Endpoint, EndpointProvider } from '../types/domain';

const PROVIDER_OPTIONS: { id: EndpointProvider; label: string; defaultUrl: string }[] = [
  { id: 'openai_compat', label: 'OpenAI Compatible (Bearer Auth)', defaultUrl: 'https://api.openai.com/v1' },
  { id: 'anthropic',     label: 'Anthropic Claude (x-api-key)',   defaultUrl: 'https://api.anthropic.com/v1' },
  { id: 'gemini',        label: 'Google Gemini (API Key)',        defaultUrl: 'https://generativelanguage.googleapis.com/v1beta' },
  { id: 'custom',        label: 'Custom HTTP Proxy / Air-gapped', defaultUrl: 'http://localhost:8000/v1' },
];

export default function Endpoints() {
  const openLauncher = useLauncherStore((s) => s.openLauncher);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateEndpoint, setShowCreateEndpoint] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [provider, setProvider] = useState<EndpointProvider>('openai_compat');
  const [baseUrl, setBaseUrl] = useState('https://api.openai.com/v1');
  const [apiKey, setApiKey] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Testing connectivity state
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { status: 'ok' | 'error'; detail?: string; latency?: number }>>({});

  const searchInputRef = useRef<HTMLInputElement>(null);
  useHotkeyFocus(searchInputRef);

  // Cached endpoint registry — shared with the launcher's Stage 1 selector.
  const endpointsResource = useCachedQuery('endpoints:all', () => api.listEndpoints());
  const endpoints: Endpoint[] = useMemo(() => endpointsResource.data?.endpoints ?? [], [endpointsResource.data]);
  const loading = endpointsResource.loading && endpoints.length === 0;

  useEffect(() => {
    if (!showCreateEndpoint) setFormError(null);
  }, [showCreateEndpoint]);

  const handleProviderChange = (p: EndpointProvider) => {
    setProvider(p);
    const opt = PROVIDER_OPTIONS.find((o) => o.id === p);
    if (opt) setBaseUrl(opt.defaultUrl);
  };

  const handleCreateEndpoint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setIsSubmitting(true);
    setFormError(null);
    try {
      await api.createEndpoint({
        name: name.trim(),
        provider,
        base_url: baseUrl.trim() || 'https://api.openai.com/v1',
        api_key: apiKey.trim() || undefined,
      });
      invalidate('endpoints');
      setShowCreateEndpoint(false);
      setName('');
      setProvider('openai_compat');
      setBaseUrl('https://api.openai.com/v1');
      setApiKey('');
    } catch (err: unknown) {
      setFormError(`Registration failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteEndpoint = async (id: string) => {
    if (!confirm('Are you sure you want to delete this endpoint? Historical campaign records will remain preserved.')) return;
    setActionError(null);
    try {
      await api.deleteEndpoint(id);
      invalidate('endpoints');
    } catch (err: unknown) {
      setActionError(`Deletion failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleTestEndpoint = async (id: string) => {
    setTestingId(id);
    const startTime = performance.now();
    try {
      const res = await api.testEndpoint(id);
      const latency = Math.round(performance.now() - startTime);
      setTestResults((prev) => ({
        ...prev,
        [id]: {
          status: res.status === 'ok' ? 'ok' : 'error',
          detail: res.detail,
          latency,
        },
      }));
    } catch (err: unknown) {
      setTestResults((prev) => ({
        ...prev,
        [id]: {
          status: 'error',
          detail: err instanceof Error ? err.message : 'Connection request failed',
        },
      }));
    } finally {
      setTestingId(null);
    }
  };

  const filteredEndpoints = useMemo(() => {
    if (!searchQuery.trim()) return endpoints;
    const q = searchQuery.toLowerCase();
    return endpoints.filter(
      (ep) =>
        ep.name.toLowerCase().includes(q) ||
        ep.provider.toLowerCase().includes(q) ||
        ep.base_url?.toLowerCase().includes(q)
    );
  }, [endpoints, searchQuery]);

  const uniqueProvidersCount = useMemo(
    () => new Set(endpoints.map((ep) => ep.provider)).size,
    [endpoints]
  );

  // Real connectivity telemetry derived from this session's tests.
  const testedCount = Object.keys(testResults).length;
  const reachableCount = Object.values(testResults).filter((r) => r.status === 'ok').length;

  return (
    <section className="flex flex-col w-full hairline-bottom animate-fade-in pb-16" aria-label="Endpoints Registry">
      {/* ── 1. Page Header ── */}
      <PageHeader
        title="TARGET ENDPOINTS"
        subtitle="LLM REGISTRY, CONNECTION HEALTH &amp; PROXY CONFIGURATION"
        action={
          <div className="flex items-center gap-3">
            <ActionButton
              variant="secondary"
              icon={<Play size={14} className="fill-current" />}
              onClick={openLauncher}
            >
              LAUNCH CAMPAIGN
            </ActionButton>
            <ActionButton
              variant="primary"
              icon={showCreateEndpoint ? <X size={14} /> : <Plus size={14} strokeWidth={2.5} />}
              onClick={() => setShowCreateEndpoint((v) => !v)}
            >
              {showCreateEndpoint ? 'CLOSE REGISTRATION' : '+ ADD ENDPOINT'}
            </ActionButton>
          </div>
        }
      />

      {/* ── 2. Telemetry Row (all cells bound to real state) ── */}
      <TelemetryRow
        ariaLabel="Endpoint registry metrics"
        cells={[
          {
            index: '1.01',
            label: 'REGISTERED TARGETS',
            value: <><span>{endpoints.length}</span><span className="text-steel text-sm font-normal"> ENDPOINTS</span></>,
            sublabel: `${uniqueProvidersCount} PROVIDER INTEGRATIONS`,
          },
          {
            index: '1.02',
            label: 'ACTIVE PROTOCOLS',
            value: <><span>{uniqueProvidersCount}</span><span className="text-steel text-sm font-normal"> TYPES</span></>,
            sublabel: 'OPENAI · ANTHROPIC · GEMINI · CUSTOM',
          },
          {
            index: '1.03',
            label: 'REACHABILITY (THIS SESSION)',
            variant: testedCount > 0 && reachableCount === testedCount ? 'olive' : testedCount > 0 ? 'camel' : 'default',
            value: testedCount > 0
              ? <span className={reachableCount === testedCount ? 'text-olive' : 'text-camel'}>{reachableCount}/{testedCount}</span>
              : <span className="text-slate">—</span>,
            sublabel: testedCount > 0 ? 'LIVE TEST-PING RESULTS' : 'RUN TEST PING TO MEASURE',
          },
          {
            index: '1.04',
            label: 'CREDENTIAL ISOLATION',
            variant: 'static',
            value: <span className="text-slate">FERNET</span>,
            sublabel: 'ENCRYPTED AT REST · NEVER ECHOED',
          },
        ]}
      />

      {/* ── 3. Action Error Banner ── */}
      {actionError && (
        <div className="p-4 bg-maroon/5 border-b border-maroon/30 flex items-center justify-between font-mono animate-fade-in" role="alert">
          <span className="text-xs font-bold uppercase tracking-wider text-maroon">{actionError}</span>
          <button onClick={() => setActionError(null)} className="text-maroon hover:text-slate cursor-pointer p-1" aria-label="Dismiss error">
            <X size={14} />
          </button>
        </div>
      )}

      {/* ── 4. Endpoint Registration Drawer ── */}
      {showCreateEndpoint && (
        <form onSubmit={handleCreateEndpoint} className="p-6 md:p-8 bg-linen/60 hairline-bottom space-y-6 font-mono animate-fade-in select-none">
          <div className="flex justify-between items-center pb-2 hairline-bottom">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate block">
                REGISTER NEW TARGET MODEL ENDPOINT
              </span>
              <span className="text-[11px] text-steel">
                Configure connection parameters for automated security probing and vulnerability evaluation.
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowCreateEndpoint(false)}
              className="text-steel hover:text-slate p-1 cursor-pointer"
              aria-label="Close registration form"
            >
              <X size={16} />
            </button>
          </div>

          {formError && (
            <div className="p-3 bg-maroon-muted border border-maroon/30 text-xs font-bold uppercase text-maroon" role="alert">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold uppercase text-taupe mb-1">
                ENDPOINT NAME *
              </label>
              <input
                placeholder="e.g. Claims Agent Prod (Mistral Small)"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full bg-ivory border border-hairline px-3 py-2 text-xs font-mono text-slate focus:outline-none focus:border-slate shadow-2xs"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase text-taupe mb-1">
                PROVIDER PROTOCOL *
              </label>
              <select
                value={provider}
                onChange={(e) => handleProviderChange(e.target.value as EndpointProvider)}
                className="w-full bg-ivory border border-hairline px-3 py-2 text-xs font-mono text-slate focus:outline-none focus:border-slate shadow-2xs"
              >
                {PROVIDER_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase text-taupe mb-1">
                BASE URL / PROXY GATEWAY *
              </label>
              <input
                placeholder="https://api.openai.com/v1"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                required
                className="w-full bg-ivory border border-hairline px-3 py-2 text-xs font-mono text-slate focus:outline-none focus:border-slate shadow-2xs"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase text-taupe mb-1">
                API KEY / BEARER TOKEN (BYOK - OPTIONAL)
              </label>
              <input
                type="password"
                placeholder="sk-••••••••••••••••"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="w-full bg-ivory border border-hairline px-3 py-2 text-xs font-mono text-slate focus:outline-none focus:border-slate shadow-2xs"
              />
              <span className="text-[9px] text-taupe mt-0.5 block">Encrypted at rest (Fernet). Only a masked tail is ever returned.</span>
            </div>
          </div>

          <div className="flex gap-3 pt-2 hairline-top">
            <ActionButton variant="primary" type="submit" disabled={isSubmitting || !name.trim()}>
              {isSubmitting ? 'REGISTERING' : 'SAVE & REGISTER ENDPOINT'}
            </ActionButton>
            <ActionButton variant="ghost" type="button" onClick={() => setShowCreateEndpoint(false)}>
              CANCEL
            </ActionButton>
          </div>
        </form>
      )}

      {/* ── 5. Search Omnibar ── */}
      <div className="w-full hairline-bottom select-none py-3 font-mono">
        <div className="relative w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-steel pointer-events-none" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search endpoints by name, provider protocol, or base URL [/]"
            className="w-full pl-10 pr-10 py-2 bg-linen/50 border border-hairline text-xs font-mono text-slate placeholder:text-taupe focus:bg-ivory focus:border-slate focus:outline-none transition-all shadow-2xs"
            aria-label="Search endpoints"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-steel hover:text-slate p-0.5 cursor-pointer"
              aria-label="Clear search"
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* ── 6. Endpoints Swiss Ledger ── */}
      {loading ? (
        <div className="py-16 text-center font-mono text-xs text-steel">
          LOADING REGISTERED TARGET ENDPOINTS
        </div>
      ) : filteredEndpoints.length > 0 ? (
        <div className="w-full hairline-bottom select-none font-mono" role="region" aria-label="Endpoints Table">
          {/* Table Headers */}
          <div className="hidden md:grid md:grid-cols-[60px_220px_1fr_180px_100px] items-center p-0 hairline-bottom bg-linen/30 text-xs font-semibold uppercase text-steel">
            <div className="p-3 md:p-4 hairline-right">#</div>
            <div className="p-3 md:p-4 hairline-right">ENDPOINT NAME</div>
            <div className="p-3 md:p-4 hairline-right">PROVIDER &amp; BASE URL</div>
            <div className="p-3 md:p-4 hairline-right text-center">CONNECTIVITY TEST</div>
            <div className="p-3 md:p-4 text-right">ACTION</div>
          </div>

          {/* Rows */}
          <div className="divide-y divide-hairline">
            {filteredEndpoints.map((ep, idx) => {
              const indexStr = String(idx + 1).padStart(2, '0');
              const isTesting = testingId === ep.id;
              const result = testResults[ep.id];

              return (
                <div
                  key={ep.id}
                  className="grid grid-cols-1 md:grid-cols-[60px_220px_1fr_180px_100px] items-center p-0 hover:bg-linen/40 transition-colors bg-ivory"
                >
                  {/* # Index */}
                  <div className="p-3 md:p-4 text-sm font-mono text-steel md:hairline-right select-none">
                    {indexStr}
                  </div>

                  {/* Endpoint Name */}
                  <div className="p-3 md:p-4 md:hairline-right min-w-0">
                    <p className="text-sm font-bold uppercase tracking-tight text-slate truncate">
                      {ep.name}
                    </p>
                    <p className="text-[10px] text-taupe font-mono truncate mt-0.5">
                      ID: {ep.id}
                    </p>
                  </div>

                  {/* Provider & Base URL */}
                  <div className="p-3 md:p-4 md:hairline-right min-w-0 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 bg-linen border border-hairline text-slate shrink-0">
                        {ep.provider}
                      </span>
                      <span className="text-steel font-mono truncate">
                        {ep.base_url || 'Default Cloud Gateway'}
                      </span>
                    </div>
                  </div>

                  {/* Connectivity Test */}
                  <div className="p-3 md:p-4 md:hairline-right text-left md:text-center">
                    {result ? (
                      <div className="flex items-center justify-start md:justify-center gap-2">
                        <StatusBadge
                          label={result.status === 'ok' ? `CONNECTED (${result.latency}ms)` : 'CONNECTION FAILED'}
                          variant={result.status === 'ok' ? 'olive' : 'maroon'}
                        />
                        <button
                          onClick={() => handleTestEndpoint(ep.id)}
                          disabled={isTesting}
                          className="text-steel hover:text-slate p-1 cursor-pointer"
                          title="Re-test Connection"
                        >
                          <RefreshCw size={11} className={isTesting ? 'animate-spin' : ''} />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleTestEndpoint(ep.id)}
                        disabled={isTesting}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-hairline bg-linen/50 hover:bg-slate hover:text-parchment text-slate text-xs font-bold uppercase transition-all cursor-pointer"
                      >
                        {isTesting ? (
                          <>
                            <RefreshCw size={11} className="animate-spin" />
                            <span>TESTING</span>
                          </>
                        ) : (
                          <>
                            <Radio size={11} className="text-olive" />
                            <span>TEST PING</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="p-3 md:p-4 text-left md:text-right">
                    <button
                      onClick={() => handleDeleteEndpoint(ep.id)}
                      className="p-1.5 text-steel hover:text-maroon hover:bg-maroon/10 border border-transparent hover:border-maroon/30 transition-colors cursor-pointer"
                      title="Delete Endpoint"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Empty State */
        <div className="py-16 px-6 text-center font-mono select-none hairline-bottom bg-linen/20">
          <p className="text-xs font-bold uppercase text-slate">NO TARGET ENDPOINTS REGISTERED</p>
          <p className="text-[11px] text-steel mt-1 max-w-md mx-auto">
            Register your model endpoints with BYOK credentials to execute automated adversarial evaluations.
          </p>
          <div className="mt-4">
            <ActionButton variant="primary" onClick={() => setShowCreateEndpoint(true)}>
              + REGISTER FIRST ENDPOINT
            </ActionButton>
          </div>
        </div>
      )}
    </section>
  );
}
