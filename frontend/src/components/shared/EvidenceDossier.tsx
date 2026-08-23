import React from 'react';
import type { Finding } from '../../types/domain';

// ── Shared evidence dossier ───────────────────────────────────────────────────
// The expandable forensic dossier rendered beneath a finding row. One
// implementation for every surface that shows finding evidence (previously
// duplicated verbatim between Findings and KnowledgeBase).

interface EvidenceDossierProps {
  finding: Finding;
}

export const EvidenceDossier: React.FC<EvidenceDossierProps> = ({ finding }) => {
  return (
    <div className="p-6 bg-linen/50 hairline-top space-y-4 font-mono text-xs">
      <div className="flex items-center justify-between pb-2 hairline-bottom">
        <span className="font-bold text-slate uppercase text-xs">
          EVIDENCE DOSSIER // RISK SEVERITY SCORE: {finding.score?.toFixed(2) || '—'}
        </span>
        <span className="text-steel text-[11px]">
          TIMESTAMP: {new Date(finding.created_at || Date.now()).toLocaleString()}
        </span>
      </div>

      {finding.evidence && finding.evidence.length > 0 ? (
        <div className="space-y-2">
          {finding.evidence.map((ev, evIdx) => (
            <div key={evIdx} className="p-3 bg-ivory border border-hairline space-y-1">
              <span className="font-bold text-slate uppercase text-[10px] block">[{ev.type}]:</span>
              {ev.payload?.tokens != null && (
                <p className="text-slate font-mono leading-relaxed whitespace-pre-wrap">{String(ev.payload.tokens)}</p>
              )}
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
  );
};

// Severity → badge variant mapping. Previously duplicated in two pages.
export function getSeverityVariant(severity: string | undefined): 'maroon' | 'camel' | 'powder' {
  const s = severity?.toLowerCase();
  if (s === 'critical' || s === 'high') return 'maroon';
  if (s === 'medium' || s === 'warning') return 'camel';
  return 'powder';
}
