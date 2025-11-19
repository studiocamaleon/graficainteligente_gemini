import { useState, useEffect } from 'react';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Select } from '../ui/Select';
import type { CentroCopiadoPlastificado, CentroCopiadoPlastificadoFormData } from '../../types/database';

interface PlastificadoFormProps {
  plastificado?: CentroCopiadoPlastificado;
  onSubmit: (data: CentroCopiadoPlastificadoFormData) => Promise<void>;
  onCancel: () => void;
}

const TIPOS_PLASTIFICADO = [
  { value: 'A4', label: 'A4' },
  { value: 'SRA3', label: 'SRA3' },
  { value: 'Carnet', label: 'Carnet' },
];

export function PlastificadoForm({ plastificado, onSubmit, onCancel }: PlastificadoFormProps) {
  const [formData, setFormData] = useState<CentroCopiadoPlastificadoFormData>({
    tipo: 'A4',
    precio: 0,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (plastificado) {
      setFormData({
        tipo: plastificado.tipo,
        precio: plastificado.precio,
      });
    }
  }, [plastificado]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.tipo) {
      newErrors.tipo = 'Debes seleccionar un tipo de plastificado';
    }

    if (formData.precio < 0) {
      newErrors.precio = 'El precio no puede ser negativo';
    }

    if (formData.precio === 0) {
      newErrors.precio = 'El precio debe ser mayor a 0';
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
      <Select
        label="Tipo de Plastificado"
        value={formData.tipo}
        onChange={(e) => setFormData({ ...formData, tipo: e.target.value as 'A4' | 'SRA3' | 'Carnet' })}
        options={TIPOS_PLASTIFICADO}
        error={errors.tipo}
        required
        disabled={!!plastificado}
      />

      <Input
        label="Precio"
        type="number"
        step="0.01"
        value={formData.precio}
        onChange={(e) => setFormData({ ...formData, precio: parseFloat(e.target.value) || 0 })}
        error={errors.precio}
        required
      />

      <div className="flex justify-end gap-3 pt-4">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" disabled={isSubmitting}>
          {isSubmitting ? 'Guardando...' : plastificado ? 'Actualizar' : 'Crear'}
        </Button>
      </div>
    </form>
  );
}
