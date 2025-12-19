import { useState, useEffect } from 'react';
import { AlertCircle } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { SearchableSelect } from '../ui/SearchableSelect';
import { useToast } from '../../contexts/ToastContext';
import { useCajas } from '../../hooks/useCajas';
import { useTiposEgreso } from '../../hooks/useTiposEgreso';
import { useProviders } from '../../hooks/useProviders';
import { useTarjetas } from '../../hooks/useTarjetas';
import { CreateEgresoData } from '../../types/tesoreria';

interface RegistrarEgresoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onSubmit: (data: CreateEgresoData) => Promise<void>;
  // Pre-fill data
  recurrenteId?: string;
  periodoDevengado?: string;
  proveedorId?: string;
  tipoEgresoId?: string;
  lockedCajaId?: string; // New prop
  lockedMedioPago?: 'efectivo'; // New prop, currently only supporting cash for this flow
  initialData?: Partial<CreateEgresoData>;
}

export function RegistrarEgresoModal({
  isOpen,
  onClose,
  onSuccess,
  onSubmit,
  recurrenteId,
  periodoDevengado,
  proveedorId,
  tipoEgresoId,
  lockedCajaId,
  lockedMedioPago,
  initialData
}: RegistrarEgresoModalProps) {
  const { showSuccess, showError } = useToast();
  const { cajas } = useCajas();
  const { tarjetas } = useTarjetas();
  const { tipos } = useTiposEgreso();
  const { providers } = useProviders({ isActive: true });

  const [formData, setFormData] = useState<CreateEgresoData>({
    caja_id: lockedCajaId || initialData?.caja_id || '',
    tarjeta_id: '',
    tipo_egreso_id: initialData?.tipo_egreso_id || tipoEgresoId || '',
    monto: initialData?.monto || 0,
    concepto: initialData?.concepto || '',
    fecha: initialData?.fecha || new Date().toISOString().split('T')[0],
    cuotas: 1,
    medio_pago: lockedMedioPago || initialData?.medio_pago || undefined,
    recurrente_id: recurrenteId,
    periodo_devengado: periodoDevengado,
    proveedor_id: proveedorId
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen) {
      setFormData({
        caja_id: lockedCajaId || initialData?.caja_id || '',
        tarjeta_id: '',
        tipo_egreso_id: initialData?.tipo_egreso_id || tipoEgresoId || '',
        monto: initialData?.monto || 0,
        concepto: initialData?.concepto || '',
        fecha: initialData?.fecha || new Date().toISOString().split('T')[0],
        cuotas: 1,
        medio_pago: lockedMedioPago || initialData?.medio_pago || undefined,
        recurrente_id: recurrenteId,
        periodo_devengado: periodoDevengado,
        proveedor_id: proveedorId
      });
      setErrors({});
    }
  }, [isOpen, lockedCajaId, lockedMedioPago, initialData, recurrenteId, periodoDevengado, proveedorId, tipoEgresoId]);

  const selectedCaja = cajas.find(c => c.id === formData.caja_id);
  const saldoSuficiente = selectedCaja ? selectedCaja.saldo_actual >= formData.monto : false;
  const nuevoSaldo = selectedCaja ? selectedCaja.saldo_actual - formData.monto : 0;
  const isTarjeta = formData.medio_pago === 'tarjeta';
  const isCheque = formData.medio_pago === 'cheque';
  // En caso de cheque, NO necesitamos caja obligatoria si es diferido, pero por simplicidad
  // dijimos que cheque siempre es "futuro". Aunque si el usuario quiere puede seleccionar caja.
  // Pero la logica dice que si es Cheque, NO valida caja.
  const requiresCaja = !isTarjeta && !isCheque;

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (requiresCaja && !formData.caja_id) newErrors.caja_id = 'Selecciona una caja';
    if (isTarjeta && !formData.tarjeta_id) newErrors.tarjeta_id = 'Selecciona una tarjeta';

    if (isCheque) {
      if (!formData.numero_cheque) newErrors.numero_cheque = 'Requerido';
      if (!formData.fecha_pago) newErrors.fecha_pago = 'Requerido';
      if (!formData.banco) newErrors.banco = 'Requerido';
    }

    if (!formData.tipo_egreso_id) newErrors.tipo_egreso_id = 'Selecciona un concepto';
    if (!formData.monto || formData.monto <= 0) newErrors.monto = 'Ingresa un monto válido';
    if (!formData.concepto?.trim()) newErrors.concepto = 'Ingresa un detalle';
    if (!formData.fecha) newErrors.fecha = 'Selecciona una fecha';

    if (requiresCaja && selectedCaja && formData.monto > selectedCaja.saldo_actual) {
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
      showSuccess('Egreso registrado correctamente');
      onSuccess();
      handleClose();
    } catch (error: any) {
      console.error('Error al registrar egreso:', error);
      showError(error.message || 'Error al registrar el egreso');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({
      caja_id: lockedCajaId || '',
      tarjeta_id: '',
      tipo_egreso_id: '',
      monto: 0,
      concepto: '',
      fecha: new Date().toISOString().split('T')[0],
      cuotas: 1,
      medio_pago: lockedMedioPago || undefined
    });
    setErrors({});
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={lockedCajaId ? "Registrar Salida de Caja" : "Registrar Egreso"}>
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
              Medio de Pago
            </label>
            <Select
              value={formData.medio_pago || ''}
              onChange={(value) => setFormData({ ...formData, medio_pago: value as any })}
              disabled={!!lockedMedioPago}
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
            {isTarjeta && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Tarjeta Corporativa *
                    </label>
                    <Select
                      value={formData.tarjeta_id || ''}
                      onChange={(value) => setFormData({ ...formData, tarjeta_id: value })}
                      error={errors.tarjeta_id}
                    >
                      <option value="">Seleccionar tarjeta</option>
                      {tarjetas.filter(t => t.is_active).map((t) => (
                        <option key={t.id} value={t.id}>{t.nombre}</option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Cuotas *
                    </label>
                    <Select
                      value={formData.cuotas?.toString() || '1'}
                      onChange={(val) => setFormData({ ...formData, cuotas: parseInt(val) })}
                      error={errors.cuotas}
                    >
                      {[1, 3, 6, 9, 12, 18, 24].map(n => (
                        <option key={n} value={n}>{n} {n === 1 ? 'pago' : 'cuotas'}</option>
                      ))}
                    </Select>
                  </div>
                </div>
                <div className="mt-2 text-sm text-blue-600 bg-blue-50 p-2 rounded">
                  El gasto impactará en el <strong>Resumen de Tarjeta</strong> correspondiente, no afectará la caja ahora.
                </div>
              </>
            )}

            {isCheque && (
              <div className="grid grid-cols-2 gap-4 col-span-2 bg-blue-50 p-4 rounded-lg">
                <h4 className="col-span-2 text-sm font-semibold text-blue-800 mb-2">Datos del Cheque</h4>
                <div className="col-span-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nro. Cheque *</label>
                  <Input
                    value={formData.numero_cheque || ''}
                    onChange={(e) => setFormData({ ...formData, numero_cheque: e.target.value })}
                    placeholder="Ej: 12345678"
                    error={errors.numero_cheque}
                  />
                </div>
                <div className="col-span-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Pago (Venc.) *</label>
                  <Input
                    type="date"
                    value={formData.fecha_pago || ''}
                    onChange={(e) => setFormData({ ...formData, fecha_pago: e.target.value })}
                    error={errors.fecha_pago}
                  />
                </div>
                <div className="col-span-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Banco *</label>
                  <Select
                    value={formData.banco || ''}
                    onChange={(val) => setFormData({ ...formData, banco: val })}
                    error={errors.banco}
                  >
                    <option value="">Seleccionar Banco</option>
                    <option value="Santander">Santander</option>
                    <option value="Galicia">Galicia</option>
                    <option value="BBVA">BBVA</option>
                    <option value="Macro">Macro</option>
                    <option value="Nacion">Nación</option>
                    <option value="Provincia">Provincia</option>
                    <option value="Otro">Otro</option>
                  </Select>
                </div>
                <div className="col-span-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Destinatario</label>
                  <Input
                    value={formData.destinatario || ''}
                    onChange={(e) => setFormData({ ...formData, destinatario: e.target.value })}
                    placeholder="Opcional"
                  />
                </div>
              </div>
            )}

            {!isTarjeta && !isCheque && (formData.medio_pago && formData.medio_pago !== 'tarjeta' && formData.medio_pago !== 'cheque') && (
              <>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Caja *
                </label>
                <Select
                  value={formData.caja_id || ''}
                  onChange={(value) => setFormData({ ...formData, caja_id: value })}
                  error={errors.caja_id}
                  disabled={!!lockedCajaId}
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
              </>
            )}

            {recurrenteId && (
              <div className="col-span-2 mt-2 bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                <label className="flex items-center gap-3 cursor-pointer">
                  <div className="relative inline-flex items-center">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={formData.cerrar_recurrente || false}
                      onChange={(e) => setFormData({ ...formData, cerrar_recurrente: e.target.checked })}
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-yellow-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-yellow-500"></div>
                  </div>
                  <div>
                    <span className="font-medium text-yellow-900 block">Cerrar período recurrente</span>
                    <span className="text-xs text-yellow-700 block mt-0.5">Marca este período como COMPLETADO aunque el monto difiera del estimado.</span>
                  </div>
                </label>
              </div>
            )}
          </div>

          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Concepto *
            </label>
            <Select
              value={formData.tipo_egreso_id}
              onChange={(value) => setFormData({ ...formData, tipo_egreso_id: value })}
              error={errors.tipo_egreso_id}
            >
              <option value="">Seleccionar concepto</option>
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
              Detalle *
            </label>
            <Input
              value={formData.concepto}
              onChange={(e) => setFormData({ ...formData, concepto: e.target.value })}
              error={errors.concepto}
              placeholder="Descripción detallada del egreso"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Proveedor
            </label>
            <SearchableSelect
              value={formData.proveedor_id || ''}
              onChange={(value) => setFormData({ ...formData, proveedor_id: value })}
              options={providers.map(p => ({
                value: p.id,
                label: p.nombre_fantasia
              }))}
              placeholder="Buscar proveedor..."
              emptyMessage="No se encontraron proveedores"
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
          <Button type="submit" disabled={loading || (!isTarjeta && !saldoSuficiente)}>
            {loading ? 'Registrando...' : 'Registrar Egreso'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
