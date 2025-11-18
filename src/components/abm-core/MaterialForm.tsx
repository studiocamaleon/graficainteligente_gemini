import { useState, FormEvent } from 'react';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Select } from '../ui/Select';
import { VariantesEditor } from './VariantesEditor';
import type { Material, MaterialVariante, UnidadEspesor } from '../../types/database';

interface MaterialFormProps {
  material?: Material;
  onSubmit: (data: MaterialFormData) => Promise<void>;
  onCancel: () => void;
}

export interface MaterialFormData {
  nombre: string;
  aplica_espesor: boolean;
  unidad_espesor: UnidadEspesor | null;
  variantes: MaterialVariante[];
}

export function MaterialForm({ material, onSubmit, onCancel }: MaterialFormProps) {
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [formData, setFormData] = useState<MaterialFormData>({
    nombre: material?.nombre || '',
    aplica_espesor: material?.aplica_espesor || false,
    unidad_espesor: material?.unidad_espesor || null,
    variantes: material?.variantes || [],
  });

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.nombre.trim()) {
      newErrors.nombre = 'El nombre es requerido';
    }

    const nombresVariantes = new Set<string>();
    formData.variantes.forEach((variante, index) => {
      if (!variante.nombre.trim()) {
        newErrors[`variante_${index}`] = 'El nombre de la variante es requerido';
      } else if (nombresVariantes.has(variante.nombre.trim().toLowerCase())) {
        newErrors[`variante_${index}`] = 'Ya existe una variante con este nombre';
      } else {
        nombresVariantes.add(variante.nombre.trim().toLowerCase());
      }

      variante.espesores.forEach((espesor, espesorIndex) => {
        if (isNaN(espesor) || espesor <= 0) {
          newErrors[`variante_${index}_espesor_${espesorIndex}`] = 'Valor inválido';
        }
      });
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setLoading(true);
    try {
      await onSubmit(formData);
    } finally {
      setLoading(false);
    }
  };


  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <Input
          label="Nombre del Material"
          value={formData.nombre}
          onChange={(e) => {
            setFormData(prev => ({ ...prev, nombre: e.target.value }));
            if (errors.nombre) {
              setErrors(prev => ({ ...prev, nombre: '' }));
            }
          }}
          error={errors.nombre}
          required
          placeholder="Ej: Vinilo, PVC, Lona, etc."
        />

        <div>
          <VariantesEditor
            variantes={formData.variantes}
            unidadEspesor={formData.unidad_espesor}
            onChange={(variantes) => {
              setFormData(prev => ({
                ...prev,
                variantes,
                aplica_espesor: variantes.length > 0 && !!prev.unidad_espesor
              }));
              if (errors.variantes) {
                setErrors(prev => ({ ...prev, variantes: '' }));
              }
            }}
            onUnidadEspesorChange={(unidad) => {
              setFormData(prev => ({
                ...prev,
                unidad_espesor: unidad,
                aplica_espesor: prev.variantes.length > 0 && !!unidad
              }));
              if (errors.unidad_espesor) {
                setErrors(prev => ({ ...prev, unidad_espesor: '' }));
              }
            }}
          />
          {errors.unidad_espesor && (
            <p className="mt-2 text-sm text-red-600">{errors.unidad_espesor}</p>
          )}
          {errors.variantes && (
            <p className="mt-2 text-sm text-red-600">{errors.variantes}</p>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" isLoading={loading}>
          {material ? 'Actualizar Material' : 'Crear Material'}
        </Button>
      </div>
    </form>
  );
}
