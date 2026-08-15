import React from 'react';

export type BadgeVariant = 'default' | 'success' | 'danger' | 'warning' | 'info' | 'olive' | 'maroon' | 'camel' | 'powder';

interface StatusBadgeProps {
  label: string;
  variant?: BadgeVariant;
  pulse?: boolean;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: 'bg-linen text-slate border-hairline',
  success: 'bg-olive text-parchment border-olive',
  olive:   'bg-olive text-parchment border-olive',
  danger:  'bg-maroon text-parchment border-maroon',
  maroon:  'bg-maroon text-parchment border-maroon',
  warning: 'bg-camel text-parchment border-camel',
  camel:   'bg-camel text-parchment border-camel',
  info:    'bg-powder text-slate font-bold border-powder',
  powder:  'bg-powder text-slate font-bold border-powder',
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  label,
  variant = 'default',
  pulse = false,
  className = '',
}) => {
  return (
    <span
      className={[
        'inline-flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 border select-none',
        variantStyles[variant],
        className,
      ].join(' ') }
      role="status"
    >
      {pulse && (
        <span
          className="w-1.5 h-1.5 rounded-full bg-current animate-pulse-dot"
          aria-hidden="true"
        />
      )}
      <span>{label}</span>
    </span>
  );
};
