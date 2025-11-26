import { useParams } from 'react-router-dom';
import { useMonitorJobs } from '../../hooks/useMonitorJobs';
import { JobsKanbanBoard } from '../../components/production/JobsKanbanBoard';
import { isValidUUID } from '../../utils/validation';
import { Radio, MonitorCheck, RefreshCw } from 'lucide-react';
import dayjs from 'dayjs';
import 'dayjs/locale/es';

dayjs.locale('es');

export function JobsMonitor() {
  const { companyId } = useParams<{ companyId: string }>();

  if (!isValidUUID(companyId)) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-red-500/10 flex items-center justify-center">
            <MonitorCheck className="w-10 h-10 text-red-500" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-3">
            Acceso no autorizado
          </h1>
          <p className="text-gray-400">
            El enlace de monitoreo no es válido. Por favor, verifica la URL e intenta nuevamente.
          </p>
        </div>
      </div>
    );
  }

  const { jobsByEstado, loading, error, isUpdating, recentlyUpdatedJobs } = useMonitorJobs(companyId);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-16 w-16 border-b-4 border-cyan-500"></div>
          <p className="mt-6 text-xl text-gray-300">Cargando monitor...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-red-500/10 flex items-center justify-center">
            <RefreshCw className="w-10 h-10 text-red-500" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-3">
            Error al cargar datos
          </h1>
          <p className="text-gray-400 mb-6">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg font-medium transition-colors"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  const totalJobs =
    jobsByEstado.pendiente.length +
    jobsByEstado.en_proceso.length +
    jobsByEstado.finalizado.length;

  return (
    <div className="h-screen w-screen bg-gray-950 overflow-hidden flex flex-col">
      <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 via-transparent to-blue-500/5 pointer-events-none" />

      <header className="relative z-10 bg-gray-900/80 backdrop-blur-sm border-b border-gray-800 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <MonitorCheck className="w-7 h-7 text-cyan-400" />
              <h1 className="text-2xl font-bold text-white">
                Monitor de Producción
              </h1>
            </div>
            <div className="px-4 py-1.5 bg-cyan-500/10 border border-cyan-500/30 rounded-full">
              <span className="text-sm font-semibold text-cyan-400">
                {totalJobs} {totalJobs === 1 ? 'job activo' : 'jobs activos'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {isUpdating && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-cyan-500/10 border border-cyan-500/30 rounded-full">
                <Radio className="w-4 h-4 text-cyan-400 animate-pulse" />
                <span className="text-sm font-medium text-cyan-400">En vivo</span>
              </div>
            )}
            <div className="text-sm text-gray-500">
              {dayjs().format('HH:mm:ss')}
            </div>
          </div>
        </div>
      </header>

      <main className="relative flex-1 overflow-hidden p-4">
        <div className="h-full monitor-kanban">
          <JobsKanbanBoard
            jobsByEstado={jobsByEstado}
            recentlyUpdatedJobs={recentlyUpdatedJobs}
          />
        </div>
      </main>

      <style>{`
        .monitor-kanban .grid {
          grid-template-columns: repeat(3, 1fr) !important;
          height: 100%;
        }

        .monitor-kanban > div {
          height: 100%;
        }

        @media (orientation: portrait) {
          .monitor-kanban .grid {
            gap: 0.75rem;
          }
        }

        @media (orientation: landscape) {
          .monitor-kanban .grid {
            gap: 1rem;
          }
        }

        @media (min-width: 1920px) {
          .monitor-kanban {
            font-size: 1.05rem;
          }
        }
      `}</style>
    </div>
  );
}
