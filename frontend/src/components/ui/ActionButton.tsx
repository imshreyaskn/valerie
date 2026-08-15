import React from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'olive' | 'maroon';

interface ActionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  icon?: React.ReactNode;
  children: React.ReactNode;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:   'bg-slate text-parchment hover:bg-slate/90 border-transparent',
  secondary: 'border border-hairline bg-cream text-slate hover:bg-slate hover:text-parchment',
  danger:    'bg-maroon text-parchment hover:opacity-90 border-transparent',
  maroon:    'bg-maroon text-parchment hover:opacity-90 border-transparent',
  olive:     'bg-olive text-parchment hover:opacity-90 border-transparent',
  ghost:     'border border-hairline bg-transparent text-steel hover:text-slate hover:bg-linen/50',
};

export const ActionButton: React.FC<ActionButtonProps> = ({
  variant = 'primary',
  icon,
  children,
  className = '',
  disabled,
  ...props
}) => {
  return (
    <button
      className={[
        'inline-flex items-center justify-center gap-2 px-5 py-2.5 font-mono text-xs font-bold uppercase transition-colors disabled:opacity-50 select-none cursor-pointer',
        variantStyles[variant],
        className,
      ].join(' ')}
      disabled={disabled}
      {...props}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      <span>{children}</span>
    </button>
  );
};
