import { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { StepCard } from './StepCard';
import { StepActionsBar } from './StepActionsBar';
import { StepProgressIndicator } from './StepProgressIndicator';
import { useStepExecution } from '../../hooks/useStepExecution';
import { useOrdenItemRutas } from '../../hooks/useOrdenItemRutas';
import type { JobItem } from '../../hooks/useProductionJobs';
import { AlertCircle, Package, User, Hash } from 'lucide-react';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { PausarPasoDialog } from './PausarPasoDialog';
import { PausaBadge } from './PausaBadge';
import { HistorialPausasModal } from './HistorialPausasModal';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../contexts/ToastContext';

interface JobExecutionModalProps {
  isOpen: boolean;
  onClose: () => void;
  job: JobItem;
  onJobUpdated?: () => void;
}

const etapaLabels: Record<string, string> = {
  pre_prensa: 'Pre-Prensa',
  principal: 'Producción',
  post_prensa: 'Post-Prensa',
  instalacion: 'Instalación',
};

const etapaColors: Record<string, string> = {
  pre_prensa: 'bg-purple-100 text-purple-800 border-purple-300',
  principal: 'bg-blue-100 text-blue-800 border-blue-300',
  post_prensa: 'bg-green-100 text-green-800 border-green-300',
  instalacion: 'bg-orange-100 text-orange-800 border-orange-300',
};

export function JobExecutionModal({ isOpen, onClose, job, onJobUpdated }: JobExecutionModalProps) {
  const { rutas, refetch } = useOrdenItemRutas({ ordenItemId: job.id });
  const { startStep, completeStep, skipStep, getActiveStep, canStartStep, loading } = useStepExecution();
  const {
    showConfirm,
    dialogState,
    closeDialog,
    handleConfirm,
    isLoading: isConfirmLoading
  } = useConfirmDialog();

  const [skipJustification, setSkipJustification] = useState('');
  const [showSkipModal, setShowSkipModal] = useState(false);
  const [rutaToSkip, setRutaToSkip] = useState<string | null>(null);
  const [showPausarDialog, setShowPausarDialog] = useState(false);
  const [rutaToPause, setRutaToPause] = useState<{ id: string; nombre: string } | null>(null);
  const [showHistorialPausas, setShowHistorialPausas] = useState(false);
  const [rutaHistorial, setRutaHistorial] = useState<{ id: string; nombre: string } | null>(null);

  const activeStep = getActiveStep(rutas);

  useEffect(() => {
    if (isOpen) {
      refetch();
    }
  }, [isOpen, refetch]);

  const handleStartStep = async (rutaId: string) => {
    const confirmed = await showConfirm({
      title: '¿Iniciar este paso?',
      message: 'Esto marcará el paso como en proceso y registrará el inicio.',
      confirmText: 'Iniciar',
      cancelText: 'Cancelar',
    });

    if (!confirmed) return;

    const result = await startStep(rutaId, job.id);

    if (result.success) {
      await refetch();
      onJobUpdated?.();
    } else {
      alert(result.error || 'Error al iniciar el paso');
    }
  };

  const handleCompleteStep = async (rutaId: string) => {
    const confirmed = await showConfirm({
      title: '¿Completar este paso?',
      message: 'Esto marcará el paso como completado y habilitará el siguiente paso.',
      confirmText: 'Completar',
      cancelText: 'Cancelar',
    });

    if (!confirmed) return;

    const result = await completeStep(rutaId, job.id);

    if (result.success) {
      await refetch();
      onJobUpdated?.();
    } else {
      alert(result.error || 'Error al completar el paso');
    }
  };

  const handlePausarClick = (rutaId: string, pasoNombre: string) => {
    setRutaToPause({ id: rutaId, nombre: pasoNombre });
    setShowPausarDialog(true);
  };

  const handleHistorialClick = (rutaId: string, pasoNombre: string) => {
    setRutaHistorial({ id: rutaId, nombre: pasoNombre });
    setShowHistorialPausas(true);
  };

  const handlePausaSuccess = async () => {
    await refetch();
    onJobUpdated?.();
  };

  const { showSuccess, showError } = useToast();

  const handleReanudar = async (rutaId: string, pasoNombre: string) => {
    console.log('🔄 Intentando reanudar paso:', { rutaId, pasoNombre });

    const confirmed = await showConfirm({
      title: 'Reanudar Paso',
      message: `¿Confirmas que deseas reanudar el paso "${pasoNombre}"?`,
      confirmText: 'Reanudar',
      cancelText: 'Cancelar',
    });

    console.log('🔄 Confirmación de reanudar:', confirmed);

    if (!confirmed) {
      console.log('❌ Usuario canceló la reanudación');
      return;
    }

    try {
      console.log('⏳ Llamando fn_reanudar_paso con rutaId:', rutaId);

      const { data, error } = await supabase.rpc('fn_reanudar_paso', {
        p_ruta_id: rutaId,
      });

      console.log('📦 Respuesta de fn_reanudar_paso:', { data, error });

      if (error) {
        console.error('❌ Error al reanudar paso:', error);
        showError(error.message || 'Error al reanudar el paso');
        return;
      }

      if (data && data.success) {
        console.log('✅ Paso reanudado exitosamente. Duración:', data.duracion_pausa);

        const duracion = data.duracion_pausa || '0 minutos';
        showSuccess(`Paso reanudado. Duración de pausa: ${duracion}`);

        await refetch();
        onJobUpdated?.();
      } else {
        console.error('❌ fn_reanudar_paso retornó success=false');
        showError('No se pudo reanudar el paso');
      }
    } catch (err) {
      console.error('❌ Error inesperado al reanudar:', err);
      showError('Error inesperado al reanudar el paso');
    }

    console.log('🔄 Proceso de reanudación finalizado');
  };

  const handleSkipStepClick = (rutaId: string) => {
    setRutaToSkip(rutaId);
    setSkipJustification('');
    setShowSkipModal(true);
  };

  const handleSkipStepConfirm = async () => {
    if (!rutaToSkip) return;

    if (!skipJustification.trim()) {
      alert('Debes proporcionar una justificación para omitir el paso');
      return;
    }

    const result = await skipStep(rutaToSkip, job.id, skipJustification);

    if (result.success) {
      setShowSkipModal(false);
      setRutaToSkip(null);
      setSkipJustification('');
      await refetch();
      onJobUpdated?.();
    } else {
      alert(result.error || 'Error al omitir el paso');
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
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-blue-600" />
                <div>
                  <p className="text-xs text-gray-600">Cliente</p>
                  <p className="font-semibold text-gray-900">{job.cliente_nombre}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Hash className="w-4 h-4 text-blue-600" />
                <div>
                  <p className="text-xs text-gray-600">Orden</p>
                  <p className="font-semibold text-gray-900">#{job.numero_orden}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 col-span-2">
                <Package className="w-4 h-4 text-blue-600" />
                <div>
                  <p className="text-xs text-gray-600">Producto</p>
                  <p className="font-semibold text-gray-900">{job.producto_nombre}</p>
                  <p className="text-xs text-gray-500">Cantidad: {job.cantidad}</p>
                </div>
              </div>
            </div>
          </div>

          <StepProgressIndicator rutas={rutas} currentStepId={activeStep?.id} />

          {rutas.length === 0 ? (
            <div className="text-center py-8 bg-gray-50 rounded-lg">
              <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600">No hay pasos de producción definidos para este item.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {ordenEtapas.map((etapa) => {
                const rutasEtapa = rutasPorEtapa[etapa];
                if (!rutasEtapa || rutasEtapa.length === 0) return null;

                return (
                  <div key={etapa}>
                    <div
                      className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border mb-3 ${etapaColors[etapa]}`}
                    >
                      {etapaLabels[etapa]}
                    </div>
                    <div className="space-y-3">
                      {rutasEtapa.map((ruta) => {
                        const isActive = activeStep?.id === ruta.id;
                        const canStart = canStartStep(ruta, rutas);

                        return (
                          <StepCard
                            key={ruta.id}
                            ruta={ruta}
                            isActive={isActive}
                            canStart={canStart}
                          >
                            {/* Badge de Pausa */}
                            {ruta.estado_paso === 'pausado' && (
                              <div className="mb-3">
                                <PausaBadge
                                  variant="detailed"
                                  cantidadPausas={ruta.cantidad_pausas || 0}
                                />
                              </div>
                            )}

                            {/* Botones de Acción - Diseño Moderno */}
                            <StepActionsBar
                              estadoPaso={ruta.estado_paso}
                              canStart={canStart}
                              onStart={() => handleStartStep(ruta.id)}
                              onComplete={() => handleCompleteStep(ruta.id)}
                              onPause={() => handlePausarClick(ruta.id, ruta.paso_nombre)}
                              onSkip={() => handleSkipStepClick(ruta.id)}
                              onViewHistory={() => handleHistorialClick(ruta.id, ruta.paso_nombre)}
                              onResume={() => handleReanudar(ruta.id, ruta.paso_nombre)}
                              loading={loading}
                              cantidadPausas={ruta.cantidad_pausas || 0}
                            />
                          </StepCard>
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

      <Modal
        isOpen={showSkipModal}
        onClose={() => setShowSkipModal(false)}
        title="Omitir Paso"
        size="sm"
      >
        <div className="space-y-4">
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <div className="flex gap-2">
              <AlertCircle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-orange-800">
                Debes proporcionar una justificación para omitir este paso. Esta acción quedará
                registrada.
              </div>
            </div>
          </div>

          <Input
            label="Justificación"
            value={skipJustification}
            onChange={(e) => setSkipJustification(e.target.value)}
            placeholder="Explica por qué se omite este paso..."
            multiline
            rows={4}
            required
          />

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setShowSkipModal(false)}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              onClick={handleSkipStepConfirm}
              disabled={!skipJustification.trim() || loading}
              className="bg-orange-600 hover:bg-orange-700"
            >
              Omitir Paso
            </Button>
          </div>
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

      {/* Dialog Pausar Paso */}
      {rutaToPause && (
        <PausarPasoDialog
          isOpen={showPausarDialog}
          onClose={() => {
            setShowPausarDialog(false);
            setRutaToPause(null);
          }}
          rutaId={rutaToPause.id}
          pasoNombre={rutaToPause.nombre}
          onSuccess={handlePausaSuccess}
        />
      )}

      {/* Modal Historial de Pausas */}
      {rutaHistorial && (
        <HistorialPausasModal
          isOpen={showHistorialPausas}
          onClose={() => {
            setShowHistorialPausas(false);
            setRutaHistorial(null);
          }}
          rutaId={rutaHistorial.id}
          pasoNombre={rutaHistorial.nombre}
        />
      )}
    </>
  );
}
