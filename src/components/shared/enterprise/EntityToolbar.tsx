import { ReactNode } from 'react';

interface EntityToolbarProps {
  primaryControls: ReactNode;
  actions?: ReactNode;
}

export function EntityToolbar({ primaryControls, actions }: EntityToolbarProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 flex-1">{primaryControls}</div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}
