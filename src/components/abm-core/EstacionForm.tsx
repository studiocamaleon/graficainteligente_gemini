import { useState, FormEvent } from 'react';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import type { EstacionTrabajo } from '../../types/database';

interface EstacionFormProps {
  estacion?: EstacionTrabajo;
  onSubmit: (data: EstacionFormData) => Promise<void>;
  onCancel: () => void;
}

export interface EstacionFormData {
  nombre: string;
  descripcion: string;
}

export function EstacionForm({ estacion, onSubmit, onCancel }: EstacionFormProps) {
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [formData, setFormData] = useState<EstacionFormData>({
    nombre: estacion?.nombre || '',
    descripcion: estacion?.descripcion || '',
  });

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.nombre.trim()) {
      newErrors.nombre = 'El nombre es requerido';
    }

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

  const handleChange = (field: keyof EstacionFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <Input
          label="Nombre de la Estación"
          value={formData.nombre}
          onChange={(e) => handleChange('nombre', e.target.value)}
          error={errors.nombre}
          required
          placeholder="Ej: Impresión Digital, Corte Láser, etc."
        />

        <Input
          label="Descripción"
          value={formData.descripcion}
          onChange={(e) => handleChange('descripcion', e.target.value)}
          placeholder="Descripción opcional de la estación de trabajo"
        />
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" isLoading={loading}>
          {estacion ? 'Actualizar Estación' : 'Crear Estación'}
        </Button>
      </div>
    </form>
  );
}
