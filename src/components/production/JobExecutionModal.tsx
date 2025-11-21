import { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { StepCard } from './StepCard';
import { StepActionButtons } from './StepActionButtons';
import { StepProgressIndicator } from './StepProgressIndicator';
import { useStepExecution } from '../../hooks/useStepExecution';
import { useOrdenItemRutas } from '../../hooks/useOrdenItemRutas';
import type { JobItem } from '../../hooks/useProductionJobs';
import { AlertCircle, Package, User, Hash } from 'lucide-react';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';

interface JobExecutionModalProps {
  isOpen: boolean;
  onClose: () => void;
  job: JobItem;
}

const etapaLabels: Record<string, string> = {
  pre_prensa: 'Pre-Prensa',
  principal: 'Producción',
  post_prensa: 'Post-Prensa',
};

const etapaColors: Record<string, string> = {
  pre_prensa: 'bg-purple-100 text-purple-800 border-purple-300',
  principal: 'bg-blue-100 text-blue-800 border-blue-300',
  post_prensa: 'bg-green-100 text-green-800 border-green-300',
};

export function JobExecutionModal({ isOpen, onClose, job }: JobExecutionModalProps) {
  const { rutas, refetch } = useOrdenItemRutas({ ordenItemId: job.id });
  const { startStep, completeStep, skipStep, getActiveStep, canStartStep, loading } = useStepExecution();
  const { showConfirm } = useConfirmDialog();

  const [skipJustification, setSkipJustification] = useState('');
  const [showSkipModal, setShowSkipModal] = useState(false);
  const [rutaToSkip, setRutaToSkip] = useState<string | null>(null);

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
    } else {
      alert(result.error || 'Error al completar el paso');
    }
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

  const ordenEtapas = ['pre_prensa', 'principal', 'post_prensa'];

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
                            <StepActionButtons
                              estadoPaso={ruta.estado_paso}
                              canStart={canStart}
                              onStart={() => handleStartStep(ruta.id)}
                              onComplete={() => handleCompleteStep(ruta.id)}
                              onSkip={() => handleSkipStepClick(ruta.id)}
                              loading={loading}
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
    </>
  );
}
