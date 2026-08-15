import React from 'react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}

export function PageHeader({ title, subtitle, action }: PageHeaderProps) {
  return (
    <header className="py-6 hairline-bottom flex flex-col sm:flex-row sm:items-end justify-between gap-4 select-none">
      <div className="flex flex-col min-w-0">
        <h1 className="text-3xl md:text-4xl font-medium tracking-tight text-slate uppercase truncate">
          {title}
        </h1>
        {subtitle && (
          <p className="text-xs font-mono text-steel tracking-widest font-normal uppercase mt-1 truncate">
            {subtitle.startsWith('//') ? subtitle : `// ${subtitle}`}
          </p>
        )}
      </div>
      {action && <div className="shrink-0 flex items-center gap-3 self-start sm:self-auto">{action}</div>}
    </header>
  );
}
