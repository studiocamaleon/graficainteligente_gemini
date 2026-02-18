import { memo } from 'react';
import { ActiveStepBadge } from './ActiveStepBadge';
import { JobProgressBar } from './JobProgressBar';
import type { JobItem } from '../../hooks/useProductionJobs';
import { Package, CalendarClock } from 'lucide-react';

interface JobCardProps {
  job: JobItem;
  onClick?: (job: JobItem) => void;
  isRecentlyUpdated?: boolean;
}

export const JobCard = memo(function JobCard({ job, onClick, isRecentlyUpdated = false }: JobCardProps) {
  const formatDelivery = (value?: string | null) => {
    if (!value) return 'Sin fecha';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Sin fecha';
    return date.toLocaleDateString('es-AR');
  };

  return (
    <div
      onClick={() => onClick?.(job)}
      className={`
        relative cursor-pointer space-y-3 rounded-lg border p-3
        transition-all duration-200
        hover:border-slate-300 hover:shadow-sm
        ${
          isRecentlyUpdated
            ? 'border-blue-300 bg-blue-50/40'
            : 'border-slate-200 bg-white'
        }
      `}
    >
      <div className="flex items-start justify-between gap-3">
        {isRecentlyUpdated && (
          <div className="absolute -right-2 -top-2 z-10">
            <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
              Actualizado
            </span>
          </div>
        )}
        <ActiveStepBadge
          pasoRelevante={job.paso_relevante}
          estadoJob={job.estado}
          totalPasos={job.total_pasos}
          size="sm"
        />
        <span className="text-xs font-mono font-semibold text-slate-500">
          #{job.numero_orden}
        </span>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-start gap-2">
          <span className="min-w-[60px] text-xs font-medium text-slate-500">Cliente:</span>
          <span className="line-clamp-1 text-sm font-semibold text-slate-900">
            {job.cliente_nombre}
          </span>
        </div>

        <div className="flex items-start gap-2">
          <Package className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-400" />
          <div className="flex-1 min-w-0">
            <p className="line-clamp-2 text-sm font-medium text-slate-900">
              {job.producto_nombre}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              Cantidad: {job.cantidad}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 text-xs text-slate-500">
          <CalendarClock className="h-3.5 w-3.5" />
          <span>Entrega: {formatDelivery(job.fecha_estimada_entrega)}</span>
        </div>
      </div>

      <div className="border-t border-slate-100 pt-2">
        <div className={isRecentlyUpdated ? 'animate-pulse' : ''}>
          <JobProgressBar
            totalPasos={job.total_pasos}
            pasosCompletados={job.pasos_completados}
            pasosEnProceso={job.pasos_en_proceso}
            pasosPendientes={job.pasos_pendientes}
            showPercentage={true}
            size="sm"
          />
        </div>
      </div>

      {job.total_pasos === 0 && (
        <div className="rounded border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-700">
          Sin ruta de producción definida
        </div>
      )}
    </div>
  );
});
