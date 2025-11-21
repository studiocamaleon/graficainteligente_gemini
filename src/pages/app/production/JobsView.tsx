import { useState } from 'react';
import { JobsKanbanBoard } from '../../../components/production/JobsKanbanBoard';
import { JobExecutionModal } from '../../../components/production/JobExecutionModal';
import { useProductionJobs } from '../../../hooks/useProductionJobs';
import type { JobItem } from '../../../hooks/useProductionJobs';
import { RefreshCw, Radio } from 'lucide-react';
import { Button } from '../../../components/ui/Button';

export function JobsView() {
  const { jobsByEstado, loading, error, refreshJobs, isUpdating } = useProductionJobs();
  const [selectedJob, setSelectedJob] = useState<JobItem | null>(null);
  const [showExecutionModal, setShowExecutionModal] = useState(false);

  const handleJobClick = (job: JobItem) => {
    setSelectedJob(job);
    setShowExecutionModal(true);
  };

  const handleCloseModal = () => {
    setShowExecutionModal(false);
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
        <div className="flex items-center gap-3">
          <div className="text-sm text-gray-600">
            <span className="font-semibold">
              {jobsByEstado.pendiente.length + jobsByEstado.en_proceso.length + jobsByEstado.finalizado.length}
            </span>{' '}
            jobs en producción
          </div>
          {isUpdating && (
            <div className="flex items-center gap-1.5 text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-full">
              <Radio className="w-3 h-3 animate-pulse" />
              <span>Sincronizando...</span>
            </div>
          )}
        </div>
        <Button onClick={refreshJobs} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" />
          Actualizar
        </Button>
      </div>

      <JobsKanbanBoard jobsByEstado={jobsByEstado} onJobClick={handleJobClick} />

      {selectedJob && (
        <JobExecutionModal
          isOpen={showExecutionModal}
          onClose={handleCloseModal}
          job={selectedJob}
        />
      )}
    </div>
  );
}
