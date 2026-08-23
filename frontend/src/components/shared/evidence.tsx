import { useCallback, useState } from 'react';
import { Copy, Check } from 'lucide-react';
import type { VectorScores } from '../../types/domain';

// ── Shared evidence primitives ────────────────────────────────────────────────
// The single rendering implementation for task-evidence atoms, consumed by
// BOTH the Mission Control dossier (mission-control/TaskInspector) and the
// graph node inspector (graph/v2/Inspector). Previously two divergent copies —
// one of which fabricated data when fields were missing.

// ── Copyable code block ───────────────────────────────────────────────────────
export function CodeBlock({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(() => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [text]);

  return (
    <div className="bg-linen p-3 relative group border border-hairline">
      <pre className="font-mono text-[11px] text-slate whitespace-pre-wrap break-words leading-relaxed max-h-48 overflow-y-auto">
        {text}
      </pre>
      <button
        onClick={copy}
        className="absolute top-2 right-2 flex items-center gap-1 font-mono text-[8px] tracking-wider text-steel hover:text-slate transition-colors opacity-0 group-hover:opacity-100 bg-ivory/80 px-1 py-0.5 border border-hairline"
        aria-label={`Copy ${label}`}
      >
        {copied ? <Check size={10} className="text-olive" /> : <Copy size={10} />}
        {copied ? 'COPIED' : 'COPY'}
      </button>
    </div>
  );
}

// ── Vector fingerprint chart ──────────────────────────────────────────────────
// Renders ONLY measured scores. When none exist it says so — it never
// synthesises values from risk_score (the fabrication is gone by design).
export function VectorScoresChart({ scores }: { scores: VectorScores | undefined }) {
  const dims = Object.entries(scores ?? {})
    .filter(([, v]) => typeof v === 'number' && !isNaN(v as number))
    .sort(([, a], [, b]) => (b ?? 0) - (a ?? 0))
    .slice(0, 10);

  if (dims.length === 0) {
    return (
      <p className="font-mono text-[11px] text-taupe leading-relaxed">
        NO VECTOR TELEMETRY RECORDED FOR THIS SPECIMEN.
      </p>
    );
  }

  return (
    <div className="space-y-1.5">
      {dims.map(([dim, val]) => {
        const score = Number(val) || 0;
        const pct = Math.min(100, Math.round(score * 100));
        const barClass = pct >= 70 ? 'bg-maroon' : pct >= 40 ? 'bg-camel' : 'bg-olive';
        return (
          <div key={dim} className="flex items-center gap-2">
            <span className="font-mono text-[9px] text-steel w-24 shrink-0 truncate uppercase">
              {dim.replace(/_/g, ' ')}
            </span>
            <div className="flex-1 h-1 bg-linen border border-hairline overflow-hidden">
              <div className={`h-full ${barClass} transition-all duration-300`} style={{ width: `${pct}%` }} />
            </div>
            <span className="font-mono text-[10px] font-bold tabular-nums text-slate w-8 text-right">
              {score.toFixed(2)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Judge reasoning block ─────────────────────────────────────────────────────
export function JudgeReasoning({ reasoning }: { reasoning: string | undefined }) {
  if (!reasoning) {
    return (
      <p className="font-mono text-[11px] text-taupe leading-relaxed">
        NO JUDGE RATIONALE RECORDED FOR THIS ITERATION.
      </p>
    );
  }
  return (
    <blockquote className="font-sans text-xs text-slate italic leading-relaxed border-l-2 border-camel pl-3 whitespace-pre-wrap">
      {reasoning}
    </blockquote>
  );
}
