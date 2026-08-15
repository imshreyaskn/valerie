import React from 'react';
import type { TaskStatus } from '../../types/domain';

interface TaskStateBadgeProps {
  status: TaskStatus | string;
  isBreakthrough?: boolean;
  pulse?: boolean;
  className?: string;
  showIcon?: boolean;
}

/**
 * TaskStateBadge — Canonical 6-state status machine badge for Valerie.
 * Strictly adheres to Section 4.5 of the Valerie Visual Specification:
 * - Exact casing: QUEUED, MUTATING, TRANSMITTING, SCORING, BREAKTHROUGH, DEFENDED, UNRESOLVED.
 * - Tri-channel risk encoding: distinct shape/icon + exact text label + tonal/chromatic accent.
 */
export const TaskStateBadge: React.FC<TaskStateBadgeProps> = ({
  status,
  isBreakthrough = false,
  pulse = false,
  className = '',
  showIcon = true,
}) => {
  // Normalize status mapping
  let normalizedStatus: 'QUEUED' | 'MUTATING' | 'TRANSMITTING' | 'SCORING' | 'BREAKTHROUGH' | 'DEFENDED' | 'UNRESOLVED' = 'QUEUED';

  if (isBreakthrough || status === 'breakthrough') {
    normalizedStatus = 'BREAKTHROUGH';
  } else {
    switch (status?.toLowerCase()) {
      case 'dispatched':
      case 'queued':
        normalizedStatus = 'QUEUED';
        break;
      case 'generating':
      case 'mutating':
        normalizedStatus = 'MUTATING';
        break;
      case 'querying':
      case 'transmitting':
        normalizedStatus = 'TRANSMITTING';
        break;
      case 'judging':
      case 'scoring':
        normalizedStatus = 'SCORING';
        break;
      case 'completed':
      case 'defended':
        normalizedStatus = 'DEFENDED';
        break;
      case 'failed':
      case 'unresolved':
      case 'error':
        normalizedStatus = 'UNRESOLVED';
        break;
      default:
        normalizedStatus = 'QUEUED';
    }
  }

  // Render specific shape icon and styling based on state
  switch (normalizedStatus) {
    case 'BREAKTHROUGH':
      return (
        <span
          className={`inline-flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 border bg-maroon text-parchment border-maroon shadow-xs select-none ${className}`}
          role="status"
          aria-label="Status: BREAKTHROUGH (Confirmed Breach)"
        >
          {showIcon && (
            <svg className="w-2.5 h-2.5 fill-current shrink-0" viewBox="0 0 16 16" aria-hidden="true">
              {/* Diamond with exclamation mark */}
              <polygon points="8,1 15,8 8,15 1,8" fill="currentColor" stroke="currentColor" strokeWidth="1" />
              <rect x="7" y="4" width="2" height="4.5" fill="#F6F2EE" />
              <circle cx="8" cy="11" r="1" fill="#F6F2EE" />
            </svg>
          )}
          <span>BREAKTHROUGH</span>
        </span>
      );

    case 'DEFENDED':
      return (
        <span
          className={`inline-flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 border bg-olive text-parchment border-olive select-none ${className}`}
          role="status"
          aria-label="Status: DEFENDED (Attack Repelled)"
        >
          {showIcon && (
            <svg className="w-2.5 h-2.5 fill-none stroke-current stroke-[2.2] shrink-0" viewBox="0 0 16 16" aria-hidden="true">
              {/* Square with check mark */}
              <rect x="1.5" y="1.5" width="13" height="13" stroke="currentColor" fill="none" rx="1" />
              <polyline points="4.5,8 7,10.5 11.5,5" stroke="currentColor" />
            </svg>
          )}
          <span>DEFENDED</span>
        </span>
      );

    case 'SCORING':
      return (
        <span
          className={`inline-flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 border bg-camel-muted text-brown border-camel select-none ${className}`}
          role="status"
          aria-label="Status: SCORING (Judge Evaluating)"
        >
          {showIcon && (
            <svg className="w-2.5 h-2.5 fill-none stroke-current stroke-[1.8] shrink-0" viewBox="0 0 16 16" aria-hidden="true">
              {/* Bracketed circle */}
              <circle cx="8" cy="8" r="6" stroke="currentColor" />
              <path d="M5 6 L3 6 L3 10 L5 10" stroke="currentColor" />
              <path d="M11 6 L13 6 L13 10 L11 10" stroke="currentColor" />
            </svg>
          )}
          <span className="flex items-center gap-1">
            <span>SCORING</span>
            {pulse && <span className="w-1 h-1 rounded-full bg-camel animate-pulse" />}
          </span>
        </span>
      );

    case 'TRANSMITTING':
      return (
        <span
          className={`inline-flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 border bg-powder-muted text-slate border-powder select-none ${className}`}
          role="status"
          aria-label="Status: TRANSMITTING (Querying Endpoint)"
        >
          {showIcon && (
            <svg className="w-2.5 h-2.5 fill-current shrink-0" viewBox="0 0 16 16" aria-hidden="true">
              {/* Arrowhead / Transmitting radar */}
              <polygon points="2,2 14,8 2,14 5,8" />
            </svg>
          )}
          <span className="flex items-center gap-1">
            <span>TRANSMITTING</span>
            <span className="w-1 h-1 rounded-full bg-powder animate-ping" />
          </span>
        </span>
      );

    case 'MUTATING':
      return (
        <span
          className={`inline-flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 border bg-cream text-slate border-steel/40 select-none ${className}`}
          role="status"
          aria-label="Status: MUTATING (Generating Adversarial Prompt)"
        >
          {showIcon && (
            <svg className="w-2.5 h-2.5 fill-none stroke-current stroke-[1.8] shrink-0" viewBox="0 0 16 16" aria-hidden="true">
              {/* Split circle with sweep */}
              <circle cx="8" cy="8" r="6" stroke="currentColor" />
              <line x1="8" y1="2" x2="8" y2="14" stroke="currentColor" />
              <path d="M8 2 A6 6 0 0 1 14 8 Z" fill="currentColor" opacity="0.4" />
            </svg>
          )}
          <span>MUTATING</span>
        </span>
      );

    case 'UNRESOLVED':
      return (
        <span
          className={`inline-flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 border bg-maroon-muted text-maroon border-maroon/60 select-none ${className}`}
          role="status"
          aria-label="Status: UNRESOLVED (Execution Error / Timeout)"
        >
          {showIcon && (
            <svg className="w-2.5 h-2.5 fill-none stroke-current stroke-[2] shrink-0" viewBox="0 0 16 16" aria-hidden="true">
              {/* Broken square */}
              <path d="M2 5 L2 2 L6 2" />
              <path d="M10 2 L14 2 L14 6" />
              <path d="M14 10 L14 14 L10 14" />
              <path d="M6 14 L2 14 L2 10" />
              <line x1="5" y1="5" x2="11" y2="11" />
            </svg>
          )}
          <span>UNRESOLVED</span>
        </span>
      );

    case 'QUEUED':
    default:
      return (
        <span
          className={`inline-flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 border bg-linen text-steel border-hairline select-none ${className}`}
          role="status"
          aria-label="Status: QUEUED (Pending Dispatch)"
        >
          {showIcon && (
            <svg className="w-2.5 h-2.5 fill-none stroke-current stroke-[1.8] shrink-0" viewBox="0 0 16 16" aria-hidden="true">
              {/* Hollow circle */}
              <circle cx="8" cy="8" r="5.5" stroke="currentColor" />
            </svg>
          )}
          <span>QUEUED</span>
        </span>
      );
  }
};
