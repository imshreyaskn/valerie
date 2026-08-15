import React, { useEffect, useState, useMemo } from 'react';
import { api } from '../utils/api';
import { Search, ChevronDown, ChevronUp, X, Filter, Pin, Check } from 'lucide-react';
import { PageHeader, StatusBadge, ActionButton } from '../components/ui';
import { useNavigate } from 'react-router-dom';
import type { Finding } from '../types/domain';

export default function Findings() {
  const navigate = useNavigate();
  const [findings, setFindings] = useState<Finding[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedFinding, setExpandedFinding] = useState<string | null>(null);
  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setLoading(true);
    api.getFindings(100, 0)
      .then((res) => setFindings(res.findings || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const toggleExpand = (id: string) => {
    setExpandedFinding(expandedFinding === id ? null : id);
  };

  const handleTogglePin = (id: string) => {
    setPinnedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const getSeverityVariant = (severity: string) => {
    const s = severity?.toLowerCase();
    if (s === 'critical' || s === 'high') return 'maroon';
    if (s === 'medium' || s === 'warning') return 'camel';
    return 'powder';
  };

  const filteredFindings = useMemo(() => {
    return findings.filter((f) => {
      if (severityFilter !== 'ALL' && f.severity?.toLowerCase() !== severityFilter.toLowerCase()) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const techMatch = f.technique_id?.toLowerCase().includes(q);
        const epMatch = f.endpoint_id?.toLowerCase().includes(q);
        const idMatch = f.id?.toLowerCase().includes(q);
        return techMatch || epMatch || idMatch;
      }
      return true;
    });
  }, [findings, severityFilter, searchQuery]);

  const totalBreakthroughs = useMemo(() => {
    return findings.filter((f) => f.is_breakthrough).length;
  }, [findings]);

  return (
    <section className="flex flex-col w-full hairline-bottom animate-fade-in pb-16 font-mono select-none" aria-label="Breakthrough Findings">
      {/* ── 1. Page Header ── */}
      <PageHeader
        title="FINDINGS EXPLORER"
        subtitle="CONFIRMED BREAKTHROUGHS, EXPLOIT EVIDENCE DOSSIERS &amp; DISPOSITION TRIAGE"
        action={
          <div className="flex items-center gap-3">
            <ActionButton
              variant="secondary"
              icon={<Pin size={14} />}
              onClick={() => navigate('/dashboard/investigation')}
            >
              VIEW PINNED BOARD ({pinnedIds.size})
            </ActionButton>
            <ActionButton
              variant="primary"
              onClick={() => navigate('/dashboard/campaigns')}
            >
              LAUNCH CAMPAIGN →
            </ActionButton>
          </div>
        }
      />

      {/* ── 2. Swiss Telemetry Row ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-hairline hairline-bottom select-none">
        <div className="py-5 pr-4 md:py-6 md:pr-6 md:pl-0 flex flex-col justify-between">
          <div>
            <div className="text-xs text-steel mb-1">1.01</div>
            <div className="text-xs font-semibold uppercase tracking-[0.02em] text-slate mb-2">
              TOTAL FINDINGS
            </div>
          </div>
          <div>
            <div className="text-2xl md:text-3xl font-bold text-slate tabular-nums leading-none">
              {findings.length} <span className="text-steel text-sm font-normal">DOSSIERS</span>
            </div>
            <div className="text-[10px] text-steel mt-2 uppercase truncate">
              INDEXED SECURITY SPECIMENS
            </div>
          </div>
        </div>

        <div className="p-4 md:p-6 flex flex-col justify-between">
          <div>
            <div className="text-xs text-steel mb-1">1.02</div>
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

        <div className="p-4 md:p-6 flex flex-col justify-between">
          <div>
            <div className="text-xs text-steel mb-1">1.03</div>
            <div className="text-xs font-semibold uppercase tracking-[0.02em] text-slate mb-2">
              PINNED FOR INVESTIGATION
            </div>
          </div>
          <div>
            <div className="text-2xl md:text-3xl font-bold text-slate tabular-nums leading-none">
              {pinnedIds.size} <span className="text-steel text-sm font-normal">PINNED</span>
            </div>
            <div className="text-[10px] text-steel mt-2 uppercase truncate">
              READY FOR FORENSIC CASE STUDY
            </div>
          </div>
        </div>

        <div className="py-5 pl-4 md:py-6 md:pl-6 flex flex-col justify-between">
          <div>
            <div className="text-xs text-steel mb-1">1.04</div>
            <div className="text-xs font-semibold uppercase tracking-[0.02em] text-slate mb-2">
              AUDIT COMPLIANCE
            </div>
          </div>
          <div>
            <div className="text-2xl md:text-3xl font-bold text-olive tabular-nums leading-none flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-olive" />
              TRACEABLE
            </div>
            <div className="text-[10px] text-steel mt-2 uppercase truncate">
              IMMUTABLE PROVENANCE LINKS
            </div>
          </div>
        </div>
      </div>

      {/* ── 3. Search & Filter Bar ── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between hairline-bottom bg-linen/20 p-2 sm:px-6 select-none gap-2 text-xs">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-steel pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search findings by technique, endpoint, or ID [/]"
            className="w-full pl-9 pr-8 py-1.5 bg-ivory border border-hairline text-xs font-mono text-slate placeholder:text-taupe focus:border-slate focus:outline-none shadow-2xs"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-steel hover:text-slate"
            >
              <X size={12} />
            </button>
          )}
        </div>

        {/* Severity Filter — Vertical Line Hierarchy */}
        <div className="flex items-center gap-2 font-mono text-[10px] overflow-x-auto">
          <span className="text-taupe uppercase text-[9px] tracking-wider">SEVERITY:</span>
          {['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((lvl, idx) => (
            <React.Fragment key={lvl}>
              {idx > 0 && <span className="h-3 w-px bg-hairline" />}
              <button
                onClick={() => setSeverityFilter(lvl)}
                className={`transition-colors cursor-pointer uppercase tracking-wider ${
                  severityFilter === lvl
                    ? 'text-slate font-bold'
                    : 'text-taupe hover:text-slate'
                }`}
              >
                {lvl}
              </button>
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* ── 4. Findings Table ── */}
      {loading ? (
        <div className="py-16 text-center text-xs text-steel">LOADING FINDINGS DOSSIERS</div>
      ) : filteredFindings.length > 0 ? (
        <div className="w-full hairline-bottom select-none font-mono" role="region" aria-label="Findings Table">
          {/* Table Headers */}
          <div className="hidden md:grid md:grid-cols-[60px_1fr_180px_120px_90px_40px] items-center p-0 hairline-bottom bg-linen/30 text-xs font-semibold uppercase text-steel">
            <div className="p-3 md:p-4 hairline-right">#</div>
            <div className="p-3 md:p-4 hairline-right">TECHNIQUE &amp; PROVENANCE</div>
            <div className="p-3 md:p-4 hairline-right">TARGET ENDPOINT</div>
            <div className="p-3 md:p-4 hairline-right text-center">SEVERITY</div>
            <div className="p-3 md:p-4 hairline-right text-center">PIN</div>
            <div className="p-3 md:p-4 text-center"><span className="sr-only">Expand</span></div>
          </div>

          {/* Rows */}
          <div className="divide-y divide-hairline">
            {filteredFindings.map((f, idx) => {
              const indexStr = String(idx + 1).padStart(2, '0');
              const severityVariant = getSeverityVariant(f.severity);
              const isExpanded = expandedFinding === f.id;
              const isPinned = pinnedIds.has(f.id);

              return (
                <div key={f.id || idx} className="bg-ivory">
                  <div className="grid grid-cols-1 md:grid-cols-[60px_1fr_180px_120px_90px_40px] items-center p-0 group">
                    {/* Index */}
                    <div className="p-3 md:p-4 text-sm font-mono text-steel md:hairline-right select-none">
                      {indexStr}
                    </div>

                    {/* Technique */}
                    <div
                      onClick={() => toggleExpand(f.id)}
                      className="p-3 md:p-4 md:hairline-right min-w-0 cursor-pointer"
                    >
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

                    {/* Pin Action */}
                    <div className="p-3 md:p-4 md:hairline-right text-left md:text-center">
                      <button
                        onClick={() => handleTogglePin(f.id)}
                        className={`inline-flex items-center gap-1 px-2 py-1 text-[10px] font-bold uppercase transition-colors cursor-pointer border ${
                          isPinned
                            ? 'bg-slate text-parchment border-slate shadow-xs'
                            : 'bg-linen/40 text-steel border-hairline hover:bg-linen hover:text-slate'
                        }`}
                        title={isPinned ? 'Unpin from Investigation Board' : 'Pin to Investigation Board'}
                      >
                        {isPinned ? <Check size={10} /> : <Pin size={10} />}
                        <span>{isPinned ? 'PINNED' : 'PIN'}</span>
                      </button>
                    </div>

                    {/* Expand Icon */}
                    <div
                      onClick={() => toggleExpand(f.id)}
                      className="p-3 md:p-4 text-center text-steel group-hover:text-slate cursor-pointer"
                    >
                      {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                    </div>
                  </div>

                  {/* Expanded Evidence Dossier */}
                  {isExpanded && (
                    <div className="p-6 bg-linen/50 hairline-top space-y-4 font-mono text-xs animate-fade-in">
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
        </div>
      ) : (
        <div className="py-16 px-6 text-center font-mono select-none hairline-bottom bg-linen/20">
          <Filter className="w-5 h-5 text-steel/50 mx-auto mb-2" strokeWidth={1.5} />
          <p className="text-xs font-bold uppercase text-slate">NO FINDINGS MATCHING CURRENT CRITERIA</p>
          <p className="text-[11px] text-steel mt-1 max-w-md mx-auto">
            Breakthrough findings and evasion discoveries from evaluation campaigns will appear here.
          </p>
        </div>
      )}
    </section>
  );
}
