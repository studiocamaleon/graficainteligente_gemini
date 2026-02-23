import { useEffect, useMemo, useState } from 'react';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { useProviders } from '../../hooks/useProviders';
import { useClients } from '../../hooks/useClients';
import { useBanks } from '../../hooks/useBanks';
import { SearchableSelect } from '../ui/SearchableSelect';
import { CreateBankModal } from '../providers/CreateBankModal';
import type { Cheque, ChequeDirection, ChequeStatus, ChequeType } from '../../types/database';
import { useAuth } from '../../hooks/useAuth';

interface CreateChequeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: ChequeFormSubmitData) => Promise<void>;
  chequeToEdit?: Cheque | null;
}

interface ChequeFormData {
  tipo: ChequeType;
  numero_cheque: string;
  banco: string;
  fecha_emision: string;
  fecha_pago: string;
  monto: string;
  direction: ChequeDirection;
  destinatario: string;
  proveedor_id: string;
  client_id: string;
  estado: ChequeStatus;
  descripcion: string;
}

export interface ChequeFormSubmitData {
  tipo: ChequeType;
  numero_cheque: string;
  banco: string;
  fecha_emision: string;
  fecha_pago: string;
  monto: number;
  direction: ChequeDirection;
  destinatario: string | null;
  proveedor_id: string | null;
  client_id: string | null;
  estado: ChequeStatus;
  descripcion: string | null;
}

const CHEQUE_TYPES: { value: ChequeType; label: string }[] = [
  { value: 'fisico', label: 'Cheque Físico' },
  { value: 'echeq', label: 'E-Cheq (Digital)' },
];

const CHEQUE_STATUSES: { value: ChequeStatus; label: string }[] = [
  { value: 'pendiente', label: 'Pendiente' },
  { value: 'pagado', label: 'Pagado / Debitado' },
  { value: 'anulado', label: 'Anulado' },
];

const getToday = () => new Date().toISOString().split('T')[0];

const getInitialFormData = (): ChequeFormData => ({
  tipo: 'fisico',
  numero_cheque: '',
  banco: '',
  fecha_emision: getToday(),
  fecha_pago: getToday(),
  monto: '',
  direction: 'emitido',
  destinatario: '',
  proveedor_id: '',
  client_id: '',
  estado: 'pendiente',
  descripcion: '',
});

export function CreateChequeModal({
  isOpen,
  onClose,
  onSubmit,
  chequeToEdit,
}: CreateChequeModalProps) {
  const { providers } = useProviders({ isActive: true });
  const { clients } = useClients();
  const { banks, refetch: refetchBanks } = useBanks('');
  const { profile } = useAuth();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [showCreateBankModal, setShowCreateBankModal] = useState(false);
  const [formData, setFormData] = useState<ChequeFormData>(getInitialFormData());

  const isSuperAdmin = profile?.role === 'super_admin';
  const isEditMode = Boolean(chequeToEdit);

  useEffect(() => {
    if (!isOpen) return;

    if (chequeToEdit) {
      setFormData({
        tipo: chequeToEdit.tipo,
        numero_cheque: chequeToEdit.numero_cheque,
        banco: chequeToEdit.banco,
        fecha_emision: chequeToEdit.fecha_emision,
        fecha_pago: chequeToEdit.fecha_pago,
        monto: chequeToEdit.monto.toString(),
        direction: chequeToEdit.direction || 'emitido',
        destinatario: chequeToEdit.destinatario || '',
        proveedor_id: chequeToEdit.proveedor_id || '',
        client_id: chequeToEdit.client_id || '',
        estado: chequeToEdit.estado,
        descripcion: chequeToEdit.descripcion || '',
      });
    } else {
      setFormData(getInitialFormData());
    }

    setFieldErrors({});
    setError(null);
  }, [chequeToEdit, isOpen]);

  const directionLabel = useMemo(
    () => (formData.direction === 'emitido' ? 'Cheque Emitido (Pago)' : 'Cheque Recibido (Cobro)'),
    [formData.direction]
  );

  const validateForm = (): boolean => {
    const nextErrors: Record<string, string> = {};
    const monto = Number(formData.monto);

    if (!formData.banco.trim()) nextErrors.banco = 'El banco es obligatorio.';
    if (!formData.numero_cheque.trim()) nextErrors.numero_cheque = 'El número de cheque es obligatorio.';
    if (!formData.fecha_emision) nextErrors.fecha_emision = 'La fecha de emisión es obligatoria.';
    if (!formData.fecha_pago) nextErrors.fecha_pago = 'La fecha de pago es obligatoria.';
    if (!Number.isFinite(monto) || monto <= 0) nextErrors.monto = 'Ingresá un monto válido mayor a 0.';
    if (formData.fecha_emision && formData.fecha_pago && formData.fecha_pago < formData.fecha_emision) {
      nextErrors.fecha_pago = 'La fecha de pago no puede ser anterior a la de emisión.';
    }

    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validateForm()) return;

    setLoading(true);
    try {
      await onSubmit({
        tipo: formData.tipo,
        numero_cheque: formData.numero_cheque.trim(),
        banco: formData.banco.trim(),
        fecha_emision: formData.fecha_emision,
        fecha_pago: formData.fecha_pago,
        monto: Number(formData.monto),
        direction: formData.direction,
        destinatario: formData.destinatario.trim() || null,
        proveedor_id: formData.direction === 'emitido' ? (formData.proveedor_id || null) : null,
        client_id: formData.direction === 'recibido' ? (formData.client_id || null) : null,
        estado: formData.estado,
        descripcion: formData.descripcion.trim() || null,
      });
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al guardar';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleProviderChange = (providerId: string) => {
    const provider = providers.find((p) => p.id === providerId);
    setFormData((prev) => ({
      ...prev,
      proveedor_id: providerId,
      destinatario: provider?.razon_social || provider?.nombre_fantasia || prev.destinatario,
    }));
  };

  const handleClientChange = (clientId: string) => {
    setFormData((prev) => ({
      ...prev,
      client_id: clientId,
      destinatario: prev.destinatario || 'A la orden de la Empresa',
    }));
  };

  const handleDirectionChange = (direction: ChequeDirection) => {
    if (isEditMode) return;
    setFormData((prev) => ({
      ...prev,
      direction,
      destinatario: direction === 'recibido' ? 'A la orden de la Empresa' : '',
      proveedor_id: '',
      client_id: '',
    }));
  };

  const handleBankCreated = (bankName: string) => {
    setFormData((prev) => ({ ...prev, banco: bankName }));
    refetchBanks();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={chequeToEdit ? 'Editar Cheque' : `Nuevo ${directionLabel}`}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>}

        <div className="mb-4 rounded-lg bg-gray-100 p-1">
          <div className="flex">
            <button
              type="button"
              disabled={isEditMode}
              className={`flex-1 rounded-md px-3 py-1 text-sm font-medium transition-colors ${
                formData.direction === 'emitido'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-900'
              } ${isEditMode ? 'cursor-not-allowed opacity-70' : ''}`}
              onClick={() => handleDirectionChange('emitido')}
            >
              Cheque Emitido (Pago)
            </button>
            <button
              type="button"
              disabled={isEditMode}
              className={`flex-1 rounded-md px-3 py-1 text-sm font-medium transition-colors ${
                formData.direction === 'recibido'
                  ? 'bg-white text-green-700 shadow-sm'
                  : 'text-gray-500 hover:text-gray-900'
              } ${isEditMode ? 'cursor-not-allowed opacity-70' : ''}`}
              onClick={() => handleDirectionChange('recibido')}
            >
              Cheque Recibido (Cobro)
            </button>
          </div>
          {isEditMode && (
            <p className="mt-2 px-2 text-xs text-gray-500">
              La dirección no se puede modificar en edición para evitar desalinear la proyección.
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Tipo de Instrumento</label>
            <Select
              value={formData.tipo}
              onChange={(val) => setFormData((prev) => ({ ...prev, tipo: val as ChequeType }))}
              options={CHEQUE_TYPES}
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Estado</label>
            <Select
              value={formData.estado}
              onChange={(val) => setFormData((prev) => ({ ...prev, estado: val as ChequeStatus }))}
              options={CHEQUE_STATUSES}
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Banco</label>
            <SearchableSelect
              value={formData.banco}
              onChange={(value) => setFormData((prev) => ({ ...prev, banco: value }))}
              options={banks.map((bank) => ({ value: bank.name, label: bank.name }))}
              placeholder="Seleccionar banco"
              allowCreate={isSuperAdmin}
              onCreateNew={() => setShowCreateBankModal(true)}
              createLabel="Crear nuevo banco"
            />
            {fieldErrors.banco && <p className="mt-1 text-xs text-red-600">{fieldErrors.banco}</p>}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">N° Cheque</label>
            <Input
              value={formData.numero_cheque}
              onChange={(e) => setFormData((prev) => ({ ...prev, numero_cheque: e.target.value }))}
              placeholder="Ej: 12345678"
              required
              error={fieldErrors.numero_cheque}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Fecha Emisión *</label>
            <Input
              type="date"
              value={formData.fecha_emision}
              onChange={(e) => setFormData((prev) => ({ ...prev, fecha_emision: e.target.value }))}
              required
              error={fieldErrors.fecha_emision}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Fecha Pago (Cashflow) *</label>
            <Input
              type="date"
              value={formData.fecha_pago}
              onChange={(e) => setFormData((prev) => ({ ...prev, fecha_pago: e.target.value }))}
              required
              error={fieldErrors.fecha_pago}
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Monto *</label>
          <Input
            type="number"
            value={formData.monto}
            onChange={(e) => setFormData((prev) => ({ ...prev, monto: e.target.value }))}
            placeholder="0.00"
            min="0"
            step="0.01"
            required
            className="text-lg font-bold"
            error={fieldErrors.monto}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          {formData.direction === 'emitido' ? (
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Proveedor (Opcional)</label>
              <Select
                value={formData.proveedor_id}
                onChange={handleProviderChange}
                options={providers.map((p) => ({ value: p.id, label: p.nombre_fantasia }))}
                placeholder="Seleccionar..."
              />
            </div>
          ) : (
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Cliente (De quién se recibe)</label>
              <Select
                value={formData.client_id}
                onChange={handleClientChange}
                options={clients.map((c) => ({ value: c.id, label: c.nombre_fantasia || c.razon_social }))}
                placeholder="Seleccionar..."
              />
            </div>
          )}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Destinatario / A la orden de</label>
            <Input
              value={formData.destinatario}
              onChange={(e) => setFormData((prev) => ({ ...prev, destinatario: e.target.value }))}
              placeholder={formData.direction === 'emitido' ? 'Nombre del beneficiario' : 'Ej: Nosotros / Endosado'}
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Descripción / Referencia</label>
          <Input
            value={formData.descripcion}
            onChange={(e) => setFormData((prev) => ({ ...prev, descripcion: e.target.value }))}
            placeholder="Ej: Pago Factura A-0001"
          />
        </div>

        <div className="flex justify-end gap-3 border-t pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? 'Guardando...' : chequeToEdit ? 'Actualizar' : 'Crear'}
          </Button>
        </div>
      </form>

      {showCreateBankModal && (
        <CreateBankModal onClose={() => setShowCreateBankModal(false)} onSuccess={handleBankCreated} />
      )}
    </Modal>
  );
}
