import React, { useEffect, useState, useMemo } from 'react';
import { api } from '../utils/api';
import { Search, ChevronDown, ChevronUp, X, Filter } from 'lucide-react';
import { PageHeader, StatusBadge } from '../components/ui';
import type { Finding, WeaknessCluster, KnowledgeSearchResult } from '../types/domain';

export default function KnowledgeBase() {
  const [activeTab, setActiveTab] = useState<'findings' | 'weaknesses'>('findings');
  const [findings, setFindings] = useState<Finding[]>([]);
  const [weaknesses, setWeaknesses] = useState<WeaknessCluster[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<KnowledgeSearchResult[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [expandedFinding, setExpandedFinding] = useState<string | null>(null);
  const [severityFilter, setSeverityFilter] = useState('ALL');

  useEffect(() => {
    setLoading(true);
    if (activeTab === 'findings') {
      api.getFindings(100, 0)
        .then((res) => setFindings(res.findings || []))
        .catch(console.error)
        .finally(() => setLoading(false));
    } else {
      api.getWeaknesses(100, 0)
        .then((res) => setWeaknesses(res.weaknesses || []))
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [activeTab]);

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
    } catch (e) {
      console.error(e);
    } finally {
      setIsSearching(false);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedFinding(expandedFinding === id ? null : id);
  };

  const getSeverityVariant = (severity: string) => {
    const s = severity?.toLowerCase();
    if (s === 'critical' || s === 'high') return 'maroon';
    if (s === 'medium' || s === 'warning') return 'camel';
    return 'powder';
  };

  const totalBreakthroughs = useMemo(() => {
    return findings.filter((f) => f.is_breakthrough).length;
  }, [findings]);

  const filteredFindings = useMemo(() => {
    return findings.filter((f) => {
      if (severityFilter !== 'ALL' && f.severity?.toLowerCase() !== severityFilter.toLowerCase()) {
        return false;
      }
      return true;
    });
  }, [findings, severityFilter]);

  return (
    <section className="flex flex-col w-full hairline-bottom animate-fade-in pb-16" aria-label="Threat Knowledge Base">
      {/* ── 1. Page Header ── */}
      <PageHeader
        title="THREAT KNOWLEDGE"
        subtitle="VULNERABILITY GRAPH, VECTOR EMBEDDINGS &amp; SYSTEMIC WEAKNESS ATLAS"
        action={
          <form onSubmit={handleSearch} className="flex w-full sm:w-80" role="search">
            <input
              type="text"
              placeholder="SEARCH EMBEDDINGS... [/]"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search embeddings"
              className="flex-1 bg-linen/50 border border-hairline px-3 py-2 text-xs font-mono text-slate placeholder:text-taupe focus:bg-ivory focus:border-slate focus:outline-none shadow-2xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => { setSearchQuery(''); setSearchResults(null); }}
                className="px-2 bg-linen/50 border-y border-hairline text-steel hover:text-slate"
              >
                <X size={12} />
              </button>
            )}
            <button
              type="submit"
              disabled={isSearching}
              className="px-4 bg-slate text-parchment font-mono text-xs font-bold hover:bg-slate/90 disabled:opacity-50 cursor-pointer flex items-center justify-center"
            >
              <Search size={13} />
            </button>
          </form>
        }
      />

      {/* ── 2. Swiss Telemetry Row ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-hairline hairline-bottom select-none font-mono">
        {/* 1.01 TOTAL FINDINGS */}
        <div className="py-5 pr-4 md:py-6 md:pr-6 md:pl-0 flex flex-col justify-between">
          <div>
            <div className="text-xs font-mono text-steel mb-1">1.01</div>
            <div className="text-xs font-semibold uppercase tracking-[0.02em] text-slate mb-2">
              CONFIRMED FINDINGS
            </div>
          </div>
          <div>
            <div className="text-2xl md:text-3xl font-bold text-slate tabular-nums leading-none">
              {findings.length} <span className="text-steel text-sm font-normal">SPECIMENS</span>
            </div>
            <div className="text-[10px] text-steel mt-2 uppercase truncate">
              INDEXED SECURITY DOSSIERS
            </div>
          </div>
        </div>

        {/* 1.02 BREAKTHROUGHS */}
        <div className="p-4 md:p-6 flex flex-col justify-between">
          <div>
            <div className="text-xs font-mono text-steel mb-1">1.02</div>
            <div className="text-xs font-semibold uppercase tracking-[0.02em] text-slate mb-2">
              CRITICAL BREACHES
            </div>
          </div>
          <div>
            <div className="text-2xl md:text-3xl font-bold text-maroon tabular-nums leading-none flex items-center gap-1.5">
              {totalBreakthroughs > 0 && <span className="text-sm">◆</span>}
              {totalBreakthroughs}
            </div>
            <div className="text-[10px] text-steel mt-2 uppercase truncate">
              THRESHOLD-CROSSING EXPLOITS
            </div>
          </div>
        </div>

        {/* 1.03 CLUSTER TOPOLOGIES */}
        <div className="p-4 md:p-6 flex flex-col justify-between">
          <div>
            <div className="text-xs font-mono text-steel mb-1">1.03</div>
            <div className="text-xs font-semibold uppercase tracking-[0.02em] text-slate mb-2">
              WEAKNESS CLUSTERS
            </div>
          </div>
          <div>
            <div className="text-2xl md:text-3xl font-bold text-slate tabular-nums leading-none">
              {weaknesses.length} <span className="text-steel text-sm font-normal">PATTERNS</span>
            </div>
            <div className="text-[10px] text-steel mt-2 uppercase truncate">
              UNSUPERVISED DBSCAN TOPOLOGIES
            </div>
          </div>
        </div>

        {/* 1.04 VECTOR SPACE */}
        <div className="py-5 pl-4 md:py-6 md:pl-6 flex flex-col justify-between">
          <div>
            <div className="text-xs font-mono text-steel mb-1">1.04</div>
            <div className="text-xs font-semibold uppercase tracking-[0.02em] text-slate mb-2">
              VECTOR EMBEDDINGS
            </div>
          </div>
          <div>
            <div className="text-2xl md:text-3xl font-bold text-olive tabular-nums leading-none">
              ACTIVE
            </div>
            <div className="text-[10px] text-steel mt-2 uppercase truncate">
              COSINE SEMANTIC INDEX
            </div>
          </div>
        </div>
      </div>

      {/* ── 3. Swiss Mode Tabs ── */}
      <div className="flex items-center justify-between hairline-bottom bg-linen/20 select-none font-mono text-xs">
        <div className="flex">
          <button
            onClick={() => { setActiveTab('findings'); setSearchResults(null); }}
            className={`px-6 py-3 font-semibold uppercase tracking-[0.02em] transition-colors hairline-right cursor-pointer flex items-center gap-2 ${
              activeTab === 'findings' ? 'bg-slate text-parchment font-bold' : 'text-steel hover:text-slate hover:bg-linen/40'
            }`}
          >
            <span>[01] FINDINGS EXPLORER</span>
            <span className={`text-[10px] px-1.5 py-0.2 border ${
              activeTab === 'findings' ? 'bg-parchment/10 border-parchment/30 text-parchment' : 'bg-linen border-hairline text-steel'
            }`}>
              {findings.length}
            </span>
          </button>
          <button
            onClick={() => { setActiveTab('weaknesses'); setSearchResults(null); }}
            className={`px-6 py-3 font-semibold uppercase tracking-[0.02em] transition-colors cursor-pointer flex items-center gap-2 ${
              activeTab === 'weaknesses' ? 'bg-slate text-parchment font-bold' : 'text-steel hover:text-slate hover:bg-linen/40'
            }`}
          >
            <span>[02] WEAKNESS CLUSTER ATLAS</span>
            <span className={`text-[10px] px-1.5 py-0.2 border ${
              activeTab === 'weaknesses' ? 'bg-parchment/10 border-parchment/30 text-parchment' : 'bg-linen border-hairline text-steel'
            }`}>
              {weaknesses.length}
            </span>
          </button>
        </div>

        {/* Severity Filter for Findings — Vertical Line Hierarchy */}
        {activeTab === 'findings' && searchResults === null && (
          <div className="hidden sm:flex items-center gap-2 pr-4 font-mono text-[10px]">
            <span className="text-taupe uppercase text-[9px] tracking-wider">SEVERITY:</span>
            {['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((lvl, idx) => (
              <React.Fragment key={lvl}>
                {idx > 0 && <span className="h-3 w-px bg-hairline" />}
                <button
                  onClick={() => setSeverityFilter(lvl)}
                  className={`transition-colors cursor-pointer uppercase tracking-wider ${
                    severityFilter === lvl ? 'text-slate font-bold' : 'text-taupe hover:text-slate'
                  }`}
                >
                  {lvl}
                </button>
              </React.Fragment>
            ))}
          </div>
        )}
      </div>

      {/* ── 4. Main Tab Contents ── */}
      {searchResults !== null ? (
        /* Semantic Embedding Search Results */
        <div className="w-full font-mono select-none" role="region" aria-label="Search Results">
          <div className="p-4 bg-linen/40 hairline-bottom flex justify-between items-center text-xs">
            <span className="font-bold text-slate uppercase">
              EMBEDDING SEARCH RESULTS FOR: "{searchQuery}" ({searchResults.length} MATCHES)
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
                <div key={res.id || idx} className="p-5 bg-ivory hover:bg-linen/30 transition-colors space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate">SPECIMEN #{String(idx + 1).padStart(2, '0')}</span>
                    <span className="text-[10px] text-taupe">
                      TASK: {res.task_id} · ITERATION: {res.iteration}
                    </span>
                  </div>
                  <p className="text-xs text-slate font-sans leading-relaxed">{res.text}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-16 text-center text-xs text-steel">
              NO MATCHING EMBEDDINGS FOUND UNDER COSINE THRESHOLD
            </div>
          )}
        </div>
      ) : activeTab === 'findings' ? (
        /* Findings Explorer Table */
        <div className="w-full hairline-bottom select-none font-mono" role="region" aria-label="Findings Table">
          {/* Table Headers */}
          <div className="hidden md:grid md:grid-cols-[60px_1fr_180px_120px_40px] items-center p-0 hairline-bottom bg-linen/30 text-xs font-semibold uppercase text-steel">
            <div className="p-3 md:p-4 hairline-right">#</div>
            <div className="p-3 md:p-4 hairline-right">TECHNIQUE &amp; PROVENANCE</div>
            <div className="p-3 md:p-4 hairline-right">TARGET ENDPOINT</div>
            <div className="p-3 md:p-4 hairline-right text-center">SEVERITY</div>
            <div className="p-3 md:p-4 text-center"><span className="sr-only">Expand</span></div>
          </div>

          {/* Rows */}
          {loading ? (
            <div className="py-16 text-center text-xs text-steel">LOADING FINDINGS DOSSIERS</div>
          ) : filteredFindings.length > 0 ? (
            <div className="divide-y divide-hairline">
              {filteredFindings.map((f, idx) => {
                const indexStr = String(idx + 1).padStart(2, '0');
                const severityVariant = getSeverityVariant(f.severity);
                const isExpanded = expandedFinding === f.id;

                return (
                  <div key={f.id || idx} className="bg-ivory">
                    <div
                      onClick={() => toggleExpand(f.id)}
                      className="grid grid-cols-1 md:grid-cols-[60px_1fr_180px_120px_40px] items-center p-0 cursor-pointer group"
                    >
                      {/* # Index */}
                      <div className="p-3 md:p-4 text-sm font-mono text-steel md:hairline-right select-none">
                        {indexStr}
                      </div>

                      {/* Technique & ID */}
                      <div className="p-3 md:p-4 md:hairline-right min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold uppercase tracking-tight text-slate truncate">
                            {f.technique_id?.replace(/_/g, ' ') || 'PROMPT INJECTION'}
                          </span>
                          {f.is_breakthrough && (
                            <StatusBadge label="BREAKTHROUGH" variant="maroon" pulse />
                          )}
                        </div>
                        <p className="text-[10px] text-taupe font-mono truncate mt-0.5">
                          ID: {f.id} · RUN: {f.run_id}
                        </p>
                      </div>

                      {/* Endpoint */}
                      <div className="p-3 md:p-4 md:hairline-right min-w-0 text-xs font-bold uppercase text-slate truncate">
                        {f.endpoint_id}
                      </div>

                      {/* Severity */}
                      <div className="p-3 md:p-4 md:hairline-right text-left md:text-center">
                        <StatusBadge label={f.severity || 'HIGH'} variant={severityVariant} />
                      </div>

                      {/* Expand Icon */}
                      <div className="p-3 md:p-4 text-center text-steel group-hover:text-slate">
                        {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                      </div>
                    </div>

                    {/* Expanded Evidence Dossier */}
                    {isExpanded && (
                      <div className="p-6 bg-linen/50 hairline-top space-y-4 font-mono text-xs">
                        <div className="flex items-center justify-between pb-2 hairline-bottom">
                          <span className="font-bold text-slate uppercase text-xs">
                            EVIDENCE DOSSIER // RISK SEVERITY SCORE: {f.score?.toFixed(2) || '0.85'}
                          </span>
                          <span className="text-steel text-[11px]">
                            TIMESTAMP: {new Date(f.created_at || Date.now()).toLocaleString()}
                          </span>
                        </div>

                        {f.evidence && f.evidence.length > 0 ? (
                          <div className="space-y-2">
                            {f.evidence.map((ev, evIdx) => (
                              <div key={evIdx} className="p-3 bg-ivory border border-hairline space-y-1">
                                <span className="font-bold text-slate uppercase text-[10px] block">
                                  [{ev.type}]:
                                </span>
                                <p className="text-slate font-sans leading-relaxed">{ev.description}</p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="p-3 bg-ivory border border-hairline text-steel">
                            Confirmed bypass observed at threshold score. Trace lineage available in Mission Control.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-16 px-6 text-center font-mono select-none hairline-bottom bg-linen/20">
              <Filter className="w-5 h-5 text-steel/50 mx-auto mb-2" strokeWidth={1.5} />
              <p className="text-xs font-bold uppercase text-slate">NO FINDINGS RECORDED YET</p>
              <p className="text-[11px] text-steel mt-1 max-w-md mx-auto">
                Breakthrough findings and evasion discoveries from evaluation campaigns will appear here.
              </p>
            </div>
          )}
        </div>
      ) : (
        /* Weaknesses Clusters Grid */
        <div className="w-full font-mono select-none" role="region" aria-label="Weaknesses Atlas">
          {loading ? (
            <div className="py-16 text-center text-xs text-steel">LOADING SYSTEMIC WEAKNESS TOPOLOGIES</div>
          ) : weaknesses.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-hairline">
              {weaknesses.map((w, idx) => {
                const indexStr = String(idx + 1).padStart(2, '0');
                return (
                  <div
                    key={w.id || idx}
                    className="p-6 bg-ivory hover:bg-linen/30 transition-colors flex flex-col justify-between space-y-4"
                  >
                    <div>
                      <div className="flex items-center justify-between text-xs text-steel mb-1">
                        <span className="font-bold">CLUSTER #{indexStr}</span>
                        <span className="text-[9px] uppercase px-1.5 py-0.5 bg-linen border border-hairline text-slate">
                          STABLE PATTERN
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
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-16 px-6 text-center font-mono select-none hairline-bottom bg-linen/20">
              <p className="text-xs font-bold uppercase text-slate">NO WEAKNESS CLUSTERS DISCOVERED YET</p>
              <p className="text-[11px] text-steel mt-1 max-w-md mx-auto">
                Unsupervised DBSCAN clustering runs automatically across confirmed breakthroughs to identify systemic vulnerability patterns.
              </p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
