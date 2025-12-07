import { useState, useEffect } from 'react';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Link } from 'react-router-dom';
import { useProviders } from '../../hooks/useProviders';
import { useTiposEgreso } from '../../hooks/useTiposEgreso';
import type { RecurringExpense, RecurringFrequency } from '../../types/database';

interface CreateRecurringExpenseModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    onSubmit: (data: any) => Promise<void>;
    expenseToEdit?: RecurringExpense | null;
}

const FREQUENCIES: { value: RecurringFrequency; label: string }[] = [
    { value: 'weekly', label: 'Semanal' },
    { value: 'biweekly', label: 'Quincenal' },
    { value: 'monthly', label: 'Mensual' },
    { value: 'quarterly', label: 'Trimestral' },
    { value: 'yearly', label: 'Anual' },
];

export function CreateRecurringExpenseModal({
    isOpen,
    onClose,
    onSuccess,
    onSubmit,
    expenseToEdit,
}: CreateRecurringExpenseModalProps) {
    const { providers } = useProviders({ isActive: true });
    const { tipos } = useTiposEgreso();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [formData, setFormData] = useState({
        description: '',
        amount: '',
        provider_id: '',
        tipo_egreso_id: '',
        frequency: 'monthly' as RecurringFrequency,
        day_of_month: '',
        start_date: new Date().toISOString().split('T')[0],
        end_date: '',
    });

    useEffect(() => {
        if (expenseToEdit) {
            setFormData({
                description: expenseToEdit.description,
                amount: expenseToEdit.amount.toString(),
                provider_id: expenseToEdit.provider_id || '',
                tipo_egreso_id: expenseToEdit.tipo_egreso_id,
                frequency: expenseToEdit.frequency,
                day_of_month: expenseToEdit.day_of_month?.toString() || '',
                start_date: expenseToEdit.start_date,
                end_date: expenseToEdit.end_date || '',
            });
        } else {
            setFormData({
                description: '',
                amount: '',
                provider_id: '',
                tipo_egreso_id: '',
                frequency: 'monthly',
                day_of_month: '1',
                start_date: new Date().toISOString().split('T')[0],
                end_date: '',
            });
        }
    }, [expenseToEdit, isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            await onSubmit({
                ...formData,
                amount: parseFloat(formData.amount),
                day_of_month: formData.day_of_month ? parseInt(formData.day_of_month) : null,
                provider_id: formData.provider_id || null,
                end_date: formData.end_date || null,
            });
            onSuccess();
            onClose();
        } catch (err: any) {
            setError(err.message || 'Error al guardar');
        } finally {
            setLoading(false);
        }
    };

    // Auto-fill expense type when provider is selected
    const handleProviderChange = (providerId: string) => {
        const provider = providers.find((p) => p.id === providerId);
        setFormData((prev) => ({
            ...prev,
            provider_id: providerId,
            tipo_egreso_id: provider?.tipo_egreso_id || prev.tipo_egreso_id,
        }));
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={expenseToEdit ? 'Editar Gasto Recurrente' : 'Nuevo Gasto Recurrente'}
        >
            <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                    <div className="p-3 text-sm text-red-600 bg-red-50 rounded-lg">
                        {error}
                    </div>
                )}

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Descripción *
                    </label>
                    <Input
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        placeholder="Ej: Alquiler Oficina, Sueldo Juan"
                        required
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Monto *
                        </label>
                        <Input
                            type="number"
                            value={formData.amount}
                            onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                            placeholder="0.00"
                            min="0"
                            step="0.01"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Frecuencia *
                        </label>
                        <Select
                            value={formData.frequency}
                            onChange={(val) => setFormData({ ...formData, frequency: val as RecurringFrequency })}
                            options={FREQUENCIES}
                            required
                        />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Proveedor
                        </label>
                        <Select
                            value={formData.provider_id}
                            onChange={handleProviderChange}
                            options={providers.map((p) => ({ value: p.id, label: p.nombre_fantasia }))}
                            placeholder="Seleccionar..."
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Categoría *
                        </label>
                        <div className="space-y-1">
                            <Select
                                value={formData.tipo_egreso_id}
                                onChange={(val) => setFormData({ ...formData, tipo_egreso_id: val })}
                                options={tipos.map((t) => ({ value: t.id, label: t.nombre }))}
                                placeholder="Seleccionar..."
                                required
                            />
                            <div className="text-right">
                                <Link
                                    to="/app/settings/tipos-egreso"
                                    className="text-xs text-blue-600 hover:text-blue-800 hover:underline"
                                    onClick={onClose}
                                >
                                    Gestionar Categorías
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Fecha Inicio *
                        </label>
                        <Input
                            type="date"
                            value={formData.start_date}
                            onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                            required
                        />
                    </div>
                    {formData.frequency === 'monthly' && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Día de pago (1-31)
                            </label>
                            <Input
                                type="number"
                                value={formData.day_of_month}
                                onChange={(e) => setFormData({ ...formData, day_of_month: e.target.value })}
                                min="1"
                                max="31"
                            />
                        </div>
                    )}
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Fecha Fin (Opcional)
                    </label>
                    <div className="flex gap-2 items-center">
                        <Input
                            type="date"
                            value={formData.end_date}
                            onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                            placeholder="Indefinido"
                            className="flex-1"
                        />
                        {formData.end_date && (
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => setFormData({ ...formData, end_date: '' })}
                                title="Limpiar fecha para hacerla indefinida"
                            >
                                X
                            </Button>
                        )}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                        Dejar vacío si es un gasto indefinido (ej: Alquiler). Completar si es un préstamo o cuotas.
                    </p>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t">
                    <Button type="button" variant="secondary" onClick={onClose}>
                        Cancelar
                    </Button>
                    <Button type="submit" disabled={loading}>
                        {loading ? 'Guardando...' : expenseToEdit ? 'Actualizar' : 'Crear'}
                    </Button>
                </div>
            </form>
        </Modal>
    );
}
