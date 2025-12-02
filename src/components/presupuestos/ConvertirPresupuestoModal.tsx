import { useState, useEffect } from 'react';
import { AlertTriangle, Calendar, FileText, DollarSign } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { MedioCobroSelector } from '../medios-cobro/MedioCobroSelector';
import type { PresupuestoConRelaciones } from '../../types/presupuestos';

interface ConvertirPresupuestoModalProps {
  isOpen: boolean;
  onClose: () => void;
  presupuesto: PresupuestoConRelaciones;
  onConvertir: (params: {
    fechaEntrega?: string;
    notasAdicionales?: string;
    copiarArchivos: boolean;
    montoPago?: number;
    medioCobroId?: string;
    referenciaPago?: string;
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

  // Estados para pago inicial
  const [registrarPago, setRegistrarPago] = useState(false);
  const [montoPago, setMontoPago] = useState<string>('');
  const [medioCobroId, setMedioCobroId] = useState<string>('');
  const [referenciaPago, setReferenciaPago] = useState('');

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
        montoPago: registrarPago && montoPago ? parseFloat(montoPago) : undefined,
        medioCobroId: registrarPago && medioCobroId ? medioCobroId : undefined,
        referenciaPago: registrarPago && referenciaPago ? referenciaPago : undefined,
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
      setRegistrarPago(false);
      setMontoPago('');
      setMedioCobroId('');
      setReferenciaPago('');
      onClose();
    }
  };

  const montoNumerico = montoPago ? parseFloat(montoPago) : 0;
  const saldoPendiente = presupuesto.total - montoNumerico;
  const pagoValido = !registrarPago || (montoNumerico > 0 && montoNumerico <= presupuesto.total && medioCobroId);

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

        {/* Sección de Pago Inicial */}
        <div className="border-t border-gray-200 pt-4">
          <div className="flex items-start gap-3 mb-4">
            <input
              type="checkbox"
              id="registrar-pago"
              checked={registrarPago}
              onChange={(e) => setRegistrarPago(e.target.checked)}
              className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="registrar-pago" className="text-sm font-medium text-gray-700 cursor-pointer">
              Registrar seña o pago inicial
            </label>
          </div>

          {registrarPago && (
            <div className="space-y-4 bg-gray-50 p-4 rounded-lg">
              {/* Total del presupuesto */}
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Total del presupuesto:</span>
                <span className="font-semibold text-gray-900">
                  ${presupuesto.total.toLocaleString('es-AR', { minimumFractionDigits: 0 })}
                </span>
              </div>

              {/* Monto del pago */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Monto de la Seña *
                </label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <Input
                    type="number"
                    value={montoPago}
                    onChange={(e) => setMontoPago(e.target.value)}
                    className="pl-10"
                    placeholder="0.00"
                    min="0"
                    max={presupuesto.total}
                    step="0.01"
                  />
                </div>
                {montoPago && montoNumerico > presupuesto.total && (
                  <p className="text-xs text-red-600 mt-1">
                    El monto no puede ser mayor al total
                  </p>
                )}
              </div>

              {/* Medio de cobro */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Medio de Cobro *
                </label>
                <MedioCobroSelector
                  value={medioCobroId}
                  onChange={setMedioCobroId}
                  placeholder="Seleccionar medio de cobro..."
                />
              </div>

              {/* Referencia */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Referencia / Nº Transacción (opcional)
                </label>
                <Input
                  type="text"
                  value={referenciaPago}
                  onChange={(e) => setReferenciaPago(e.target.value)}
                  placeholder="Ej: Transferencia #12345"
                />
              </div>

              {/* Saldo pendiente */}
              {montoPago && montoNumerico > 0 && montoNumerico <= presupuesto.total && (
                <div className="flex justify-between text-sm pt-3 border-t border-gray-200">
                  <span className="text-gray-600">Saldo pendiente:</span>
                  <span className="font-semibold text-orange-600">
                    ${saldoPendiente.toLocaleString('es-AR', { minimumFractionDigits: 0 })}
                  </span>
                </div>
              )}
            </div>
          )}
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
            disabled={submitting || !pagoValido}
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
