import React from 'react';
import { Terminal, Plus } from 'lucide-react';

interface EmptyBufferProps {
  title?: string;
  command?: string;
  lines?: string[];
  action?: {
    label: string;
    onClick: () => void;
  };
  note?: string;
}

export const EmptyBuffer: React.FC<EmptyBufferProps> = ({
  title = 'OBSERVATION_BUFFER [EVENT_LISTENER]',
  command = '$ valerie listen --stream all --domain all',
  lines = [
    '[INIT] Event stream observation listener connected to Redis Streams bus.',
    '[STATUS] Awaiting dispatched attack branches from target evaluation runs.',
    '[SYS] Ready to capture prompt mutations, judge scores, and breakthrough findings.',
  ],
  action,
  note,
}) => {
  return (
    <div className="bg-ivory border border-hairline p-6 md:p-8 font-mono select-none shadow-xs">
      {/* Header bar */}
      <div className="flex items-center justify-between text-[11px] text-steel hairline-bottom pb-3 mb-5">
        <div className="flex items-center gap-2">
          <Terminal size={14} className="text-slate" />
          <span className="font-bold text-slate uppercase">{title}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-olive animate-pulse" />
          <span className="text-taupe uppercase text-[10px]">VALERIE [v0.1.2]</span>
        </div>
      </div>

      {/* Terminal execution log */}
      <div className="p-4 bg-linen/50 border border-hairline text-xs leading-relaxed space-y-2">
        <p className="font-bold text-slate flex items-center gap-2">
          <span>{command}</span>
          <span className="w-1.5 h-3.5 bg-slate animate-pulse inline-block align-middle" />
        </p>
        <div className="text-steel space-y-1 text-[11px]">
          {lines.map((line, idx) => (
            <p key={idx} className="font-mono">
              {line}
            </p>
          ))}
        </div>
      </div>

      {/* Action / Guidance Footer */}
      {(action || note) && (
        <div className="mt-5 pt-4 hairline-top flex flex-wrap items-center justify-between gap-4">
          {action && (
            <button
              onClick={action.onClick}
              className="flex items-center gap-2 px-4 py-2 bg-slate text-parchment font-mono text-xs font-bold uppercase transition-colors hover:bg-slate/90 shadow-xs cursor-pointer"
            >
              <Plus size={13} strokeWidth={2.5} />
              <span>{action.label}</span>
            </button>
          )}
          {note && <span className="text-[11px] font-mono text-taupe">{note}</span>}
        </div>
      )}
    </div>
  );
};
