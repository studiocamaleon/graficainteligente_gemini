import { useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { StepProgressIndicator } from './StepProgressIndicator';
import { useStepExecution } from '../../hooks/useStepExecution';
import { useOrdenItemRutas } from '../../hooks/useOrdenItemRutas';
import type { JobItem } from '../../hooks/useProductionJobs';
import { AlertCircle, Package, User, Hash } from 'lucide-react';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Button } from '../ui/Button';
import { useAuth } from '../../hooks/useAuth';
import { ordenarRutasPorEtapaYOrden } from '../../utils/productionUtils';
import type { OrdenItemRuta } from '../../types/database';

interface JobExecutionModalProps {
  isOpen: boolean;
  onClose: () => void;
  job: JobItem;
  onOptimisticUpdate?: (jobId: string, patch: Partial<JobItem>) => void;
}

const etapaLabels: Record<string, string> = {
  pre_prensa: 'Pre-Prensa',
  principal: 'Producción',
  post_prensa: 'Post-Prensa',
  instalacion: 'Instalación',
};

const etapaColors: Record<string, string> = {
  pre_prensa: 'bg-slate-100 text-slate-700 border-slate-200',
  principal: 'bg-slate-100 text-slate-700 border-slate-200',
  post_prensa: 'bg-slate-100 text-slate-700 border-slate-200',
  instalacion: 'bg-slate-100 text-slate-700 border-slate-200',
};

const estadoLabel: Record<string, string> = {
  pendiente: 'Pendiente',
  en_proceso: 'En proceso',
  pausado: 'Pausado',
  completado: 'Completado',
  omitido: 'Omitido',
};

const estadoColor: Record<string, string> = {
  pendiente: 'bg-slate-100 text-slate-700 border-slate-200',
  en_proceso: 'bg-blue-100 text-blue-700 border-blue-200',
  pausado: 'bg-amber-100 text-amber-700 border-amber-200',
  completado: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  omitido: 'bg-orange-100 text-orange-700 border-orange-200',
};

function formatDateTime(value?: string | null): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function JobExecutionModal({ isOpen, onClose, job, onOptimisticUpdate }: JobExecutionModalProps) {
  const { profile } = useAuth();
  const { rutas, refetch } = useOrdenItemRutas({ ordenItemId: job.id });
  const { completeStep, getActiveStep, canStartStep, loading } = useStepExecution();
  const {
    showConfirm,
    dialogState,
    closeDialog,
    handleConfirm,
    isLoading: isConfirmLoading
  } = useConfirmDialog();

  const activeStep = getActiveStep(rutas);

  useEffect(() => {
    if (isOpen) {
      refetch();
    }
  }, [isOpen, refetch]);

  const buildRelevantStep = (allRutas: OrdenItemRuta[]) => {
    const rutasOrdenadas = ordenarRutasPorEtapaYOrden(allRutas);
    const pasoPausado = rutasOrdenadas.find((r) => r.estado_paso === 'pausado');
    if (pasoPausado) {
      return { nombre: pasoPausado.paso_nombre, estado: 'pausado' as const, etapa: pasoPausado.tipo_etapa };
    }
    const pasoEnProceso = rutasOrdenadas.find((r) => r.estado_paso === 'en_proceso');
    if (pasoEnProceso) {
      return { nombre: pasoEnProceso.paso_nombre, estado: 'en_proceso' as const, etapa: pasoEnProceso.tipo_etapa };
    }
    const pasoPendiente = rutasOrdenadas.find((r) => r.estado_paso === 'pendiente');
    if (pasoPendiente) {
      return { nombre: pasoPendiente.paso_nombre, estado: 'pendiente' as const, etapa: pasoPendiente.tipo_etapa };
    }
    return null;
  };

  const handleCompleteStep = async (rutaId: string) => {
    const confirmed = await showConfirm({
      title: '¿Marcar paso como completado?',
      message: 'Se registrará responsable, fecha y hora de finalización.',
      confirmText: 'Marcar completado',
      cancelText: 'Cancelar',
    });

    if (!confirmed) return;

    const result = await completeStep(rutaId, job.id);

    if (result.success) {
      const nowIso = new Date().toISOString();
      const rutasOptimisticas = rutas.map((ruta) =>
        ruta.id === rutaId
          ? {
              ...ruta,
              estado_paso: 'completado',
              fecha_inicio: ruta.fecha_inicio || nowIso,
              fecha_fin: nowIso,
              responsable_id: profile?.id || ruta.responsable_id,
              responsable_nombre: profile?.full_name || ruta.responsable_nombre,
            }
          : ruta
      );

      const totalPasos = rutasOptimisticas.length;
      const pasosCompletados = rutasOptimisticas.filter(
        (r) => r.estado_paso === 'completado' || r.estado_paso === 'omitido'
      ).length;
      const pasosEnProceso = rutasOptimisticas.filter((r) => r.estado_paso === 'en_proceso').length;
      const pasosPendientes = rutasOptimisticas.filter((r) => r.estado_paso === 'pendiente').length;
      const todosPasosResueltos = totalPasos > 0 && pasosCompletados === totalPasos;

      onOptimisticUpdate?.(job.id, {
        estado: todosPasosResueltos ? 'finalizado' : 'en_proceso',
        total_pasos: totalPasos,
        pasos_completados: pasosCompletados,
        pasos_en_proceso: pasosEnProceso,
        pasos_pendientes: pasosPendientes,
        progreso_porcentaje: totalPasos > 0 ? Math.round((pasosCompletados / totalPasos) * 100) : 0,
        paso_relevante: buildRelevantStep(rutasOptimisticas),
        updated_at: nowIso,
      });

      await refetch();
    } else {
      alert(result.error || 'Error al completar el paso');
    }
  };

  const rutasPorEtapa = rutas.reduce((acc, ruta) => {
    if (!acc[ruta.tipo_etapa]) {
      acc[ruta.tipo_etapa] = [];
    }
    acc[ruta.tipo_etapa].push(ruta);
    return acc;
  }, {} as Record<string, typeof rutas>);

  Object.keys(rutasPorEtapa).forEach((etapa) => {
    rutasPorEtapa[etapa].sort((a, b) => a.orden - b.orden);
  });

  const ordenEtapas = ['pre_prensa', 'principal', 'post_prensa', 'instalacion'];

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title="Ejecución de Producción" size="lg">
        <div className="space-y-5">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-slate-600" />
                <div>
                  <p className="text-xs text-slate-500">Cliente</p>
                  <p className="font-semibold text-slate-900">{job.cliente_nombre}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Hash className="w-4 h-4 text-slate-600" />
                <div>
                  <p className="text-xs text-slate-500">Orden</p>
                  <p className="font-semibold text-slate-900">#{job.numero_orden}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 col-span-2">
                <Package className="w-4 h-4 text-slate-600" />
                <div>
                  <p className="text-xs text-slate-500">Producto</p>
                  <p className="font-semibold text-slate-900">{job.producto_nombre}</p>
                  <p className="text-xs text-slate-500">Cantidad: {job.cantidad}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <StepProgressIndicator rutas={rutas} currentStepId={activeStep?.id} />
          </div>

          {rutas.length === 0 ? (
            <div className="text-center py-8 bg-gray-50 rounded-lg">
              <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600">No hay pasos de producción definidos para este item.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {ordenEtapas.map((etapa) => {
                const rutasEtapa = rutasPorEtapa[etapa];
                if (!rutasEtapa || rutasEtapa.length === 0) return null;

                return (
                  <div key={etapa} className="rounded-xl border border-slate-200 bg-white p-3">
                    <div className="mb-3 flex items-center gap-2 border-b border-slate-100 pb-2">
                      <div
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${etapaColors[etapa]}`}
                      >
                        {etapaLabels[etapa]}
                      </div>
                      <span className="text-xs text-slate-400">{rutasEtapa.length} pasos</span>
                    </div>
                    <div className="space-y-3">
                      {rutasEtapa.map((ruta) => {
                        const isActive = activeStep?.id === ruta.id;
                        const canComplete =
                          canStartStep(ruta, rutas) || ruta.estado_paso === 'en_proceso' || ruta.estado_paso === 'pausado';
                        const showAction = ruta.estado_paso !== 'completado' && ruta.estado_paso !== 'omitido';
                        const isCompleted = ruta.estado_paso === 'completado';

                        return (
                          <div
                            key={ruta.id}
                            className={`rounded-xl border p-3 transition-colors ${
                              isCompleted
                                ? 'bg-emerald-50 border-emerald-300'
                                : isActive
                                ? 'bg-white border-blue-300 ring-1 ring-blue-200'
                                : 'bg-white border-slate-200'
                            }`}
                          >
                            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="font-medium text-slate-900 truncate">{ruta.paso_nombre}</p>
                                  <span
                                    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                                      estadoColor[ruta.estado_paso] || estadoColor.pendiente
                                    }`}
                                  >
                                    {estadoLabel[ruta.estado_paso] || ruta.estado_paso}
                                  </span>
                                </div>
                                <div className="mt-1 text-xs text-slate-500">
                                  {ruta.fecha_fin
                                    ? `Finalizado: ${formatDateTime(ruta.fecha_fin)}${ruta.responsable_nombre ? ` · ${ruta.responsable_nombre}` : ''}`
                                    : ruta.fecha_inicio
                                    ? `Iniciado: ${formatDateTime(ruta.fecha_inicio)}${ruta.responsable_nombre ? ` · ${ruta.responsable_nombre}` : ''}`
                                    : 'Sin registrar'}
                                </div>
                              </div>

                              {showAction && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleCompleteStep(ruta.id)}
                                  disabled={!canComplete || loading}
                                  isLoading={loading}
                                  className="w-full border-emerald-300 text-emerald-700 hover:bg-emerald-50 md:w-auto"
                                >
                                  Finalizar
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={dialogState.isOpen}
        onClose={closeDialog}
        onConfirm={handleConfirm}
        title={dialogState.title}
        message={dialogState.message}
        confirmText={dialogState.confirmText}
        cancelText={dialogState.cancelText}
        variant={dialogState.variant}
        isLoading={isConfirmLoading}
      />
    </>
  );
}
