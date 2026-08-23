import React from 'react';

// ── Canonical hairline segment filter ─────────────────────────────────────────
// One primitive for every "vertical-line separated option row" in the product:
// Mission Control status pills, severity segments (Findings), risk segments
// (Campaigns), disposition segments (Investigation). Previously four
// hand-rolled copies with drifting styling.

export interface SegmentOption {
  id: string;
  label: string;
  count?: number;
  /** Tailwind dot class, e.g. 'bg-maroon'. Omit for label-only segments. */
  dot?: string;
}

interface SegmentFilterProps {
  options: SegmentOption[];
  value: string;
  onChange: (id: string) => void;
  /** Leading muted label, e.g. "MIN RISK:" */
  leadingLabel?: string;
  className?: string;
  ariaLabel?: string;
}

export const SegmentFilter: React.FC<SegmentFilterProps> = ({
  options,
  value,
  onChange,
  leadingLabel,
  className = '',
  ariaLabel = 'Filter segments',
}) => {
  return (
    <div
      className={`flex items-center gap-2.5 font-mono text-[10px] ${className}`}
      role="tablist"
      aria-label={ariaLabel}
    >
      {leadingLabel && (
        <span className="text-taupe uppercase text-[9px] tracking-wider shrink-0">
          {leadingLabel}
        </span>
      )}
      {options.map((opt, idx) => {
        const isActive = value === opt.id;
        return (
          <React.Fragment key={opt.id}>
            {idx > 0 && <span className="h-3 w-px bg-hairline" />}
            <button
              onClick={() => onChange(opt.id)}
              className={`flex items-center gap-1.5 transition-colors cursor-pointer uppercase tracking-wider whitespace-nowrap ${
                isActive ? 'text-slate font-bold' : 'text-taupe hover:text-slate'
              }`}
              role="tab"
              aria-selected={isActive}
            >
              {opt.dot && <span className={`w-1.5 h-1.5 rounded-full ${opt.dot}`} />}
              <span>{opt.label}</span>
              {opt.count !== undefined && (
                <span className={`tabular-nums text-[9px] ${isActive ? 'text-slate font-bold' : 'text-taupe'}`}>
                  {opt.count}
                </span>
              )}
            </button>
          </React.Fragment>
        );
      })}
    </div>
  );
};
