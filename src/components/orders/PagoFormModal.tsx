import { useState, useEffect } from 'react';
import { X, DollarSign, AlertCircle, TrendingDown, Calendar } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { useMediosCobro } from '../../hooks/useMediosCobro';
import { MedioCobroSelector } from '../medios-cobro/MedioCobroSelector';

interface PagoFormData {
  fecha_pago: string;
  monto: number;
  medio_cobro_id: string;
  referencia_pago: string;
  notas: string;
}

interface PagoFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: PagoFormData) => void;
  saldoPendiente: number;
  pago?: PagoFormData & { id: string };
}

export function PagoFormModal({
  isOpen,
  onClose,
  onSubmit,
  saldoPendiente,
  pago,
}: PagoFormModalProps) {
  const { mediosCobro, calcularComisionYLiberacion } = useMediosCobro();

  const [formData, setFormData] = useState<PagoFormData>({
    fecha_pago: new Date().toISOString().split('T')[0],
    monto: 0,
    medio_cobro_id: '',
    referencia_pago: '',
    notas: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (pago) {
      setFormData({
        fecha_pago: pago.fecha_pago,
        monto: pago.monto,
        medio_cobro_id: pago.medio_cobro_id,
        referencia_pago: pago.referencia_pago || '',
        notas: pago.notas || '',
      });
    } else {
      setFormData({
        fecha_pago: new Date().toISOString().split('T')[0],
        monto: 0,
        medio_cobro_id: '',
        referencia_pago: '',
        notas: '',
      });
    }
    setErrors({});
  }, [pago, isOpen]);

  const mediosActivos = mediosCobro.filter((m) => m.is_active);

  const calculos = formData.medio_cobro_id && formData.monto > 0
    ? calcularComisionYLiberacion(formData.medio_cobro_id, formData.monto)
    : null;

  const saldoRestante = saldoPendiente - formData.monto;

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.fecha_pago) {
      newErrors.fecha_pago = 'La fecha es requerida';
    } else {
      const fechaPago = new Date(formData.fecha_pago);
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);

      if (fechaPago > hoy) {
        newErrors.fecha_pago = 'La fecha no puede ser futura';
      }
    }

    if (!formData.monto || formData.monto <= 0) {
      newErrors.monto = 'El monto debe ser mayor a 0';
    } else if (formData.monto > saldoPendiente) {
      newErrors.monto = `El monto no puede exceder el saldo pendiente ($${saldoPendiente.toFixed(2)})`;
    }

    if (!formData.medio_cobro_id) {
      newErrors.medio_cobro_id = 'Debe seleccionar un medio de cobro';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    onSubmit(formData);
    onClose();
  };

  const handleMontoChange = (value: string) => {
    const monto = parseFloat(value) || 0;
    setFormData({ ...formData, monto });
  };

  const handleMontoRapido = (porcentaje: number) => {
    const monto = (saldoPendiente * porcentaje) / 100;
    setFormData({ ...formData, monto: Math.round(monto * 100) / 100 });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">
            {pago ? 'Editar Pago' : 'Registrar Pago'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Información del Saldo */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-blue-900">Saldo Pendiente</span>
              <span className="text-2xl font-bold text-blue-900">
                ${saldoPendiente.toFixed(2)}
              </span>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => handleMontoRapido(25)}
              >
                25%
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => handleMontoRapido(50)}
              >
                50%
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => handleMontoRapido(100)}
              >
                100%
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Fecha de Pago */}
            <div>
              <label htmlFor="fecha_pago" className="block text-sm font-medium text-gray-700 mb-1">
                Fecha de Pago *
              </label>
              <Input
                type="date"
                id="fecha_pago"
                value={formData.fecha_pago}
                onChange={(e) => setFormData({ ...formData, fecha_pago: e.target.value })}
                max={new Date().toISOString().split('T')[0]}
              />
              {errors.fecha_pago && (
                <p className="text-sm text-red-600 mt-1">{errors.fecha_pago}</p>
              )}
            </div>

            {/* Monto */}
            <div>
              <label htmlFor="monto" className="block text-sm font-medium text-gray-700 mb-1">
                Monto *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                <Input
                  type="number"
                  id="monto"
                  min="0"
                  step="0.01"
                  value={formData.monto || ''}
                  onChange={(e) => handleMontoChange(e.target.value)}
                  className="pl-7"
                  placeholder="0.00"
                />
              </div>
              {errors.monto && (
                <p className="text-sm text-red-600 mt-1">{errors.monto}</p>
              )}
            </div>
          </div>

          {/* Medio de Cobro */}
          <div>
            <label htmlFor="medio_cobro" className="block text-sm font-medium text-gray-700 mb-1">
              Medio de Cobro *
            </label>
            <MedioCobroSelector
              value={formData.medio_cobro_id}
              onChange={(value) => setFormData({ ...formData, medio_cobro_id: value })}
              medios={mediosActivos}
              required
              showDetails
            />
            {errors.medio_cobro_id && (
              <p className="text-sm text-red-600 mt-1">{errors.medio_cobro_id}</p>
            )}
          </div>

          {/* Cálculos en Tiempo Real */}
          {calculos && formData.monto > 0 && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                {calculos.comision > 0 && (
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <TrendingDown className="w-4 h-4 text-orange-600" />
                      <span className="text-sm text-orange-700 font-medium">Comisión</span>
                    </div>
                    <p className="text-xl font-bold text-orange-900">
                      ${calculos.comision.toFixed(2)}
                    </p>
                    <p className="text-xs text-orange-600 mt-1">
                      Monto neto: ${calculos.montoNeto.toFixed(2)}
                    </p>
                  </div>
                )}

                {calculos.diasLiberacion > 0 && (
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Calendar className="w-4 h-4 text-purple-600" />
                      <span className="text-sm text-purple-700 font-medium">Liberación</span>
                    </div>
                    <p className="text-xl font-bold text-purple-900">
                      {calculos.diasLiberacion} días
                    </p>
                    <p className="text-xs text-purple-600 mt-1">
                      {calculos.fechaLiberacion.toLocaleDateString('es-AR')}
                    </p>
                  </div>
                )}
              </div>

              {/* Saldo Restante */}
              <div className={`border rounded-lg p-3 ${
                saldoRestante > 0 ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'
              }`}>
                <div className="flex items-center justify-between">
                  <span className={`text-sm font-medium ${
                    saldoRestante > 0 ? 'text-amber-700' : 'text-green-700'
                  }`}>
                    Saldo Restante después de este pago
                  </span>
                  <span className={`text-2xl font-bold ${
                    saldoRestante > 0 ? 'text-amber-900' : 'text-green-900'
                  }`}>
                    ${saldoRestante.toFixed(2)}
                  </span>
                </div>
                {saldoRestante > 0 && (
                  <div className="flex items-center gap-1 mt-2">
                    <AlertCircle className="w-4 h-4 text-amber-600" />
                    <p className="text-xs text-amber-700">
                      Quedará saldo pendiente por cobrar
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Referencia */}
          <div>
            <label htmlFor="referencia" className="block text-sm font-medium text-gray-700 mb-1">
              Referencia / Comprobante
            </label>
            <Input
              type="text"
              id="referencia"
              value={formData.referencia_pago}
              onChange={(e) => setFormData({ ...formData, referencia_pago: e.target.value })}
              placeholder="Número de transacción, cheque, etc."
            />
          </div>

          {/* Notas */}
          <div>
            <label htmlFor="notas" className="block text-sm font-medium text-gray-700 mb-1">
              Notas
            </label>
            <textarea
              id="notas"
              rows={3}
              value={formData.notas}
              onChange={(e) => setFormData({ ...formData, notas: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              placeholder="Notas adicionales sobre este pago..."
            />
          </div>

          {/* Botones */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!formData.monto || !formData.medio_cobro_id}>
              <DollarSign className="w-4 h-4 mr-2" />
              {pago ? 'Actualizar Pago' : 'Registrar Pago'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
