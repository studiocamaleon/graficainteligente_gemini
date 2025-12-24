import { useState, useEffect } from 'react';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import type { CentroCopiadoPloteoCADPrecio } from '../../types/database';

export interface CentroCopiadoPloteoCADPrecioFormData {
    tipo_papel: string;
    ancho_cm: 60 | 90;
    precio_metro_lineal: number;
}

interface PloteoCADPrecioFormProps {
    precio?: CentroCopiadoPloteoCADPrecio;
    onSubmit: (data: CentroCopiadoPloteoCADPrecioFormData) => Promise<void>;
    onCancel: () => void;
}

export function PloteoCADPrecioForm({ precio, onSubmit, onCancel }: PloteoCADPrecioFormProps) {
    const [formData, setFormData] = useState<CentroCopiadoPloteoCADPrecioFormData>({
        tipo_papel: '',
        ancho_cm: 90,
        precio_metro_lineal: 0,
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});

    useEffect(() => {
        if (precio) {
            setFormData({
                tipo_papel: precio.tipo_papel,
                ancho_cm: precio.ancho_cm,
                precio_metro_lineal: precio.precio_metro_lineal,
            });
        }
    }, [precio]);

    const validate = (): boolean => {
        const newErrors: Record<string, string> = {};

        if (!formData.tipo_papel.trim()) {
            newErrors.tipo_papel = 'El tipo de papel es requerido';
        }

        if (formData.precio_metro_lineal <= 0) {
            newErrors.precio_metro_lineal = 'El precio debe ser mayor a 0';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validate()) return;

        setIsSubmitting(true);
        try {
            await onSubmit(formData);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <Input
                label="Tipo de Papel"
                value={formData.tipo_papel}
                onChange={(e) => setFormData({ ...formData, tipo_papel: e.target.value })}
                placeholder="Ej: Bond 90g, Vegetal 90g, Film"
                error={errors.tipo_papel}
                required
            />

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Ancho de Rollo
                    </label>
                    <select
                        className="w-full h-10 px-3 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        value={formData.ancho_cm}
                        onChange={(e) => setFormData({ ...formData, ancho_cm: Number(e.target.value) as 60 | 90 })}
                    >
                        <option value={90}>90 cm</option>
                        <option value={60}>60 cm</option>
                    </select>
                </div>

                <Input
                    label="Precio por Metro Lineal"
                    type="number"
                    step="0.01"
                    value={formData.precio_metro_lineal}
                    onChange={(e) => setFormData({ ...formData, precio_metro_lineal: parseFloat(e.target.value) || 0 })}
                    error={errors.precio_metro_lineal}
                    required
                />
            </div>

            <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="secondary" onClick={onCancel}>
                    Cancelar
                </Button>
                <Button type="submit" variant="primary" disabled={isSubmitting}>
                    {isSubmitting ? 'Guardando...' : precio ? 'Actualizar' : 'Crear'}
                </Button>
            </div>
        </form>
    );
}
