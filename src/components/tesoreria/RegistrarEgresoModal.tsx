import { useState } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { useToast } from '../../contexts/ToastContext';
import { useCajas } from '../../hooks/useCajas';
import { useTiposEgreso } from '../../hooks/useTiposEgreso';
import { CreateEgresoData } from '../../types/tesoreria';

interface RegistrarEgresoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onSubmit: (data: CreateEgresoData) => Promise<void>;
}

export function RegistrarEgresoModal({ isOpen, onClose, onSuccess, onSubmit }: RegistrarEgresoModalProps) {
  const { showToast } = useToast();
  const { cajas } = useCajas();
  const { tipos } = useTiposEgreso();

  const [formData, setFormData] = useState<CreateEgresoData>({
    caja_id: '',
    tipo_egreso_id: '',
    monto: 0,
    concepto: '',
    fecha: new Date().toISOString().split('T')[0],
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const selectedCaja = cajas.find(c => c.id === formData.caja_id);
  const saldoSuficiente = selectedCaja ? selectedCaja.saldo_actual >= formData.monto : false;
  const nuevoSaldo = selectedCaja ? selectedCaja.saldo_actual - formData.monto : 0;

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.caja_id) newErrors.caja_id = 'Selecciona una caja';
    if (!formData.tipo_egreso_id) newErrors.tipo_egreso_id = 'Selecciona un tipo de egreso';
    if (!formData.monto || formData.monto <= 0) newErrors.monto = 'Ingresa un monto válido';
    if (!formData.concepto?.trim()) newErrors.concepto = 'Ingresa un concepto';
    if (!formData.fecha) newErrors.fecha = 'Selecciona una fecha';

    if (selectedCaja && formData.monto > selectedCaja.saldo_actual) {
      newErrors.monto = 'Saldo insuficiente en la caja';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      await onSubmit(formData);
      showToast('Egreso registrado correctamente', 'success');
      onSuccess();
      handleClose();
    } catch (error: any) {
      console.error('Error al registrar egreso:', error);
      showToast(error.message || 'Error al registrar el egreso', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({
      caja_id: '',
      tipo_egreso_id: '',
      monto: 0,
      concepto: '',
      fecha: new Date().toISOString().split('T')[0],
    });
    setErrors({});
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Registrar Egreso">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fecha *
            </label>
            <Input
              type="date"
              value={formData.fecha}
              onChange={(e) => setFormData({ ...formData, fecha: e.target.value })}
              error={errors.fecha}
            />
          </div>

          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Caja *
            </label>
            <Select
              value={formData.caja_id}
              onChange={(value) => setFormData({ ...formData, caja_id: value })}
              error={errors.caja_id}
            >
              <option value="">Seleccionar caja</option>
              {cajas.filter(c => c.is_active).map((caja) => (
                <option key={caja.id} value={caja.id}>
                  {caja.nombre} - Saldo: ${Number(caja.saldo_actual).toLocaleString('es-AR', { minimumFractionDigits: 2 })} {caja.moneda}
                </option>
              ))}
            </Select>
            {selectedCaja && (
              <div className={`mt-2 p-2 rounded text-sm ${saldoSuficiente ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                <div className="flex items-center gap-2">
                  {!saldoSuficiente && <AlertCircle className="w-4 h-4" />}
                  <span>
                    Saldo actual: ${Number(selectedCaja.saldo_actual).toLocaleString('es-AR', { minimumFractionDigits: 2 })} →
                    Nuevo saldo: ${nuevoSaldo.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tipo de Egreso *
            </label>
            <Select
              value={formData.tipo_egreso_id}
              onChange={(value) => setFormData({ ...formData, tipo_egreso_id: value })}
              error={errors.tipo_egreso_id}
            >
              <option value="">Seleccionar tipo</option>
              {tipos.map((tipo) => (
                <option key={tipo.id} value={tipo.id}>
                  {tipo.nombre}
                </option>
              ))}
            </Select>
          </div>

          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Monto *
            </label>
            <Input
              type="number"
              step="0.01"
              min="0.01"
              value={formData.monto || ''}
              onChange={(e) => setFormData({ ...formData, monto: parseFloat(e.target.value) || 0 })}
              error={errors.monto}
              placeholder="0.00"
            />
          </div>

          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Concepto *
            </label>
            <Input
              value={formData.concepto}
              onChange={(e) => setFormData({ ...formData, concepto: e.target.value })}
              error={errors.concepto}
              placeholder="Descripción del gasto"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Proveedor
            </label>
            <Input
              value={formData.proveedor_nombre || ''}
              onChange={(e) => setFormData({ ...formData, proveedor_nombre: e.target.value })}
              placeholder="Nombre del proveedor"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              N° Comprobante
            </label>
            <Input
              value={formData.numero_comprobante || ''}
              onChange={(e) => setFormData({ ...formData, numero_comprobante: e.target.value })}
              placeholder="Factura, recibo, etc."
            />
          </div>

          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Medio de Pago
            </label>
            <Select
              value={formData.medio_pago || ''}
              onChange={(value) => setFormData({ ...formData, medio_pago: value as any })}
            >
              <option value="">Seleccionar medio</option>
              <option value="efectivo">Efectivo</option>
              <option value="transferencia">Transferencia</option>
              <option value="cheque">Cheque</option>
              <option value="tarjeta">Tarjeta de Crédito</option>
              <option value="debito">Tarjeta de Débito</option>
              <option value="otro">Otro</option>
            </Select>
          </div>

          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notas
            </label>
            <textarea
              value={formData.notas || ''}
              onChange={(e) => setFormData({ ...formData, notas: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={3}
              placeholder="Información adicional"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button type="button" variant="secondary" onClick={handleClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={loading || !saldoSuficiente}>
            {loading ? 'Registrando...' : 'Registrar Egreso'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
