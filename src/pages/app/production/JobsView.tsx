import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { JobsKanbanBoard } from '../../../components/production/JobsKanbanBoard';
import { JobExecutionModal } from '../../../components/production/JobExecutionModal';
import { useProductionJobs } from '../../../hooks/useProductionJobs';
import type { JobItem } from '../../../hooks/useProductionJobs';
import { RefreshCw, Radio, Monitor, Search, ArrowUpDown, CalendarClock } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { useAuth } from '../../../hooks/useAuth';
import { useToast } from '../../../contexts/ToastContext';

export function JobsView() {
  const { profile } = useAuth();
  const { showSuccess, showError } = useToast();
  const { jobsByEstado, loading, error, refreshJobs, isUpdating, recentlyUpdatedJobs } = useProductionJobs();
  const [selectedJob, setSelectedJob] = useState<JobItem | null>(null);
  const [showExecutionModal, setShowExecutionModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [deliverySort, setDeliverySort] = useState<'none' | 'asc' | 'desc'>('none');
  const [optimisticPatches, setOptimisticPatches] = useState<Record<string, Partial<JobItem>>>({});
  const optimisticTimeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    const timeouts = optimisticTimeoutsRef.current;
    return () => {
      timeouts.forEach((timeoutId) => clearTimeout(timeoutId));
      timeouts.clear();
    };
  }, []);

  const jobsByEstadoOptimistic = useMemo(() => {
    const patchJob = (job: JobItem): JobItem => {
      const patch = optimisticPatches[job.id];
      return patch ? { ...job, ...patch } : job;
    };

    return {
      pendiente: jobsByEstado.pendiente.map(patchJob),
      en_proceso: jobsByEstado.en_proceso.map(patchJob),
      finalizado: jobsByEstado.finalizado.map(patchJob),
    };
  }, [jobsByEstado, optimisticPatches]);

  const handleOptimisticJobUpdate = useCallback((jobId: string, patch: Partial<JobItem>) => {
    setOptimisticPatches((prev) => ({ ...prev, [jobId]: { ...(prev[jobId] || {}), ...patch } }));

    if (selectedJob?.id === jobId) {
      setSelectedJob((prev) => (prev ? { ...prev, ...patch } : prev));
    }

    const existingTimeout = optimisticTimeoutsRef.current.get(jobId);
    if (existingTimeout) clearTimeout(existingTimeout);

    const timeoutId = setTimeout(() => {
      setOptimisticPatches((prev) => {
        const next = { ...prev };
        delete next[jobId];
        return next;
      });
      optimisticTimeoutsRef.current.delete(jobId);
    }, 12000);

    optimisticTimeoutsRef.current.set(jobId, timeoutId);
  }, [selectedJob?.id]);

  const filteredJobsByEstado = useMemo(() => {
    const parseDeliveryDate = (job: JobItem) => {
      if (!job.fecha_estimada_entrega) return null;
      const time = new Date(job.fecha_estimada_entrega).getTime();
      return Number.isNaN(time) ? null : time;
    };

    const sortByDelivery = (jobs: JobItem[]) => {
      if (deliverySort === 'none') return jobs;

      return [...jobs].sort((a, b) => {
        const dateA = parseDeliveryDate(a);
        const dateB = parseDeliveryDate(b);

        if (dateA === null && dateB === null) return 0;
        if (dateA === null) return 1;
        if (dateB === null) return -1;

        return deliverySort === 'asc' ? dateA - dateB : dateB - dateA;
      });
    };

    if (!searchTerm.trim()) return jobsByEstadoOptimistic;

    const term = searchTerm.toLowerCase();
    const filterFn = (job: JobItem) =>
      job.cliente_nombre.toLowerCase().includes(term) ||
      (job.cliente_razon_social?.toLowerCase() || '').includes(term) ||
      job.numero_orden.toLowerCase().includes(term);

    const filtered = {
      pendiente: jobsByEstadoOptimistic.pendiente.filter(filterFn),
      en_proceso: jobsByEstadoOptimistic.en_proceso.filter(filterFn),
      finalizado: jobsByEstadoOptimistic.finalizado.filter(filterFn),
    };

    return {
      pendiente: sortByDelivery(filtered.pendiente),
      en_proceso: sortByDelivery(filtered.en_proceso),
      finalizado: sortByDelivery(filtered.finalizado),
    };
  }, [jobsByEstadoOptimistic, searchTerm, deliverySort]);

  const sortedJobsByEstado = useMemo(() => {
    if (deliverySort === 'none') return filteredJobsByEstado;

    const parseDeliveryDate = (job: JobItem) => {
      if (!job.fecha_estimada_entrega) return null;
      const time = new Date(job.fecha_estimada_entrega).getTime();
      return Number.isNaN(time) ? null : time;
    };

    const sortByDelivery = (jobs: JobItem[]) => {
      return [...jobs].sort((a, b) => {
        const dateA = parseDeliveryDate(a);
        const dateB = parseDeliveryDate(b);

        if (dateA === null && dateB === null) return 0;
        if (dateA === null) return 1;
        if (dateB === null) return -1;

        return deliverySort === 'asc' ? dateA - dateB : dateB - dateA;
      });
    };

    return {
      pendiente: sortByDelivery(filteredJobsByEstado.pendiente),
      en_proceso: sortByDelivery(filteredJobsByEstado.en_proceso),
      finalizado: sortByDelivery(filteredJobsByEstado.finalizado),
    };
  }, [filteredJobsByEstado, deliverySort]);

  const handleToggleDeliverySort = () => {
    setDeliverySort((prev) => {
      if (prev === 'none') return 'asc';
      if (prev === 'asc') return 'desc';
      return 'none';
    });
  };

  const handleJobClick = (job: JobItem) => {
    setSelectedJob(job);
    setShowExecutionModal(true);
  };

  const handleCloseModal = () => {
    setShowExecutionModal(false);
    setSelectedJob(null);
  };

  const handleCopyMonitorUrl = async () => {
    if (!profile?.company_id) {
      showError('No se pudo obtener el ID de la empresa');
      return;
    }

    const baseUrl = window.location.origin;
    const monitorUrl = `${baseUrl}/monitor/jobs/${profile.company_id}`;

    try {
      await navigator.clipboard.writeText(monitorUrl);
      showSuccess('URL del monitor copiada al portapapeles');
    } catch (err) {
      showError('Error al copiar la URL');
      console.error(err);
    }
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
        <div className="flex items-center gap-4 flex-1">
          <div className="text-sm text-gray-600 whitespace-nowrap">
            <span className="font-semibold">
              {filteredJobsByEstado.pendiente.length + filteredJobsByEstado.en_proceso.length + filteredJobsByEstado.finalizado.length}
            </span>{' '}
            jobs mostrados
          </div>
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <Input
              placeholder="Buscar cliente o número de orden..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 py-2 h-10"
            />
          </div>
          {isUpdating && (
            <div className="flex items-center gap-1.5 text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-full whitespace-nowrap">
              <Radio className="w-3 h-3 animate-pulse" />
              <span>Sincronizando...</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={handleToggleDeliverySort} variant={deliverySort === 'none' ? 'outline' : 'primary'} size="sm">
            {deliverySort === 'none' ? (
              <ArrowUpDown className="w-4 h-4 mr-2" />
            ) : (
              <CalendarClock className="w-4 h-4 mr-2" />
            )}
            {deliverySort === 'none' && 'Ordenar por Entrega'}
            {deliverySort === 'asc' && 'Entrega: Próximas'}
            {deliverySort === 'desc' && 'Entrega: Lejanas'}
          </Button>
          <Button onClick={handleCopyMonitorUrl} variant="outline" size="sm">
            <Monitor className="w-4 h-4 mr-2" />
            Copiar URL Monitor
          </Button>
          <Button onClick={refreshJobs} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Actualizar
          </Button>
        </div>
      </div>

      <JobsKanbanBoard
        jobsByEstado={sortedJobsByEstado}
        onJobClick={handleJobClick}
        recentlyUpdatedJobs={recentlyUpdatedJobs}
      />

      {selectedJob && (
        <JobExecutionModal
          isOpen={showExecutionModal}
          onClose={handleCloseModal}
          job={selectedJob}
          onOptimisticUpdate={handleOptimisticJobUpdate}
        />
      )}
    </div>
  );
}
