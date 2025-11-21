import { useState } from 'react';
import { JobsKanbanBoard } from '../../../components/production/JobsKanbanBoard';
import { RouteDetailModal } from '../../../components/orders/RouteDetailModal';
import { useProductionJobs } from '../../../hooks/useProductionJobs';
import { useOrdenItemRutas } from '../../../hooks/useOrdenItemRutas';
import type { JobItem } from '../../../hooks/useProductionJobs';
import { RefreshCw } from 'lucide-react';
import { Button } from '../../../components/ui/Button';

export function JobsView() {
  const { jobsByEstado, loading, error, refreshJobs } = useProductionJobs();
  const [selectedJob, setSelectedJob] = useState<JobItem | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  const { rutas } = useOrdenItemRutas({
    ordenItemId: selectedJob?.id,
  });

  const handleJobClick = (job: JobItem) => {
    setSelectedJob(job);
    setShowDetailModal(true);
  };

  const handleCloseModal = () => {
    setShowDetailModal(false);
    setSelectedJob(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Cargando jobs...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <h3 className="text-red-800 font-semibold mb-2">Error al cargar jobs</h3>
        <p className="text-red-600">{error}</p>
        <Button onClick={refreshJobs} variant="outline" className="mt-4">
          <RefreshCw className="w-4 h-4 mr-2" />
          Reintentar
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-600">
          <span className="font-semibold">
            {jobsByEstado.pendiente.length + jobsByEstado.en_proceso.length + jobsByEstado.finalizado.length}
          </span>{' '}
          jobs en producción
        </div>
        <Button onClick={refreshJobs} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" />
          Actualizar
        </Button>
      </div>

      <JobsKanbanBoard jobsByEstado={jobsByEstado} onJobClick={handleJobClick} />

      {selectedJob && (
        <RouteDetailModal
          isOpen={showDetailModal}
          onClose={handleCloseModal}
          rutas={rutas}
          productoNombre={selectedJob.producto_nombre}
        />
      )}
    </div>
  );
}
