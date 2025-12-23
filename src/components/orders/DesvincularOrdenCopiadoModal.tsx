import { useState } from 'react';
import { AlertTriangle, Unlink, X } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Card } from '../ui/card';
import type { CentroCopiadoOrdenResumida } from '../../types/database';

interface DesvincularOrdenCopiadoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  ordenCopiado: CentroCopiadoOrdenResumida;
  numeroOrdenTrabajo: string;
  totalOrdenTrabajo?: number;
  totalPagado?: number;
}

export function DesvincularOrdenCopiadoModal({
  isOpen,
  onClose,
  onConfirm,
  ordenCopiado,
  numeroOrdenTrabajo,
  totalOrdenTrabajo = 0,
  totalPagado = 0,
}: DesvincularOrdenCopiadoModalProps) {
  const [confirmado, setConfirmado] = useState(false);
  const [procesando, setProcesando] = useState(false);

  // Calcular totales para la simulación
  const totalOC = Number(ordenCopiado.total || 0);
  const totalConsolidado = Number(totalOrdenTrabajo || 0);
  const totalPagadoNum = Number(totalPagado || 0);

  // Evitar división por cero
  const porcentajeOC = totalConsolidado > 0 ? (totalOC / totalConsolidado) : 0;

  // Calcular pagos proporcionales
  const pagoAsignadoOC = totalPagadoNum * porcentajeOC;
  const nuevoSaldoPendienteOC = Math.max(0, totalOC - pagoAsignadoOC);

  const handleConfirmar = async () => {
    if (!confirmado) return;

    setProcesando(true);
    try {
      await onConfirm();
      onClose();
    } catch (error) {
      console.error('Error al desvincular:', error);
    } finally {
      setProcesando(false);
      setConfirmado(false);
    }
  };

  const handleClose = () => {
    if (!procesando) {
      setConfirmado(false);
      onClose();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Desvincular Orden de Copiado"
      size="lg"
    >
      <div className="space-y-6">
        {/* Alert de advertencia */}
        <Card className="bg-amber-50 border-amber-300">
          <div className="p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-amber-900 mb-2">
                  Advertencia: Acción Importante
                </h3>
                <p className="text-sm text-amber-800">
                  Esta acción separará la orden de copiado de la orden de trabajo. Después de desvincular:
                </p>
              </div>
            </div>
          </div>
        </Card>

        {/* Detalles de lo que sucederá */}
        <div className="space-y-3">
          <h4 className="font-medium text-gray-900">¿Qué sucederá al desvincular?</h4>

          <div className="space-y-2 text-sm">
            <div className="flex items-start gap-2">
              <div className="w-2 h-2 bg-blue-600 rounded-full mt-1.5 flex-shrink-0" />
              <p className="text-gray-700">
                La <strong>Orden de Copiado {ordenCopiado.numero_orden}</strong> se independizará de la <strong>Orden de Trabajo {numeroOrdenTrabajo}</strong>
              </p>
            </div>

            <div className="flex items-start gap-2">
              <div className="w-2 h-2 bg-blue-600 rounded-full mt-1.5 flex-shrink-0" />
              <p className="text-gray-700">
                Los <strong>totales de la orden de trabajo se recalcularán automáticamente</strong>, excluyendo el monto de la orden de copiado
              </p>
            </div>

            <div className="flex items-start gap-2">
              <div className="w-2 h-2 bg-green-600 rounded-full mt-1.5 flex-shrink-0" />
              <p className="text-gray-700">
                Los <strong>pagos actuales se redistribuirán proporcionalmente</strong> entre ambas órdenes según sus montos totales.
              </p>
            </div>

            <div className="flex items-start gap-2">
              <div className="w-2 h-2 bg-blue-600 rounded-full mt-1.5 flex-shrink-0" />
              <p className="text-gray-700">
                La orden de copiado tendrá el saldo pendiente ajustado y deberás gestionar sus futuros pagos de forma independiente
              </p>
            </div>
          </div>
        </div>

        {/* Resumen de montos */}
        <Card className="bg-gray-50">
          <div className="p-4">
            <h4 className="font-medium text-gray-900 mb-3">Previsualización de Saldos</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Total Orden de Copiado:</span>
                <span className="font-semibold text-gray-900">${totalOC.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Pago Asignado (Estimado):</span>
                <span className="font-semibold text-green-600">
                  ${pagoAsignadoOC.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between pt-2 border-t">
                <span className="text-amber-700">Nuevo Saldo Pendiente OC:</span>
                <span className="font-bold text-amber-700">${nuevoSaldoPendienteOC.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </Card>

        {/* Checkbox de confirmación */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={confirmado}
              onChange={(e) => setConfirmado(e.target.checked)}
              className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              disabled={procesando}
            />
            <span className="text-sm text-blue-900">
              <strong>Confirmo que entiendo las consecuencias</strong> de desvincular esta orden de copiado
              y que cada orden gestionará sus pagos de forma independiente.
            </span>
          </label>
        </div>

        {/* Acciones */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t">
          <Button
            variant="secondary"
            onClick={handleClose}
            disabled={procesando}
          >
            <X className="w-4 h-4" />
            Cancelar
          </Button>
          <Button
            variant="danger"
            onClick={handleConfirmar}
            disabled={!confirmado || procesando}
          >
            {procesando ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                Desvinculando...
              </>
            ) : (
              <>
                <Unlink className="w-4 h-4" />
                Desvincular Orden
              </>
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
