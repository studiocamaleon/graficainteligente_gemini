import { useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { SearchableSelect } from '../ui/SearchableSelect';
import { useToast } from '../../contexts/ToastContext';
import { useCajas } from '../../hooks/useCajas';
import { useTiposIngreso } from '../../hooks/useTiposIngreso';
import { useMediosCobro } from '../../hooks/useMediosCobro';
import { CreateIngresoData } from '../../types/tesoreria';

interface RegistrarIngresoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onSubmit: (data: CreateIngresoData) => Promise<void>;
}

export function RegistrarIngresoModal({ isOpen, onClose, onSuccess, onSubmit }: RegistrarIngresoModalProps) {
  const { showSuccess, showError } = useToast();
  const { cajas } = useCajas();
  const { tipos } = useTiposIngreso();
  const { mediosCobro } = useMediosCobro();

  const [formData, setFormData] = useState<CreateIngresoData>({
    caja_id: '',
    tipo_ingreso_id: '',
    monto: 0,
    concepto: '',
    fecha: new Date().toISOString().split('T')[0],
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const selectedCaja = cajas.find(c => c.id === formData.caja_id);
  const nuevoSaldo = selectedCaja ? selectedCaja.saldo_actual + formData.monto : 0;

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.caja_id) newErrors.caja_id = 'Selecciona una caja';
    if (!formData.tipo_ingreso_id) newErrors.tipo_ingreso_id = 'Selecciona una categoría';
    if (!formData.monto || formData.monto <= 0) newErrors.monto = 'Ingresa un monto válido';
    if (!formData.concepto?.trim()) newErrors.concepto = 'Ingresa un detalle';
    if (formData.concepto && formData.concepto.trim().length < 5) {
      newErrors.concepto = 'El detalle debe tener al menos 5 caracteres';
    }
    if (!formData.fecha) newErrors.fecha = 'Selecciona una fecha';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      await onSubmit(formData);
      showSuccess('Ingreso registrado correctamente');
      onSuccess();
      handleClose();
    } catch (error: any) {
      console.error('Error al registrar ingreso:', error);
      showError(error.message || 'Error al registrar el ingreso');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({
      caja_id: '',
      tipo_ingreso_id: '',
      monto: 0,
      concepto: '',
      fecha: new Date().toISOString().split('T')[0],
    });
    setErrors({});
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Registrar Ingreso Manual">
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
              Caja Destino *
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
            {selectedCaja && formData.monto > 0 && (
              <div className="mt-2 p-2 rounded text-sm bg-green-50 text-green-700">
                <div className="flex items-center gap-2">
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
              Categoría *
            </label>
            <Select
              value={formData.tipo_ingreso_id}
              onChange={(value) => setFormData({ ...formData, tipo_ingreso_id: value })}
              error={errors.tipo_ingreso_id}
            >
              <option value="">Seleccionar categoría</option>
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
              Concepto / Detalle *
            </label>
            <Input
              value={formData.concepto}
              onChange={(e) => setFormData({ ...formData, concepto: e.target.value })}
              error={errors.concepto}
              placeholder="Descripción detallada del ingreso"
            />
          </div>

          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Origen
            </label>
            <Input
              value={formData.origen || ''}
              onChange={(e) => setFormData({ ...formData, origen: e.target.value })}
              placeholder="De quién o dónde proviene (ej: Juan Pérez, Banco Santander)"
            />
            <p className="text-xs text-gray-500 mt-1">
              Opcional: Indica de quién o dónde proviene el ingreso
            </p>
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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Medio de Cobro
            </label>
            <SearchableSelect
              value={formData.medio_cobro_id || ''}
              onChange={(value) => setFormData({ ...formData, medio_cobro_id: value })}
              options={mediosCobro.map(m => ({
                value: m.id,
                label: m.nombre
              }))}
              placeholder="Seleccionar medio..."
              emptyMessage="No se encontraron medios de cobro"
            />
            <p className="text-xs text-gray-500 mt-1">
              Opcional: Si se aplicará comisión
            </p>
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
          <Button type="submit" disabled={loading}>
            {loading ? 'Registrando...' : 'Registrar Ingreso'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
