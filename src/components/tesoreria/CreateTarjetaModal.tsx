import { useState, useEffect } from 'react';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { useBanks } from '../../hooks/useBanks';
import type { TarjetaCredito } from '../../types/database';

interface CreateTarjetaModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    onSubmit: (data: any) => Promise<void>;
    tarjetaToEdit?: TarjetaCredito | null;
}

const COLORS = [
    { value: 'blue', label: 'Azul' },
    { value: 'green', label: 'Verde' },
    { value: 'red', label: 'Rojo' },
    { value: 'black', label: 'Negro' },
    { value: 'purple', label: 'Violeta' },
    { value: 'gold', label: 'Dorado' },
];

export function CreateTarjetaModal({
    isOpen,
    onClose,
    onSuccess,
    onSubmit,
    tarjetaToEdit,
}: CreateTarjetaModalProps) {
    const { banks } = useBanks('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [formData, setFormData] = useState({
        nombre: '',
        banco: '',
        ultimos_4_digitos: '',
        dia_cierre: '',
        dia_vencimiento: '',
        color: 'blue'
    });

    useEffect(() => {
        if (tarjetaToEdit) {
            setFormData({
                nombre: tarjetaToEdit.nombre,
                banco: tarjetaToEdit.banco,
                ultimos_4_digitos: tarjetaToEdit.ultimos_4_digitos || '',
                dia_cierre: tarjetaToEdit.dia_cierre.toString(),
                dia_vencimiento: tarjetaToEdit.dia_vencimiento.toString(),
                color: tarjetaToEdit.color
            });
        } else {
            setFormData({
                nombre: '',
                banco: '',
                ultimos_4_digitos: '',
                dia_cierre: '',
                dia_vencimiento: '',
                color: 'blue'
            });
        }
    }, [tarjetaToEdit, isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        const cierre = parseInt(formData.dia_cierre);
        const vencimiento = parseInt(formData.dia_vencimiento);

        if (cierre < 1 || cierre > 31 || vencimiento < 1 || vencimiento > 31) {
            setError('Los días deben estar entre 1 y 31');
            setLoading(false);
            return;
        }

        try {
            await onSubmit({
                ...formData,
                dia_cierre: cierre,
                dia_vencimiento: vencimiento,
            });
            onSuccess();
            onClose();
        } catch (err: any) {
            setError(err.message || 'Error al guardar');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={tarjetaToEdit ? 'Editar Tarjeta' : 'Nueva Tarjeta Corporativa'}
        >
            <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                    <div className="p-3 text-sm text-red-600 bg-red-50 rounded-lg">
                        {error}
                    </div>
                )}

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Nombre / Alias *
                    </label>
                    <Input
                        value={formData.nombre}
                        onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                        placeholder="Ej: Visa Corporate, Master Compras"
                        required
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Banco *
                        </label>
                        <Select
                            value={formData.banco}
                            onChange={(val) => setFormData({ ...formData, banco: val })}
                            options={banks.map(b => ({ value: b.name, label: b.name }))}
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Últimos 4 (Opcional)
                        </label>
                        <Input
                            value={formData.ultimos_4_digitos}
                            onChange={(e) => setFormData({ ...formData, ultimos_4_digitos: e.target.value })}
                            placeholder="Ej: 1234"
                            maxLength={4}
                        />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Día de Cierre (Mes) *
                        </label>
                        <Input
                            type="number"
                            min="1"
                            max="31"
                            value={formData.dia_cierre}
                            onChange={(e) => setFormData({ ...formData, dia_cierre: e.target.value })}
                            placeholder="Ej: 25"
                            required
                        />
                        <p className="text-xs text-gray-500 mt-1">Día que cierra el resumen</p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Día Vencimiento *
                        </label>
                        <Input
                            type="number"
                            min="1"
                            max="31"
                            value={formData.dia_vencimiento}
                            onChange={(e) => setFormData({ ...formData, dia_vencimiento: e.target.value })}
                            placeholder="Ej: 5"
                            required
                        />
                        <p className="text-xs text-gray-500 mt-1">Día que se paga la tarjeta</p>
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Color Identificatorio
                    </label>
                    <div className="flex gap-2 flex-wrap">
                        {COLORS.map((c) => (
                            <button
                                key={c.value}
                                type="button"
                                onClick={() => setFormData({ ...formData, color: c.value })}
                                className={`w-8 h-8 rounded-full border-2 ${formData.color === c.value ? 'border-gray-900 scale-110' : 'border-transparent'
                                    }`}
                                style={{ backgroundColor: c.value === 'black' ? '#000' : c.value }}
                                title={c.label}
                            />
                        ))}
                    </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t">
                    <Button type="button" variant="secondary" onClick={onClose}>
                        Cancelar
                    </Button>
                    <Button type="submit" disabled={loading}>
                        {loading ? 'Guardando...' : tarjetaToEdit ? 'Actualizar' : 'Crear'}
                    </Button>
                </div>
            </form>
        </Modal>
    );
}
