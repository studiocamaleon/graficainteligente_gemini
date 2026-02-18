import { JobCard } from './JobCard';
import { EmptyState } from '../ui/EmptyState';
import { Inbox } from 'lucide-react';
import type { JobItem } from '../../hooks/useProductionJobs';
import type { EstadoOrdenItem } from '../../types/database';

interface JobsKanbanColumnProps {
  estado: EstadoOrdenItem;
  titulo: string;
  jobs: JobItem[];
  onJobClick?: (job: JobItem) => void;
  recentlyUpdatedJobs?: Set<string>;
}

const estadoEmptyMessages: Record<EstadoOrdenItem, string> = {
  pendiente: 'No hay jobs pendientes',
  en_proceso: 'No hay jobs en proceso',
  finalizado: 'No hay jobs finalizados',
};

export function JobsKanbanColumn({
  estado,
  titulo,
  jobs,
  onJobClick,
  recentlyUpdatedJobs = new Set(),
}: JobsKanbanColumnProps) {
  const badgeTone =
    estado === 'finalizado'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : estado === 'en_proceso'
      ? 'border-blue-200 bg-blue-50 text-blue-700'
      : 'border-slate-200 bg-slate-100 text-slate-700';

  return (
    <div className="flex flex-col h-full">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-slate-50/95 px-4 py-3 backdrop-blur">
        <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-700">
          {titulo}
        </h3>
        <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${badgeTone}`}>
          {jobs.length}
        </span>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50 p-3">
        {jobs.length > 0 ? (
          jobs.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              onClick={onJobClick}
              isRecentlyUpdated={recentlyUpdatedJobs.has(job.id)}
            />
          ))
        ) : (
          <div className="pt-8">
            <EmptyState
              icon={Inbox}
              title={estadoEmptyMessages[estado]}
              description=""
            />
          </div>
        )}
      </div>
    </div>
  );
}
