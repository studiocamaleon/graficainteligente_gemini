import { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { SearchableSelect } from '../ui/SearchableSelect';
import { useProviders } from '../../hooks/useProviders';
import { useCompras, CreateCompraData } from '../../hooks/useCompras';
import { getArgentinaDateString } from '../../utils/dates';

interface NuevaCompraModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export function NuevaCompraModal({ isOpen, onClose, onSuccess }: NuevaCompraModalProps) {
    const { providers } = useProviders({ isActive: true });
    const { crearCompra, loading } = useCompras();

    const [formData, setFormData] = useState<CreateCompraData>({
        descripcion: '',
        monto_total: 0,
        fecha_emision: getArgentinaDateString(),
        fecha_vencimiento: getArgentinaDateString(),
        notas: ''
    });

    const [errors, setErrors] = useState<Record<string, string>>({});

    const validate = () => {
        const newErrors: Record<string, string> = {};
        if (!formData.descripcion.trim()) newErrors.descripcion = 'Requerido';
        if (!formData.monto_total || formData.monto_total <= 0) newErrors.monto_total = 'Requerido > 0';
        if (!formData.fecha_emision) newErrors.fecha_emision = 'Requerido';
        if (!formData.fecha_vencimiento) newErrors.fecha_vencimiento = 'Requerido';

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validate()) return;
        try {
            await crearCompra(formData);
            onSuccess();
            onClose();
        } catch (error) {
            // Handled in hook
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Registrar Factura Pendiente">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Proveedor</label>
                    <SearchableSelect
                        value={formData.provider_id || ''}
                        onChange={(val) => setFormData({ ...formData, provider_id: val })}
                        options={providers.map(p => ({ value: p.id, label: p.nombre_fantasia }))}
                        placeholder="Seleccionar proveedor..."
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Concepto / Descripción *</label>
                    <Input
                        value={formData.descripcion}
                        onChange={e => setFormData({ ...formData, descripcion: e.target.value })}
                        placeholder="Ej: Materiales para Obra X, Flete, etc."
                        error={errors.descripcion}
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Monto Total *</label>
                        <Input
                            type="number"
                            step="0.01"
                            value={formData.monto_total || ''}
                            onChange={e => setFormData({ ...formData, monto_total: parseFloat(e.target.value) })}
                            placeholder="0.00"
                            error={errors.monto_total}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">N° Factura (Opcional)</label>
                        <Input
                            value={formData.numero_factura || ''}
                            onChange={e => setFormData({ ...formData, numero_factura: e.target.value })}
                            placeholder="A-0001-XXXX"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Emisión *</label>
                        <Input
                            type="date"
                            value={formData.fecha_emision}
                            onChange={e => setFormData({ ...formData, fecha_emision: e.target.value })}
                            error={errors.fecha_emision}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Vencimiento *</label>
                        <Input
                            type="date"
                            value={formData.fecha_vencimiento}
                            onChange={e => setFormData({ ...formData, fecha_vencimiento: e.target.value })}
                            error={errors.fecha_vencimiento}
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
                    <textarea
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        rows={3}
                        value={formData.notas || ''}
                        onChange={e => setFormData({ ...formData, notas: e.target.value })}
                    />
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t">
                    <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
                    <Button type="submit" disabled={loading}>{loading ? 'Guardando...' : 'Guardar'}</Button>
                </div>
            </form>
        </Modal>
    );
}
