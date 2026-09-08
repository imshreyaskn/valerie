import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { api } from '../utils/api';
import { pinFindingAsCase, unpinCase, getInvestigationCases } from '../utils/investigationCases';
import { Search, ChevronDown, ChevronUp, X, Filter, Pin, Check, RefreshCw } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { PageHeader, StatusBadge, ActionButton, AnimatedNumber } from '../components/ui';
import { TelemetryRow } from '../components/ui/TelemetryRow';
import { SegmentFilter } from '../components/ui/SegmentFilter';
import { EvidenceDossier, getSeverityVariant } from '../components/shared/EvidenceDossier';
import { useHotkeyFocus } from '../hooks/useHotkeyFocus';
import { useCachedQuery, invalidate } from '../utils/queryCache';
import type { Finding } from '../types/domain';

const INITIAL_CHUNK = 20;
const CHUNK_INCREMENT = 20;

interface FindingRowProps {
  finding: Finding;
  index: number;
  isExpanded: boolean;
  isPinned: boolean;
  onToggleExpand: (id: string) => void;
  onTogglePin: (id: string) => void;
}

const FindingRow = React.memo<FindingRowProps>(
  ({ finding: f, index, isExpanded, isPinned, onToggleExpand, onTogglePin }) => {
    const indexStr = String(index + 1).padStart(2, '0');
    const severityVariant = getSeverityVariant(f.severity);

    return (
      <div className="bg-ivory transition-colors">
        <div className="grid grid-cols-1 md:grid-cols-[60px_1fr_180px_120px_90px_40px] items-center p-0 group hover:bg-linen/30 transition-colors">
          {/* Index */}
          <div className="p-3 md:p-4 text-sm font-mono text-steel md:hairline-right select-none">
            {indexStr}
          </div>

          {/* Technique */}
          <div
            onClick={() => onToggleExpand(f.id)}
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
              onClick={() => onTogglePin(f.id)}
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
            onClick={() => onToggleExpand(f.id)}
            className="p-3 md:p-4 text-center text-steel group-hover:text-slate cursor-pointer"
          >
            {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </div>
        </div>

        {/* Expanded Evidence Dossier (deferred/lazy mount) */}
        {isExpanded && <EvidenceDossier finding={f} />}
      </div>
    );
  },
  (prev, next) =>
    prev.finding === next.finding &&
    prev.isExpanded === next.isExpanded &&
    prev.isPinned === next.isPinned &&
    prev.index === next.index
);

FindingRow.displayName = 'FindingRow';

export default function Findings() {
  const navigate = useNavigate();
  const location = useLocation();

  // Cluster deep-link: the Weaknesses atlas navigates here with a pinned
  // cluster scope so knowledge connects to evidence in one click.
  const clusterScope = (location.state ?? null) as
    | { clusterName?: string; findingIds?: string[] }
    | null;
  const clusterIdSet = useMemo(
    () => new Set(clusterScope?.findingIds ?? []),
    [clusterScope]
  );

  const [searchQuery, setSearchQuery] = useState('');
  const [expandedFinding, setExpandedFinding] = useState<string | null>(null);
  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set());
  const [visibleCount, setVisibleCount] = useState(INITIAL_CHUNK);

  const searchInputRef = useRef<HTMLInputElement>(null);
  useHotkeyFocus(searchInputRef);

  const findingsResource = useCachedQuery('findings:ledger', () => api.getFindings(100, 0));
  const findings: Finding[] = useMemo(() => findingsResource.data?.findings ?? [], [findingsResource.data]);
  const loading = findingsResource.loading && findings.length === 0;
  const loadError = findingsResource.error && findings.length === 0
    ? 'Could not load findings. Check your connection and retry.'
    : null;

  useEffect(() => {
    // Invalidate and reload fresh findings from backend on mount
    invalidate('findings');
    findingsResource.reload();
  }, []);

  useEffect(() => {
    setPinnedIds(new Set(getInvestigationCases().map((c) => c.id)));
  }, [findingsResource.data]);

  // Re-sync pin state when cases change on the Investigation Board.
  useEffect(() => {
    const sync = () => setPinnedIds(new Set(getInvestigationCases().map((c) => c.id)));
    window.addEventListener('valerie-investigation-cases-changed', sync);
    window.addEventListener('focus', sync);
    return () => {
      window.removeEventListener('valerie-investigation-cases-changed', sync);
      window.removeEventListener('focus', sync);
    };
  }, []);

  const toggleExpand = useCallback((id: string) => {
    setExpandedFinding((prev) => (prev === id ? null : id));
  }, []);

  const handleTogglePin = useCallback((id: string) => {
    setPinnedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        unpinCase(id);
      } else {
        next.add(id);
        const finding = findings.find((f) => f.id === id);
        if (finding) pinFindingAsCase(finding);
      }
      return next;
    });
  }, [findings]);

  const filteredFindings = useMemo(() => {
    return findings.filter((f) => {
      if (clusterIdSet.size > 0 && !clusterIdSet.has(f.id)) return false;
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
  }, [findings, severityFilter, searchQuery, clusterIdSet]);

  // Reset smooth escalation chunk count on filter change
  useEffect(() => {
    setVisibleCount(INITIAL_CHUNK);
  }, [searchQuery, severityFilter, clusterIdSet]);

  // Smooth Escalation: Visible slice
  const visibleFindings = useMemo(
    () => filteredFindings.slice(0, visibleCount),
    [filteredFindings, visibleCount]
  );

  // Sentinel for smooth infinite escalation on scroll
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || visibleCount >= filteredFindings.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleCount((prev) => Math.min(prev + CHUNK_INCREMENT, filteredFindings.length));
        }
      },
      { rootMargin: '300px' }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [visibleCount, filteredFindings.length]);

  const totalBreakthroughs = useMemo(
    () => findings.filter((f) => f.is_breakthrough).length,
    [findings]
  );

  const handleExportCSV = () => {
    if (filteredFindings.length === 0) return;
    const headers = ['ID', 'Run ID', 'Endpoint', 'Technique', 'Severity', 'Breakthrough', 'Risk Score', 'Created At'];
    const rows = filteredFindings.map((f) => [
      `"${f.id}"`,
      `"${f.run_id}"`,
      `"${f.endpoint_id || ''}"`,
      `"${f.technique_id || ''}"`,
      `"${f.severity || ''}"`,
      `"${f.is_breakthrough ? 'YES' : 'NO'}"`,
      `"${f.score?.toFixed(2) || (f as any).verdict?.overall_risk_score || '0.00'}"`,
      `"${f.created_at || ''}"`,
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `valerie-findings-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExportJSON = () => {
    if (filteredFindings.length === 0) return;
    const blob = new Blob([JSON.stringify(filteredFindings, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `valerie-findings-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const clearClusterScope = () => {
    navigate('/dashboard/findings', { replace: true, state: null });
  };

  return (
    <section className="flex flex-col w-full hairline-bottom animate-fade-in pb-16 font-mono select-none" aria-label="Breakthrough Findings">
      {/* ── 1. Page Header ── */}
      <PageHeader
        title="FINDINGS EXPLORER"
        subtitle="CONFIRMED BREAKTHROUGHS, EXPLOIT EVIDENCE DOSSIERS &amp; DISPOSITION TRIAGE"
        action={
          <div className="flex items-center gap-2">
            <ActionButton
              variant="secondary"
              icon={<RefreshCw size={13} className={findingsResource.loading ? 'animate-spin' : ''} />}
              onClick={() => {
                invalidate('findings');
                findingsResource.reload();
              }}
              title="Refresh findings ledger"
            >
              SYNC DOSSIERS
            </ActionButton>
            <ActionButton
              variant="secondary"
              onClick={handleExportCSV}
              title="Export filtered findings as CSV"
            >
              EXPORT CSV
            </ActionButton>
            <ActionButton
              variant="secondary"
              onClick={handleExportJSON}
              title="Export filtered findings as JSON"
            >
              JSON
            </ActionButton>
            <ActionButton
              variant="secondary"
              icon={<Pin size={14} />}
              onClick={() => navigate('/dashboard/investigation')}
            >
              VIEW PINNED BOARD ({pinnedIds.size})
            </ActionButton>
          </div>
        }
      />

      {/* ── 2. Telemetry Row (with AnimatedNumber) ── */}
      <TelemetryRow
        ariaLabel="Findings metrics"
        cells={[
          {
            index: '1.01',
            label: 'TOTAL FINDINGS',
            value: (
              <>
                <AnimatedNumber value={findings.length} />
                <span className="text-steel text-sm font-normal"> DOSSIERS</span>
              </>
            ),
            sublabel: 'INDEXED SECURITY SPECIMENS',
          },
          {
            index: '1.02',
            label: 'CRITICAL BREACHES',
            variant: totalBreakthroughs > 0 ? 'maroon' : 'default',
            value: (
              <span className={`flex items-center gap-1.5 ${totalBreakthroughs > 0 ? 'text-maroon' : 'text-slate'}`}>
                {totalBreakthroughs > 0 && <span className="text-sm">◆</span>}
                <AnimatedNumber value={totalBreakthroughs} />
              </span>
            ),
            sublabel: 'THRESHOLD-CROSSING EXPLOITS',
          },
          {
            index: '1.03',
            label: 'PINNED FOR INVESTIGATION',
            value: (
              <>
                <AnimatedNumber value={pinnedIds.size} />
                <span className="text-steel text-sm font-normal"> PINNED</span>
              </>
            ),
            sublabel: 'READY FOR FORENSIC CASE STUDY',
          },
          {
            index: '1.04',
            label: 'EVIDENCE PROVENANCE',
            variant: 'static',
            value: <span className="text-slate">SHA-256</span>,
            sublabel: 'HASH-CHAINED AUDIT TRAIL',
          },
        ]}
      />

      {/* ── 3. Search & Filter Bar ── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between hairline-bottom bg-linen/20 p-2 sm:px-6 gap-2 text-xs">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-steel pointer-events-none" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search findings by technique, endpoint, or ID [/]"
            className="w-full pl-9 pr-8 py-1.5 bg-ivory border border-hairline text-xs font-mono text-slate placeholder:text-taupe focus:border-slate focus:outline-none shadow-2xs"
            aria-label="Search findings"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-steel hover:text-slate"
              aria-label="Clear search"
            >
              <X size={12} />
            </button>
          )}
        </div>

        <SegmentFilter
          leadingLabel="SEVERITY:"
          ariaLabel="Filter by severity"
          value={severityFilter}
          onChange={setSeverityFilter}
          options={[
            { id: 'ALL', label: 'ALL' },
            { id: 'CRITICAL', label: 'CRITICAL' },
            { id: 'HIGH', label: 'HIGH' },
            { id: 'MEDIUM', label: 'MEDIUM' },
            { id: 'LOW', label: 'LOW' },
          ]}
        />
      </div>

      {/* ── 4. Cluster Scope Chip ── */}
      {clusterScope?.clusterName && (
        <div className="flex items-center justify-between px-4 py-2 bg-camel-muted hairline-bottom font-mono text-[11px]">
          <span className="text-brown font-bold uppercase tracking-wider">
            CLUSTER SCOPE: {clusterScope.clusterName.toUpperCase()} ({filteredFindings.length} MATCHES)
          </span>
          <button
            onClick={clearClusterScope}
            className="flex items-center gap-1 text-brown hover:text-maroon uppercase font-bold cursor-pointer"
          >
            <X size={12} />
            CLEAR SCOPE
          </button>
        </div>
      )}

      {/* ── 5. Findings Table with Smooth Escalation ── */}
      {loading ? (
        <div className="py-16 text-center text-xs text-steel">LOADING FINDINGS DOSSIERS</div>
      ) : loadError ? (
        <div className="mx-4 my-6 border border-maroon/40 bg-maroon/5 p-4 text-center">
          <p className="text-xs font-bold uppercase text-maroon">{loadError}</p>
          <button
            onClick={() => findingsResource.reload()}
            className="mt-2 text-[10px] font-bold uppercase tracking-widest text-steel underline hover:text-slate"
          >
            Retry
          </button>
        </div>
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

          {/* Rows rendered via Smooth Escalation */}
          <div className="divide-y divide-hairline">
            {visibleFindings.map((f, idx) => (
              <FindingRow
                key={f.id || idx}
                finding={f}
                index={idx}
                isExpanded={expandedFinding === f.id}
                isPinned={pinnedIds.has(f.id)}
                onToggleExpand={toggleExpand}
                onTogglePin={handleTogglePin}
              />
            ))}
          </div>

          {/* Smooth Escalation Intersection Sentinel */}
          {visibleCount < filteredFindings.length && (
            <div
              ref={sentinelRef}
              className="py-4 text-center text-[10px] text-taupe font-mono uppercase tracking-wider bg-linen/20"
            >
              ESCALATING DOSSIERS ({visibleCount} OF {filteredFindings.length})...
            </div>
          )}
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

