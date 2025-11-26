import { JobCard } from './JobCard';
import { EmptyState } from '../ui/EmptyState';
import { Inbox } from 'lucide-react';
import type { JobItem } from '../../hooks/useProductionJobs';
import type { EstadoOrdenItem } from '../../types/database';

interface JobsKanbanColumnProps {
  estado: EstadoOrdenItem;
  titulo: string;
  jobs: JobItem[];
  color: string;
  bgColor: string;
  borderColor: string;
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
  color,
  bgColor,
  borderColor,
  onJobClick,
  recentlyUpdatedJobs = new Set(),
}: JobsKanbanColumnProps) {
  return (
    <div className="flex flex-col h-full">
      <div
        className={`${bgColor} ${borderColor} border-b-4 rounded-t-lg px-4 py-3 flex items-center justify-between sticky top-0 z-10 shadow-sm`}
      >
        <h3 className={`text-sm font-bold ${color} uppercase tracking-wide`}>
          {titulo}
        </h3>
        <span className={`${color} text-sm font-bold px-2 py-1 bg-white rounded-full`}>
          {jobs.length}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
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
