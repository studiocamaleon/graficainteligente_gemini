import { useState } from 'react';
import { AlertTriangle, Calendar, FileText } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import type { PresupuestoConRelaciones } from '../../types/presupuestos';

interface ConvertirPresupuestoModalProps {
  isOpen: boolean;
  onClose: () => void;
  presupuesto: PresupuestoConRelaciones;
  onConvertir: (params: {
    fechaEntrega?: string;
    notasAdicionales?: string;
    copiarArchivos: boolean;
  }) => Promise<void>;
}

export function ConvertirPresupuestoModal({
  isOpen,
  onClose,
  presupuesto,
  onConvertir,
}: ConvertirPresupuestoModalProps) {
  const [fechaEntrega, setFechaEntrega] = useState<string>('');
  const [notasAdicionales, setNotasAdicionales] = useState('');
  const [copiarArchivos, setCopiarArchivos] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Contar items personalizados
  const itemsPersonalizados = presupuesto.items?.filter(
    (item) => item.tipo_item === 'item_personalizado'
  ).length || 0;

  const itemsSistema = presupuesto.items?.filter(
    (item) => item.tipo_item === 'producto_sistema'
  ).length || 0;

  const handleSubmit = async () => {
    try {
      setSubmitting(true);
      await onConvertir({
        fechaEntrega: fechaEntrega || undefined,
        notasAdicionales: notasAdicionales || undefined,
        copiarArchivos,
      });
      onClose();
    } catch (error) {
      console.error('Error convirtiendo:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!submitting) {
      setFechaEntrega('');
      setNotasAdicionales('');
      setCopiarArchivos(true);
      onClose();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Convertir a Orden de Trabajo"
      maxWidth="max-w-2xl"
    >
      <div className="space-y-6">
        {/* Información del presupuesto */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <FileText className="w-5 h-5 text-blue-600 mt-0.5" />
            <div>
              <p className="font-semibold text-blue-900">
                {presupuesto.numero_presupuesto}
              </p>
              <p className="text-sm text-blue-700">
                {presupuesto.cliente?.razon_social || 'Cliente'}
              </p>
              <p className="text-sm text-blue-600 mt-1">
                {itemsSistema} item(s) del sistema serán copiados automáticamente
              </p>
            </div>
          </div>
        </div>

        {/* Advertencia de items personalizados */}
        {itemsPersonalizados > 0 && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-orange-600 mt-0.5" />
              <div>
                <p className="font-semibold text-orange-900">Items Personalizados</p>
                <p className="text-sm text-orange-700 mt-1">
                  Este presupuesto tiene {itemsPersonalizados} item(s) personalizado(s) que no
                  se pueden copiar automáticamente. Deberás agregarlos manualmente a la orden.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Fecha de entrega */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Fecha de Entrega Estimada (opcional)
          </label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input
              type="date"
              value={fechaEntrega}
              onChange={(e) => setFechaEntrega(e.target.value)}
              className="pl-10"
              min={new Date().toISOString().split('T')[0]}
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Si no se especifica, se usará la fecha de validez del presupuesto o 7 días desde hoy
          </p>
        </div>

        {/* Notas adicionales */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Notas Adicionales (opcional)
          </label>
          <textarea
            value={notasAdicionales}
            onChange={(e) => setNotasAdicionales(e.target.value)}
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Agregar notas internas para la orden..."
          />
        </div>

        {/* Checkbox copiar archivos */}
        <div className="flex items-start gap-3">
          <input
            type="checkbox"
            id="copiar-archivos"
            checked={copiarArchivos}
            onChange={(e) => setCopiarArchivos(e.target.checked)}
            className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <label htmlFor="copiar-archivos" className="text-sm text-gray-700 cursor-pointer">
            Copiar archivos adjuntos del presupuesto a la orden
          </label>
        </div>

        {/* Resumen */}
        <div className="bg-gray-50 rounded-lg p-4 space-y-2">
          <p className="font-semibold text-gray-900">Se creará una orden con:</p>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>• {itemsSistema} item(s) del sistema con rutas de producción</li>
            {copiarArchivos && (
              <li>• Archivos adjuntos del presupuesto</li>
            )}
            <li>• Estado inicial: Pendiente</li>
            <li>• Referencia al presupuesto original</li>
          </ul>
          {itemsPersonalizados > 0 && (
            <p className="text-sm text-orange-600 font-medium mt-2">
              ⚠️ Recuerda agregar manualmente los {itemsPersonalizados} item(s) personalizado(s)
            </p>
          )}
        </div>

        {/* Botones */}
        <div className="flex gap-3">
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1"
          >
            {submitting ? 'Convirtiendo...' : 'Convertir a Orden'}
          </Button>
          <Button
            variant="secondary"
            onClick={handleClose}
            disabled={submitting}
          >
            Cancelar
          </Button>
        </div>
      </div>
    </Modal>
  );
}
