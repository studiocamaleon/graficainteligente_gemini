import { useState, useEffect } from 'react';
import { X, DollarSign, AlertCircle, TrendingDown, Calendar } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { useMediosCobro } from '../../hooks/useMediosCobro';
import { useBanks } from '../../hooks/useBanks'; // Added import
import { MedioCobroSelector } from '../medios-cobro/MedioCobroSelector';
import { getArgentinaDateString, isDateInFuture } from '../../utils/dates';

export interface PagoFormData {
  fecha_pago: string;
  monto: number;
  medio_cobro_id: string;
  referencia_pago: string;
  notas: string;
  cheque_data?: {
    numero_cheque: string;
    fecha_pago: string;
    banco: string;
    titular?: string;
    tipo: 'fisico' | 'echeq';
  };
}

interface PagoFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: PagoFormData) => void;
  saldoPendiente: number;
  pago?: PagoFormData & { id: string };
  clientName?: string;
}

export function PagoFormModal({
  isOpen,
  onClose,
  onSubmit,
  saldoPendiente,
  pago,
  clientName,
}: PagoFormModalProps) {
  const { mediosCobro, fetchMediosCobroActivos, calcularComisionYLiberacion } = useMediosCobro();
  const { banks } = useBanks('');



  const [formData, setFormData] = useState<PagoFormData>({
    fecha_pago: getArgentinaDateString(),
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
        fecha_pago: getArgentinaDateString(),
        monto: 0,
        medio_cobro_id: '',
        referencia_pago: '',
        notas: '',
      });
    }
    setErrors({});
  }, [pago, isOpen]);

  useEffect(() => {
    if (isOpen) {
      fetchMediosCobroActivos();
    }
  }, [isOpen, fetchMediosCobroActivos]);

  const handlePercentageClick = (pct: number) => {
    // Si estamos editando un pago, el "saldo real" sobre el cual calcular porcentaje
    // es el (Saldo Pendiente + Monto del Pago que se está editando).
    // Si es nuevo pago, es solo Saldo Pendiente.
    const baseCalculo = pago ? (saldoPendiente + pago.monto) : saldoPendiente;
    const newMonto = Number((baseCalculo * pct).toFixed(2));
    setFormData(prev => ({ ...prev, monto: newMonto }));
  };

  /* New Cheque Data State */
  const [chequeData, setChequeData] = useState<{
    numero_cheque: string;
    fecha_pago: string;
    banco: string;
    titular: string;
    tipo: 'fisico' | 'echeq';
  }>({
    numero_cheque: '',
    fecha_pago: '',
    banco: '',
    titular: '',
    tipo: 'fisico'
  });

  /* Check if selected Medio de Cobro is Cheque */
  const selectedMedio = mediosCobro.find(m => m.id === formData.medio_cobro_id);
  const isCheque = selectedMedio?.nombre.toLowerCase().includes('cheque');

  const calculos = formData.medio_cobro_id && formData.monto > 0
    ? calcularComisionYLiberacion(formData.medio_cobro_id, formData.monto)
    : null;

  const saldoRestante = saldoPendiente - formData.monto;

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.fecha_pago) {
      newErrors.fecha_pago = 'La fecha es requerida';
    } else if (isDateInFuture(formData.fecha_pago)) {
      newErrors.fecha_pago = 'La fecha no puede ser futura';
    }

    if (!formData.monto || formData.monto <= 0) {
      newErrors.monto = 'El monto debe ser mayor a 0';
    } else if (formData.monto > saldoPendiente) {
      newErrors.monto = `El monto no puede exceder el saldo pendiente ($${saldoPendiente.toFixed(2)})`;
    }

    if (!formData.medio_cobro_id) {
      newErrors.medio_cobro_id = 'Debe seleccionar un medio de cobro';
    }

    if (isCheque) {
      if (!chequeData.numero_cheque) newErrors.numero_cheque = 'Requerido';
      if (!chequeData.fecha_pago) newErrors.fecha_pago_cheque = 'Requerido';
      if (!chequeData.banco) newErrors.banco = 'Requerido';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    const submitData: any = {
      ...formData
    };

    if (isCheque) {
      submitData.cheque_data = chequeData;
    }

    onSubmit(submitData);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center ${!isOpen ? 'hidden' : ''}`}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-blue-600" />
            {pago ? 'Editar Pago' : 'Registrar Pago'}
          </h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-sm font-medium text-gray-700">
                Monto
              </label>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => handlePercentageClick(0.25)}
                  className="px-2 py-0.5 text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 rounded border border-gray-200 transition-colors"
                >
                  25%
                </button>
                <button
                  type="button"
                  onClick={() => handlePercentageClick(0.50)}
                  className="px-2 py-0.5 text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 rounded border border-gray-200 transition-colors"
                >
                  50%
                </button>
                <button
                  type="button"
                  onClick={() => handlePercentageClick(1.0)}
                  className="px-2 py-0.5 text-xs bg-blue-50 hover:bg-blue-100 text-blue-600 rounded border border-blue-200 transition-colors font-medium"
                >
                  100%
                </button>
              </div>
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <span className="text-gray-500 sm:text-sm">$</span>
              </div>
              <Input
                type="number"
                step="0.01"
                min="0"
                className="pl-7"
                value={formData.monto || ''}
                onChange={(e) => setFormData({ ...formData, monto: parseFloat(e.target.value) || 0 })}
                error={errors.monto}
              />
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Saldo pendiente: ${saldoPendiente.toFixed(2)}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Medio de Cobro
            </label>
            <MedioCobroSelector
              medios={mediosCobro}
              value={formData.medio_cobro_id}
              onChange={(value) => setFormData({ ...formData, medio_cobro_id: value })}
            />
            {errors.medio_cobro_id && <p className="text-xs text-red-500 mt-1">{errors.medio_cobro_id}</p>}
          </div>


          {isCheque && (
            <div className="bg-blue-50 p-4 rounded-lg space-y-3">
              <h4 className="text-sm font-semibold text-blue-800 border-b border-blue-200 pb-1">Datos del Cheque Recibido</h4>

              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-700 mb-1">Tipo de Cheque</label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="cheque_tipo"
                        checked={chequeData.tipo === 'fisico'}
                        onChange={() => setChequeData({ ...chequeData, tipo: 'fisico' })}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">Físico (Papel)</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="cheque_tipo"
                        checked={chequeData.tipo === 'echeq'}
                        onChange={() => setChequeData({ ...chequeData, tipo: 'echeq' })}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">E-Cheq (Digital)</span>
                    </label>
                  </div>
                  {errors.tipo_cheque && <p className="text-xs text-red-500 mt-1">{errors.tipo_cheque}</p>}
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Nro. Cheque *</label>
                  <Input
                    value={chequeData.numero_cheque}
                    onChange={e => setChequeData({ ...chequeData, numero_cheque: e.target.value })}
                    placeholder="Ej: 556677"
                    error={errors.numero_cheque}
                    className="bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Fecha Pago (Venc) *</label>
                  <Input
                    type="date"
                    value={chequeData.fecha_pago}
                    onChange={e => setChequeData({ ...chequeData, fecha_pago: e.target.value })}
                    error={errors.fecha_pago_cheque}
                    className="bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Banco *</label>
                <select
                  value={chequeData.banco}
                  onChange={e => setChequeData({ ...chequeData, banco: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white ${errors.banco ? 'border-red-300' : 'border-gray-300'}`}
                >
                  <option value="">Seleccionar Banco...</option>

                  {banks.map(b => (
                    <option key={b.id} value={b.name}>{b.name}</option>
                  ))}
                  <option value="OTRO">OTRO</option>
                </select>
                {errors.banco && <p className="text-xs text-red-500 mt-1">{errors.banco}</p>}
              </div>
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-medium text-gray-700">Titular (Firmante)</label>
                  {clientName && (
                    <button
                      type="button"
                      onClick={() => setChequeData({ ...chequeData, titular: clientName })}
                      className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                    >
                      Usar {clientName}
                    </button>
                  )}
                </div>
                <Input
                  value={chequeData.titular}
                  onChange={e => setChequeData({ ...chequeData, titular: e.target.value })}
                  placeholder="Opcional"
                  className="bg-white"
                />
              </div>
            </div>
          )}

          {calculos && formData.monto > 0 && (
            <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 text-sm space-y-2">
              {calculos.comision > 0 && (
                <div className="flex justify-between text-orange-700">
                  <span className="flex items-center gap-1"><TrendingDown className="w-3 h-3" /> Comisión</span>
                  <span>-${calculos.comision.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between font-medium text-gray-900 border-t border-gray-200 pt-1">
                <span>Neto a recibir:</span>
                <span className="text-green-600">${calculos.montoNeto.toFixed(2)}</span>
              </div>
              {calculos.diasLiberacion > 0 && (
                <div className="text-xs text-blue-600 flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  <span>Se libera el {calculos.fechaLiberacion.toLocaleDateString()}</span>
                </div>
              )}
            </div>
          )}

          {saldoRestante > 0 && (
            <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm">
              <AlertCircle className="w-4 h-4 text-amber-600" />
              <span>Quedará un saldo pendiente de <strong>${saldoRestante.toFixed(2)}</strong></span>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Referencia / Nro Comprobante
            </label>
            <Input
              value={formData.referencia_pago}
              onChange={(e) => setFormData({ ...formData, referencia_pago: e.target.value })}
              placeholder="Ej: Transferencia #1234"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notas (Opcional)
            </label>
            <textarea
              rows={3}
              value={formData.notas}
              onChange={(e) => setFormData({ ...formData, notas: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              placeholder="Notas adicionales sobre este pago..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit">
              {pago ? 'Actualizar Pago' : 'Registrar Pago'}
            </Button>
          </div>
        </form>
      </div >
    </div >
  );
}
