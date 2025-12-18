import { useState } from 'react';
import { Calendar, DollarSign, Receipt, Info } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { MedioCobroSelector } from '../medios-cobro/MedioCobroSelector';
import { useMediosCobro } from '../../hooks/useMediosCobro';
import type { PresupuestoConRelaciones } from '../../types/presupuestos';

interface ConvertirPresupuestoModalProps {
  isOpen: boolean;
  onClose: () => void;
  presupuesto: PresupuestoConRelaciones;
  onConvertir: (params: {
    fechaEntrega: string;
    notasAdicionales?: string;
    montoPago?: number;
    medioCobroId?: string;
    referenciaPago?: string;
    rutasPersonalizadas?: Record<string, any[]>;
    requiereFactura?: boolean;
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
  const [submitting, setSubmitting] = useState(false);

  // Estados para pago inicial
  const [registrarPago, setRegistrarPago] = useState(false);
  const [montoPago, setMontoPago] = useState<string>('');
  const [medioCobroId, setMedioCobroId] = useState<string>('');
  const [referenciaPago, setReferenciaPago] = useState('');
  const [requiereFactura, setRequiereFactura] = useState(true);

  const { mediosCobro } = useMediosCobro();

  // Verificar si hay items que NO tienen rutas guardadas
  const itemsSinRutas = (presupuesto.items || []).filter(item =>
    (!item.rutas_generadas || item.rutas_generadas.length === 0)
  );

  const handleSubmit = async () => {
    if (!fechaEntrega) return;

    try {
      setSubmitting(true);
      await onConvertir({
        fechaEntrega,
        notasAdicionales: notasAdicionales || undefined,
        montoPago: registrarPago && montoPago ? parseFloat(montoPago) : undefined,
        medioCobroId: registrarPago && medioCobroId ? medioCobroId : undefined,
        referenciaPago: registrarPago && referenciaPago ? referenciaPago : undefined,
        requiereFactura,
      });
      handleClose();
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
      setRegistrarPago(false);
      setMontoPago('');
      setMedioCobroId('');
      setReferenciaPago('');
      setRequiereFactura(true);
      onClose();
    }
  };

  const montoNumerico = montoPago ? parseFloat(montoPago) : 0;
  const saldoPendiente = presupuesto.total - montoNumerico;
  const pagoValido = !registrarPago || (montoNumerico > 0 && montoNumerico <= presupuesto.total && medioCobroId);
  const formularioValido = fechaEntrega && pagoValido;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Convertir a Orden de Trabajo"
      size="sm"
    >
      <div className="space-y-6">
        {/* Header resumen muy breve */}
        <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg border border-gray-100">
          <div>
            <p className="text-xs text-gray-500 uppercase font-semibold">Presupuesto</p>
            <p className="font-bold text-gray-900">{presupuesto.numero_presupuesto}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500 uppercase font-semibold">Total</p>
            <p className="font-bold text-blue-600">
              ${presupuesto.total.toLocaleString('es-AR', { minimumFractionDigits: 0 })}
            </p>
          </div>
        </div>

        {/* Fecha de entrega - Campo principal */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-400" />
            Fecha de Entrega Estimada *
          </label>
          <Input
            type="date"
            value={fechaEntrega}
            onChange={(e) => setFechaEntrega(e.target.value)}
            min={new Date().toISOString().split('T')[0]}
            required
          />
        </div>

        {/* Requiere Factura */}
        <div className="p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => setRequiereFactura(!requiereFactura)}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-6 flex items-center rounded-full p-1 transition-colors ${requiereFactura ? 'bg-blue-600' : 'bg-gray-300'}`}>
              <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${requiereFactura ? 'translate-x-4' : ''}`} />
            </div>
            <div className="flex items-center gap-2">
              <Receipt className="w-4 h-4 text-gray-400" />
              <span className="text-sm font-medium text-gray-700">Requiere Factura (+21% IVA)</span>
            </div>
          </div>
        </div>

        {/* Sección de Pago Inicial */}
        <div className={`p-4 rounded-xl border-2 transition-all ${registrarPago ? 'border-blue-100 bg-blue-50/30' : 'border-gray-100 bg-gray-50/30'}`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-bold text-gray-800">Seña o Pago Inicial</span>
            </div>
            <input
              type="checkbox"
              checked={registrarPago}
              onChange={(e) => setRegistrarPago(e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded cursor-pointer"
            />
          </div>

          {registrarPago && (
            <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Monto *</label>
                  <Input
                    type="number"
                    value={montoPago}
                    onChange={(e) => setMontoPago(e.target.value)}
                    placeholder="0.00"
                    max={presupuesto.total}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Medio *</label>
                  <MedioCobroSelector
                    value={medioCobroId}
                    onChange={setMedioCobroId}
                    medios={mediosCobro}
                  />
                </div>
              </div>

              <Input
                type="text"
                value={referenciaPago}
                onChange={(e) => setReferenciaPago(e.target.value)}
                placeholder="Nº de comprobante / Referencia"
                className="text-sm"
              />

              {montoNumerico > 0 && montoNumerico <= presupuesto.total && (
                <div className="flex justify-between items-center text-xs p-2 bg-blue-100/50 rounded text-blue-800">
                  <span>SALDO RESTANTE:</span>
                  <span className="font-bold">${saldoPendiente.toLocaleString('es-AR')}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Aviso de rutas si algún item no las tiene */}
        {itemsSinRutas.length > 0 && (
          <div className="flex items-start gap-2 p-3 bg-orange-50 rounded-lg border border-orange-100 text-[11px] text-orange-700">
            <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
            <p>
              Existen {itemsSinRutas.length} items sin ruta de producción definida.
              El sistema generará rutas automáticas para ellos basándose en su configuración.
            </p>
          </div>
        )}

        {/* Botones de acción */}
        <div className="pt-2 flex flex-col gap-2">
          <Button
            onClick={handleSubmit}
            disabled={submitting || !formularioValido}
            className="w-full h-11"
          >
            {submitting ? 'Abriendo Orden...' : 'Generar Orden de Trabajo'}
          </Button>
          <Button
            variant="ghost"
            onClick={handleClose}
            disabled={submitting}
            className="w-full text-gray-500 hover:text-gray-700"
          >
            Mantener como Presupuesto
          </Button>
        </div>
      </div>
    </Modal>
  );
}
