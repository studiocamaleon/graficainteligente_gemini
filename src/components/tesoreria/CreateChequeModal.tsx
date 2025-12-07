import { useState, useEffect } from 'react';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { useProviders } from '../../hooks/useProviders';
import { useClients } from '../../hooks/useClients';
import { useBanks } from '../../hooks/useBanks';
import { SearchableSelect } from '../ui/SearchableSelect';
import { CreateBankModal } from '../providers/CreateBankModal';
import type { Cheque, ChequeType, ChequeStatus, ChequeDirection } from '../../types/database';
import { useAuth } from '../../hooks/useAuth';

interface CreateChequeModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    onSubmit: (data: any) => Promise<void>;
    chequeToEdit?: Cheque | null;
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

export function CreateChequeModal({
    isOpen,
    onClose,
    onSuccess,
    onSubmit,
    chequeToEdit,
}: CreateChequeModalProps) {
    const { providers } = useProviders({ isActive: true });
    const { clients } = useClients();
    const { banks, refetch: refetchBanks } = useBanks('');
    const { profile } = useAuth();

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [bankSearch, setBankSearch] = useState('');
    const [showCreateBankModal, setShowCreateBankModal] = useState(false);

    const [formData, setFormData] = useState({
        tipo: 'fisico' as ChequeType,
        numero_cheque: '',
        banco: '',
        fecha_emision: new Date().toISOString().split('T')[0],
        fecha_pago: '',
        monto: '',
        direction: 'emitido' as ChequeDirection,
        destinatario: '',
        proveedor_id: '',
        client_id: '',
        estado: 'pendiente' as ChequeStatus,
        descripcion: '',
    });

    useEffect(() => {
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
            // Default dates
            const today = new Date().toISOString().split('T')[0];
            setFormData({
                tipo: 'fisico',
                numero_cheque: '',
                banco: '',
                fecha_emision: today,
                fecha_pago: today,
                monto: '',
                direction: 'emitido',
                destinatario: '',
                proveedor_id: '',
                client_id: '',
                estado: 'pendiente',
                descripcion: '',
            });
        }
    }, [chequeToEdit, isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (new Date(formData.fecha_pago) < new Date(formData.fecha_emision)) {
            setError('La fecha de pago no puede ser anterior a la de emisión');
            return;
        }

        setError(null);
        setLoading(true);

        try {
            await onSubmit({
                ...formData,
                monto: parseFloat(formData.monto),
                proveedor_id: formData.direction === 'emitido' ? (formData.proveedor_id || null) : null,
                client_id: formData.direction === 'recibido' ? (formData.client_id || null) : null,
            });
            onSuccess();
            onClose();
        } catch (err: any) {
            setError(err.message || 'Error al guardar');
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
            destinatario: prev.destinatario || 'A la orden de la Empresa'
        }));
    };

    const handleBankCreated = (bankName: string) => {
        setFormData({ ...formData, banco: bankName });
        refetchBanks();
    };

    const isSuperAdmin = profile?.role === 'super_admin';

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={chequeToEdit ? 'Editar Cheque' : (formData.direction === 'emitido' ? 'Nuevo Cheque a Emitir' : 'Registrar Cheque Recibido')}
        >
            <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                    <div className="p-3 text-sm text-red-600 bg-red-50 rounded-lg">
                        {error}
                    </div>
                )}

                {/* Direction Toggle */}
                <div className="flex bg-gray-100 p-1 rounded-lg mb-4">
                    <button
                        type="button"
                        className={`flex-1 py-1 px-3 text-sm font-medium rounded-md transition-colors ${formData.direction === 'emitido'
                                ? 'bg-white text-gray-900 shadow-sm'
                                : 'text-gray-500 hover:text-gray-900'
                            }`}
                        onClick={() => setFormData({ ...formData, direction: 'emitido', destinatario: '', proveedor_id: '', client_id: '' })}
                    >
                        Cheque Emitido (Pago)
                    </button>
                    <button
                        type="button"
                        className={`flex-1 py-1 px-3 text-sm font-medium rounded-md transition-colors ${formData.direction === 'recibido'
                                ? 'bg-white text-green-700 shadow-sm'
                                : 'text-gray-500 hover:text-gray-900'
                            }`}
                        onClick={() => setFormData({ ...formData, direction: 'recibido', destinatario: 'A la orden de la Empresa', proveedor_id: '', client_id: '' })}
                    >
                        Cheque Recibido (Cobro)
                    </button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Tipo de Instrumento
                        </label>
                        <Select
                            value={formData.tipo}
                            onChange={(val) => setFormData({ ...formData, tipo: val as ChequeType })}
                            options={CHEQUE_TYPES}
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Estado
                        </label>
                        <Select
                            value={formData.estado}
                            onChange={(val) => setFormData({ ...formData, estado: val as ChequeStatus })}
                            options={CHEQUE_STATUSES}
                            required
                        />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Banco
                        </label>
                        <SearchableSelect
                            value={formData.banco}
                            onChange={(value) => setFormData({ ...formData, banco: value })}
                            options={banks.map((bank) => ({ value: bank.name, label: bank.name }))}
                            placeholder="Seleccionar banco"
                            onSearch={setBankSearch}
                            allowCreate={isSuperAdmin}
                            onCreateNew={() => setShowCreateBankModal(true)}
                            createLabel="Crear nuevo banco"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            N° Cheque
                        </label>
                        <Input
                            value={formData.numero_cheque}
                            onChange={(e) => setFormData({ ...formData, numero_cheque: e.target.value })}
                            placeholder="Ej: 12345678"
                            required
                        />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Fecha Emisión *
                        </label>
                        <Input
                            type="date"
                            value={formData.fecha_emision}
                            onChange={(e) => setFormData({ ...formData, fecha_emision: e.target.value })}
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Fecha Pago (Cashflow) *
                        </label>
                        <Input
                            type="date"
                            value={formData.fecha_pago}
                            onChange={(e) => setFormData({ ...formData, fecha_pago: e.target.value })}
                            required
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Monto *
                        </label>
                        <Input
                            type="number"
                            value={formData.monto}
                            onChange={(e) => setFormData({ ...formData, monto: e.target.value })}
                            placeholder="0.00"
                            min="0"
                            step="0.01"
                            required
                            className="text-lg font-bold"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    {formData.direction === 'emitido' ? (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Proveedor (Opcional)
                            </label>
                            <Select
                                value={formData.proveedor_id}
                                onChange={handleProviderChange}
                                options={providers.map((p) => ({ value: p.id, label: p.nombre_fantasia }))}
                                placeholder="Seleccionar..."
                            />
                        </div>
                    ) : (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Cliente (De quién se recibe)
                            </label>
                            <Select
                                value={formData.client_id}
                                onChange={handleClientChange}
                                options={clients.map((c) => ({ value: c.id, label: c.nombre_fantasia || c.razon_social }))}
                                placeholder="Seleccionar..."
                            />
                        </div>
                    )}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Destinatario / A la orden de
                        </label>
                        <Input
                            value={formData.destinatario}
                            onChange={(e) => setFormData({ ...formData, destinatario: e.target.value })}
                            placeholder={formData.direction === 'emitido' ? "Nombre del beneficiario" : "Ej: Nosotros / Endosado"}
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Descripción / Referencia
                    </label>
                    <Input
                        value={formData.descripcion}
                        onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                        placeholder="Ej: Pago Factura A-0001"
                    />
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t">
                    <Button type="button" variant="secondary" onClick={onClose}>
                        Cancelar
                    </Button>
                    <Button type="submit" disabled={loading}>
                        {loading ? 'Guardando...' : chequeToEdit ? 'Actualizar' : 'Crear'}
                    </Button>
                </div>
            </form>

            {showCreateBankModal && (
                <CreateBankModal
                    onClose={() => setShowCreateBankModal(false)}
                    onSuccess={handleBankCreated}
                />
            )}
        </Modal>
    );
}
