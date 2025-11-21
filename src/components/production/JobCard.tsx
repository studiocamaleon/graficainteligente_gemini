import { memo } from 'react';
import { ActiveStepBadge } from './ActiveStepBadge';
import { JobProgressBar } from './JobProgressBar';
import type { JobItem } from '../../hooks/useProductionJobs';
import { Package } from 'lucide-react';

interface JobCardProps {
  job: JobItem;
  onClick?: (job: JobItem) => void;
}

export const JobCard = memo(function JobCard({ job, onClick }: JobCardProps) {
  return (
    <div
      onClick={() => onClick?.(job)}
      className={`
        bg-white rounded-lg border-2 border-gray-200 p-4 space-y-3
        transition-all duration-200 cursor-pointer
        hover:border-blue-300 hover:shadow-md
      `}
    >
      <div className="flex items-start justify-between gap-3">
        <ActiveStepBadge
          pasoRelevante={job.paso_relevante}
          estadoJob={job.estado}
          totalPasos={job.total_pasos}
          size="sm"
        />
        <span className="text-xs font-mono font-semibold text-gray-500">
          #{job.numero_orden}
        </span>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-start gap-2">
          <span className="text-xs font-medium text-gray-500 min-w-[60px]">Cliente:</span>
          <span className="text-sm font-semibold text-gray-900 line-clamp-1">
            {job.cliente_nombre}
          </span>
        </div>

        <div className="flex items-start gap-2">
          <Package className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 line-clamp-2">
              {job.producto_nombre}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              Cantidad: {job.cantidad}
            </p>
          </div>
        </div>
      </div>

      <div className="pt-2 border-t border-gray-100">
        <JobProgressBar
          totalPasos={job.total_pasos}
          pasosCompletados={job.pasos_completados}
          pasosEnProceso={job.pasos_en_proceso}
          pasosPendientes={job.pasos_pendientes}
          showPercentage={true}
          size="sm"
        />
      </div>

      {job.total_pasos === 0 && (
        <div className="pt-2 text-xs text-amber-600 bg-amber-50 rounded px-2 py-1.5">
          Sin ruta de producción definida
        </div>
      )}
    </div>
  );
});
