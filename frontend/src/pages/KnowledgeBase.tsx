import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../utils/api';
import { Search, X, Network } from 'lucide-react';
import { PageHeader, ActionButton } from '../components/ui';
import { TelemetryRow } from '../components/ui/TelemetryRow';
import { useCachedQuery } from '../utils/queryCache';
import type { WeaknessCluster, KnowledgeSearchResult } from '../types/domain';

/**
 * WEAKNESSES — the systemic weakness atlas.
 *
 * Owns: weakness-cluster grid and the semantic prompt search.
 * Does NOT own: findings triage (that lives on Findings). Cluster cards
 * deep-link into a scoped Findings view so knowledge connects to evidence.
 */
export default function KnowledgeBase() {
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<KnowledgeSearchResult[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  const weaknessesResource = useCachedQuery('weaknesses:atlas', () => api.getWeaknesses(100, 0));
  const weaknesses: WeaknessCluster[] = useMemo(
    () => weaknessesResource.data?.weaknesses ?? [],
    [weaknessesResource.data]
  );
  const loading = weaknessesResource.loading && weaknesses.length === 0;

  // Total findings mapped across all discovered clusters (real derived metric).
  const mappedFindings = useMemo(
    () => weaknesses.reduce((sum, w) => sum + (w.finding_ids?.length || 0), 0),
    [weaknesses]
  );

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      setSearchResults(null);
      return;
    }
    setIsSearching(true);
    try {
      const res = await api.searchKnowledge(searchQuery.trim(), 20);
      setSearchResults(res.results || []);
    } catch (err) {
      console.error('Semantic search failed', err);
    } finally {
      setIsSearching(false);
    }
  };

  const openClusterInFindings = (w: WeaknessCluster) => {
    navigate('/dashboard/findings', {
      state: { clusterName: w.name, findingIds: w.finding_ids ?? [] },
    });
  };

  const openSpecimenInMissionControl = (result: KnowledgeSearchResult) => {
    if (!result.run_id) return;
    navigate('/dashboard', { state: { focusTaskId: result.task_id } });
    window.dispatchEvent(new CustomEvent('valerie-focus-specimen', {
      detail: { runId: result.run_id, taskId: result.task_id },
    }));
  };

  return (
    <section className="flex flex-col w-full hairline-bottom animate-fade-in pb-16 font-mono select-none" aria-label="Weakness Atlas">
      {/* ── 1. Page Header ── */}
      <PageHeader
        title="WEAKNESS ATLAS"
        subtitle="SYSTEMIC VULNERABILITY CLUSTERS &amp; SEMANTIC PROMPT INDEX"
        action={
          <form onSubmit={handleSearch} className="flex w-full sm:w-80" role="search">
            <input
              type="text"
              placeholder="SEMANTIC PROMPT SEARCH..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Semantic prompt search"
              className="flex-1 bg-linen/50 border border-hairline px-3 py-2 text-xs font-mono text-slate placeholder:text-taupe focus:bg-ivory focus:border-slate focus:outline-none shadow-2xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => { setSearchQuery(''); setSearchResults(null); }}
                className="px-2 bg-linen/50 border-y border-hairline text-steel hover:text-slate"
                aria-label="Clear search"
              >
                <X size={12} />
              </button>
            )}
            <button
              type="submit"
              disabled={isSearching}
              className="px-4 bg-slate text-parchment font-mono text-xs font-bold hover:bg-slate/90 disabled:opacity-50 cursor-pointer flex items-center justify-center"
              aria-label="Run semantic search"
            >
              <Search size={13} />
            </button>
          </form>
        }
      />

      {/* ── 2. Telemetry Row ── */}
      <TelemetryRow
        ariaLabel="Weakness atlas metrics"
        cells={[
          {
            index: '1.01',
            label: 'WEAKNESS CLUSTERS',
            value: <><span>{weaknesses.length}</span><span className="text-steel text-sm font-normal"> PATTERNS</span></>,
            sublabel: 'AI-DISCOVERED TOPOLOGIES',
          },
          {
            index: '1.02',
            label: 'MAPPED FINDINGS',
            value: <><span>{mappedFindings}</span><span className="text-steel text-sm font-normal"> LINKED</span></>,
            sublabel: 'EVIDENCE DOSSIERS IN CLUSTERS',
          },
          {
            index: '1.03',
            label: 'SEMANTIC INDEX',
            variant: 'static',
            value: <span className="text-slate">COSINE</span>,
            sublabel: 'PROMPT EMBEDDING SPACE',
          },
        ]}
      />

      {/* ── 3. Semantic Search Results ── */}
      {searchResults !== null ? (
        <div className="w-full font-mono" role="region" aria-label="Semantic search results">
          <div className="p-4 bg-linen/40 hairline-bottom flex justify-between items-center text-xs">
            <span className="font-bold text-slate uppercase">
              PROMPT MATCHES FOR: "{searchQuery}" ({searchResults.length})
            </span>
            <button
              onClick={() => setSearchResults(null)}
              className="text-xs text-steel hover:text-slate underline cursor-pointer uppercase font-bold"
            >
              DISMISS SEARCH
            </button>
          </div>
          {searchResults.length > 0 ? (
            <div className="divide-y divide-hairline">
              {searchResults.map((res, idx) => (
                <div
                  key={res.id || idx}
                  className="p-5 bg-ivory hover:bg-linen/30 transition-colors space-y-2 cursor-pointer group"
                  onClick={() => openSpecimenInMissionControl(res)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && openSpecimenInMissionControl(res)}
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate">SPECIMEN #{String(idx + 1).padStart(2, '0')}</span>
                    <span className="flex items-center gap-2">
                      <span className="text-[10px] text-taupe">
                        TASK: {res.task_id} · ITERATION: {res.iteration}
                      </span>
                      <span className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-steel group-hover:text-slate opacity-0 group-hover:opacity-100 transition-opacity">
                        <Network size={10} />
                        INSPECT
                      </span>
                    </span>
                  </div>
                  <p className="text-xs text-slate font-sans leading-relaxed">{res.text}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-16 text-center text-xs text-steel">
              NO MATCHING PROMPTS FOUND UNDER COSINE THRESHOLD
            </div>
          )}
        </div>
      ) : loading ? (
        <div className="py-16 text-center text-xs text-steel">LOADING SYSTEMIC WEAKNESS TOPOLOGIES</div>
      ) : weaknesses.length > 0 ? (
        /* ── Weakness Cluster Atlas Grid ── */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-hairline hairline-top">
          {weaknesses.map((w, idx) => {
            const indexStr = String(idx + 1).padStart(2, '0');
            return (
              <div key={w.id || idx} className="flex flex-col justify-between bg-ivory">
                <div className="p-6 hover:bg-linen/30 transition-colors space-y-4 cursor-pointer flex-1"
                  onClick={() => openClusterInFindings(w)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && openClusterInFindings(w)}
                  title={`Inspect ${w.finding_ids?.length || 0} linked findings`}
                >
                  <div>
                    <div className="flex items-center justify-between text-xs text-steel mb-1">
                      <span className="font-bold">CLUSTER #{indexStr}</span>
                      <span className="text-[9px] uppercase px-1.5 py-0.5 bg-linen border border-hairline text-slate">
                        {(w.trend || 'stable').toUpperCase()} PATTERN
                      </span>
                    </div>
                    <h3 className="text-sm font-bold uppercase tracking-tight text-slate mt-1">
                      {w.name}
                    </h3>
                    <p className="text-xs text-steel font-sans leading-relaxed mt-2">
                      {w.description}
                    </p>
                  </div>

                  <div className="pt-3 hairline-top text-[11px] text-steel space-y-1.5">
                    <div className="flex justify-between">
                      <span className="uppercase text-taupe">FINDINGS COUNT:</span>
                      <span className="font-bold text-slate">{w.finding_ids?.length || 0} DOSSIERS</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="uppercase text-taupe">AFFECTED ENDPOINTS:</span>
                      <span className="font-bold text-slate">{w.affected_endpoint_ids?.length || 0} TARGETS</span>
                    </div>
                  </div>

                  <ActionButton variant="secondary" icon={<Network size={11} />} className="w-full justify-center">
                    INSPECT LINKED FINDINGS
                  </ActionButton>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="py-16 px-6 text-center font-mono select-none hairline-bottom bg-linen/20">
          <p className="text-xs font-bold uppercase text-slate">NO WEAKNESS CLUSTERS DISCOVERED YET</p>
          <p className="text-[11px] text-steel mt-1 max-w-md mx-auto">
            Unsupervised clustering runs automatically across confirmed breakthroughs to identify systemic vulnerability patterns.
          </p>
        </div>
      )}
    </section>
  );
}
