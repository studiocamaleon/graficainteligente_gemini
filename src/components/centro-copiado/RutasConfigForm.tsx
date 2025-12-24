import { useState, useMemo } from 'react';
import { usePasos } from '../../hooks/usePasos';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import type { CentroCopiadoRutaConfig } from '../../types/centro_copiado_config';

interface RutasConfigFormProps {
    onSubmit: (data: Omit<CentroCopiadoRutaConfig, 'id' | 'created_at' | 'updated_at' | 'paso' | 'company_id'>) => Promise<void>;
    onCancel: () => void;
}

const CONFIG_KEYS = [
    { value: 'tipo_tinta', label: 'Tipo de Tinta' },
    { value: 'anillado', label: 'Anillado' },
    { value: 'plastificado', label: 'Plastificado' },
    { value: 'guillotinado', label: 'Guillotinado' },
] as const;

// Define known values for each configuration key
const CONFIG_VALUES: Record<string, { value: string; label: string }[]> = {
    tipo_tinta: [
        { value: 'CMYK', label: 'Color (CMYK)' },
        { value: 'K', label: 'Blanco y Negro (K)' },
    ],
    anillado: [
        { value: 'ring_wire', label: 'Ring Wire' },
        { value: 'plastico', label: 'Espiral Plástico' },
    ],
    plastificado: [
        { value: 'A4', label: 'A4' },
        { value: 'SRA3', label: 'SRA3' },
        { value: 'Carnet', label: 'Carnet' },
    ],
    guillotinado: [
        // Guillotinado is usually just "present" or not, but allow distinct values if needed in future
    ]
};

export function RutasConfigForm({ onSubmit, onCancel }: RutasConfigFormProps) {
    const { pasos, loading: loadingPasos } = usePasos({ orderBy: 'nombre', itemsPerPage: 1000 });

    const [formData, setFormData] = useState({
        clave: 'tipo_tinta',
        valor: '',
        paso_id: '',
        useCustomValue: false,
    });

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});

    const availableValues = useMemo(() => {
        return CONFIG_VALUES[formData.clave] || [];
    }, [formData.clave]);

    const validate = (): boolean => {
        const newErrors: Record<string, string> = {};

        if (!formData.clave) {
            newErrors.clave = 'La configuración es requerida';
        }

        if (!formData.paso_id) {
            newErrors.paso_id = 'El paso de producción es requerido';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validate()) return;

        setIsSubmitting(true);
        try {
            await onSubmit({
                clave: formData.clave,
                valor: formData.valor.trim() || null, // Convert empty string to null
                paso_id: formData.paso_id,
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleClaveChange = (newClave: string) => {
        setFormData({
            ...formData,
            clave: newClave,
            valor: '', // Reset value on key change
            useCustomValue: false
        });
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
                <label htmlFor="clave" className="block text-sm font-medium text-gray-700">
                    Tipo de Configuración
                </label>
                <select
                    id="clave"
                    value={formData.clave}
                    onChange={(e) => handleClaveChange(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white h-10"
                >
                    {CONFIG_KEYS.map((key) => (
                        <option key={key.value} value={key.value}>
                            {key.label}
                        </option>
                    ))}
                </select>
                {errors.clave && <p className="text-sm text-red-500">{errors.clave}</p>}
            </div>

            <div className="space-y-2">
                <div className="flex justify-between items-center">
                    <label htmlFor="valor" className="block text-sm font-medium text-gray-700">
                        Valor (Opcional)
                    </label>
                    {availableValues.length > 0 && (
                        <button
                            type="button"
                            onClick={() => setFormData(prev => ({ ...prev, useCustomValue: !prev.useCustomValue, valor: '' }))}
                            className="text-xs text-blue-600 hover:text-blue-800 underline"
                        >
                            {formData.useCustomValue ? 'Seleccionar de lista' : 'Ingresar valor manual'}
                        </button>
                    )}
                </div>

                {!formData.useCustomValue && availableValues.length > 0 ? (
                    <select
                        id="valor"
                        value={formData.valor}
                        onChange={(e) => setFormData({ ...formData, valor: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white h-10"
                    >
                        <option value="">Cualquiera (Aplica a todos)</option>
                        {availableValues.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                                {opt.label}
                            </option>
                        ))}
                    </select>
                ) : (
                    <Input
                        value={formData.valor}
                        onChange={(e) => setFormData({ ...formData, valor: e.target.value })}
                        placeholder={
                            formData.clave === 'guillotinado'
                                ? "Ej: Dejar vacío para 'Cualquiera' o ingresar valor específico"
                                : "Valor manual (Ej: color_especial)"
                        }
                    />
                )}

                <p className="text-xs text-gray-500">
                    Si se deja vacío/cualquiera, esta regla aplicará para cualquier valor de {CONFIG_KEYS.find(k => k.value === formData.clave)?.label}.
                </p>
            </div>

            <div className="space-y-2">
                <label htmlFor="paso_id" className="block text-sm font-medium text-gray-700">
                    Paso de Producción
                </label>
                <select
                    id="paso_id"
                    value={formData.paso_id}
                    onChange={(e) => setFormData({ ...formData, paso_id: e.target.value })}
                    disabled={loadingPasos}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white h-10 disabled:bg-gray-100 disabled:text-gray-400"
                >
                    <option value="">Seleccionar paso...</option>
                    {pasos.map((paso) => (
                        <option key={paso.id} value={paso.id}>
                            {paso.nombre}
                        </option>
                    ))}
                </select>
                {errors.paso_id && <p className="text-sm text-red-500">{errors.paso_id}</p>}
            </div>

            <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="secondary" onClick={onCancel}>
                    Cancelar
                </Button>
                <Button type="submit" variant="primary" disabled={isSubmitting}>
                    {isSubmitting ? 'Guardando...' : 'Crear Regla'}
                </Button>
            </div>
        </form>
    );
}
