import React from 'react';
import { motion } from 'framer-motion';

export type MetricTone = 'default' | 'danger' | 'success' | 'warning' | 'maroon' | 'olive' | 'camel' | 'powder' | 'static';

export interface MetricCellProps {
  index: string;
  label: string;
  /** Pre-rendered value node (number, string, or JSX for dot/pulse treatments). */
  value: React.ReactNode;
  sublabel?: React.ReactNode;
  variant?: MetricTone;
  className?: string;
  onClick?: () => void;
  title?: string;
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
 * Single numbered telemetry cell (1.01 …) with Notion-grade fluid micro-interactions.
 */
export function MetricCell({
  index,
  label,
  value,
  sublabel,
  variant = 'default',
  className = '',
  onClick,
  title,
}: MetricCellProps) {
  const isClickable = Boolean(onClick);

  return (
    <motion.div
      whileHover={isClickable ? { y: -2, backgroundColor: 'rgba(237, 230, 223, 0.7)' } : { backgroundColor: 'rgba(237, 230, 223, 0.4)' }}
      whileTap={isClickable ? { scale: 0.98 } : undefined}
      transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
      onClick={onClick}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={
        isClickable
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
      title={title}
      className={`flex flex-col justify-between select-none ${
        isClickable
          ? 'cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate group'
          : ''
      } ${className}`}
    >
      <div>
        <div className="flex items-center justify-between font-mono text-steel mb-1 text-xs">
          <span className="font-semibold text-[11px] text-taupe">{index}</span>
          {isClickable && (
            <span className="text-[9px] font-mono uppercase font-bold text-steel/60 group-hover:text-slate transition-colors flex items-center gap-1">
              <span>RUN</span>
              <span className="text-[10px]">↵</span>
            </span>
          )}
        </div>
        <div className="text-xs font-semibold uppercase tracking-[0.02em] text-slate mb-2">
          {label}
        </div>
      </div>
      <div>
        <div
          className={`font-mono text-2xl md:text-3xl font-bold tabular-nums leading-none transition-colors duration-200 ${
            TONE_CLASS[variant]
          }`}
        >
          {value}
        </div>
        {sublabel && (
          <div className="text-[10px] font-mono text-steel mt-2 uppercase truncate">{sublabel}</div>
        )}
      </div>
    </motion.div>
  );
}
