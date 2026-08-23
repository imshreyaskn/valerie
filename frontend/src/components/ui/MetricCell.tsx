import React from 'react';

export type MetricTone = 'default' | 'danger' | 'success' | 'warning' | 'maroon' | 'olive' | 'camel' | 'powder' | 'static';

export interface MetricCellProps {
  index: string;
  label: string;
  /** Pre-rendered value node (number, string, or JSX for dot/pulse treatments). */
  value: React.ReactNode;
  sublabel?: React.ReactNode;
  variant?: MetricTone;
  className?: string;
}

const TONE_CLASS: Record<MetricTone, string> = {
  default: 'text-slate',
  static: 'text-slate',
  maroon: 'text-maroon',
  danger: 'text-maroon',
  olive: 'text-olive',
  success: 'text-olive',
  camel: 'text-camel',
  warning: 'text-camel',
  powder: 'text-powder',
};

/**
 * Single numbered telemetry cell (1.01 …). The row container owns layout and
 * padding via `className`; this component owns only cell anatomy.
 *
 * Tone semantics:
 *  - data tones (maroon/olive/camel/powder) colour by measured state;
 *  - `static` marks configuration facts that must never read as live metrics.
 */
export function MetricCell({
  index,
  label,
  value,
  sublabel,
  variant = 'default',
  className = '',
}: MetricCellProps) {
  return (
    <div
      className={`flex flex-col justify-between transition-colors hover:bg-linen/40 ${className}`}
    >
      <div>
        <div className={`font-mono text-steel mb-1 ${variant === 'static' ? 'text-xs' : 'text-xs'}`}>{index}</div>
        <div className="text-xs font-semibold uppercase tracking-[0.02em] text-slate mb-2">
          {label}
        </div>
      </div>
      <div>
        <div
          className={`font-mono text-2xl md:text-3xl font-bold tabular-nums leading-none ${
            TONE_CLASS[variant]
          }`}
        >
          {value}
        </div>
        {sublabel && (
          <div className="text-[10px] font-mono text-steel mt-2 uppercase truncate">{sublabel}</div>
        )}
      </div>
    </div>
  );
}
