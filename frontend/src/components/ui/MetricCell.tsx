interface MetricCellProps {
  index: string;
  label: string;
  value: string | number;
  sublabel?: string;
  variant?: 'default' | 'danger' | 'success' | 'warning' | 'maroon' | 'olive' | 'camel' | 'powder';
  borderRight?: boolean;
  borderTop?: boolean;
}

export function MetricCell({
  index,
  label,
  value,
  sublabel,
  variant = 'default',
  borderRight = true,
  borderTop = false,
}: MetricCellProps) {
  const valueColor =
    variant === 'danger' || variant === 'maroon'  ? 'text-maroon'  :
    variant === 'success' || variant === 'olive'  ? 'text-olive'   :
    variant === 'warning' || variant === 'camel'  ? 'text-camel'   :
    variant === 'powder'                          ? 'text-powder'  :
    'text-slate';

  return (
    <div
      className={[
        'p-4 md:p-6 flex flex-col justify-between transition-colors hover:bg-linen/40',
        borderRight ? 'md:hairline-right' : '',
        borderTop ? 'max-md:hairline-top' : '',
      ].join(' ')}
    >
      <div>
        <div className="text-sm font-mono text-steel mb-1">{index}</div>
        <div className="text-sm font-semibold uppercase tracking-[0.02em] text-slate mb-2">
          {label}
        </div>
      </div>
      <div>
        <div className={`font-mono text-[1.75rem] font-bold ${valueColor} tabular-nums leading-none`}>
          {value}
        </div>
        {sublabel && (
          <div className="text-[0.75rem] font-mono text-steel mt-2 uppercase truncate">
            {sublabel}
          </div>
        )}
      </div>
    </div>
  );
}
