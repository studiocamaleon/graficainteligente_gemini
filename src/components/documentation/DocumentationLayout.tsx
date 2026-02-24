import { ReactNode } from 'react';
import { DocumentationSidebar } from './DocumentationSidebar';

interface DocumentationLayoutProps {
  title: string;
  description: string;
  children: ReactNode;
}

export function DocumentationLayout({ title, description, children }: DocumentationLayoutProps) {
  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-200/80 bg-gradient-to-r from-slate-50 via-white to-sky-50 p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-700">Centro de ayuda</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">{title}</h1>
        <p className="mt-1 text-sm text-slate-600">{description}</p>
      </section>

      <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <DocumentationSidebar />
        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
