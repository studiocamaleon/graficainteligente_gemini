import { JobsKanbanColumn } from './JobsKanbanColumn';
import type { EstadoOrdenItem } from '../../types/database';
import type { JobItem } from '../../hooks/useProductionJobs';

interface JobsKanbanBoardProps {
  jobsByEstado: {
    pendiente: JobItem[];
    en_proceso: JobItem[];
    finalizado: JobItem[];
  };
  onJobClick?: (job: JobItem) => void;
  recentlyUpdatedJobs?: Set<string>;
}

interface ColumnConfig {
  estado: EstadoOrdenItem;
  titulo: string;
  toneClass: string;
}

const columnsConfig: ColumnConfig[] = [
  {
    estado: 'pendiente',
    titulo: 'Pendiente',
    toneClass: 'border-slate-300',
  },
  {
    estado: 'en_proceso',
    titulo: 'En Proceso',
    toneClass: 'border-blue-300',
  },
  {
    estado: 'finalizado',
    titulo: 'Completado',
    toneClass: 'border-emerald-300',
  },
];

export function JobsKanbanBoard({ jobsByEstado, onJobClick, recentlyUpdatedJobs }: JobsKanbanBoardProps) {
  return (
    <div className="grid grid-cols-1 gap-4 auto-rows-fr xl:grid-cols-3">
      {columnsConfig.map((config) => (
        <div
          key={config.estado}
          className={`flex min-h-[500px] max-h-[calc(100vh-280px)] flex-col rounded-xl border bg-white shadow-sm ${config.toneClass}`}
        >
          <JobsKanbanColumn
            estado={config.estado}
            titulo={config.titulo}
            jobs={jobsByEstado[config.estado]}
            onJobClick={onJobClick}
            recentlyUpdatedJobs={recentlyUpdatedJobs}
          />
        </div>
      ))}
    </div>
  );
}
