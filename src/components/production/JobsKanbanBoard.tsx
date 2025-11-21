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
}

interface ColumnConfig {
  estado: EstadoOrdenItem;
  titulo: string;
  color: string;
  bgColor: string;
  borderColor: string;
}

const columnsConfig: ColumnConfig[] = [
  {
    estado: 'pendiente',
    titulo: 'Pendiente',
    color: 'text-yellow-700',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-300',
  },
  {
    estado: 'en_proceso',
    titulo: 'En Proceso',
    color: 'text-blue-700',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-300',
  },
  {
    estado: 'finalizado',
    titulo: 'Completado',
    color: 'text-green-700',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-300',
  },
];

export function JobsKanbanBoard({ jobsByEstado, onJobClick }: JobsKanbanBoardProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 auto-rows-fr">
      {columnsConfig.map((config) => (
        <div
          key={config.estado}
          className="bg-white rounded-lg shadow-sm border border-gray-200 min-h-[500px] max-h-[calc(100vh-280px)] flex flex-col"
        >
          <JobsKanbanColumn
            estado={config.estado}
            titulo={config.titulo}
            jobs={jobsByEstado[config.estado]}
            color={config.color}
            bgColor={config.bgColor}
            borderColor={config.borderColor}
            onJobClick={onJobClick}
          />
        </div>
      ))}
    </div>
  );
}
