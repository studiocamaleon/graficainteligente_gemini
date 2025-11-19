import { useState, useEffect } from 'react';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import type { CentroCopiadoTamanioPapel, CentroCopiadoTamanioPapelFormData } from '../../types/database';

interface TamanioPapelFormProps {
  tamanio?: CentroCopiadoTamanioPapel;
  onSubmit: (data: CentroCopiadoTamanioPapelFormData) => Promise<void>;
  onCancel: () => void;
}

export function TamanioPapelForm({ tamanio, onSubmit, onCancel }: TamanioPapelFormProps) {
  const [formData, setFormData] = useState<CentroCopiadoTamanioPapelFormData>({
    nombre: '',
    ancho_mm: 0,
    alto_mm: 0,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (tamanio) {
      setFormData({
        nombre: tamanio.nombre,
        ancho_mm: tamanio.ancho_mm,
        alto_mm: tamanio.alto_mm,
      });
    }
  }, [tamanio]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.nombre.trim()) {
      newErrors.nombre = 'El nombre es requerido';
    }

    if (formData.ancho_mm <= 0) {
      newErrors.ancho_mm = 'El ancho debe ser mayor a 0';
    }

    if (formData.alto_mm <= 0) {
      newErrors.alto_mm = 'El alto debe ser mayor a 0';
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
        label="Nombre del Tamaño"
        value={formData.nombre}
        onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
        placeholder="Ej: A4, SRA3, Carta, Oficio"
        error={errors.nombre}
        required
      />

      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Ancho (mm)"
          type="number"
          step="0.01"
          value={formData.ancho_mm}
          onChange={(e) => setFormData({ ...formData, ancho_mm: parseFloat(e.target.value) || 0 })}
          error={errors.ancho_mm}
          required
        />

        <Input
          label="Alto (mm)"
          type="number"
          step="0.01"
          value={formData.alto_mm}
          onChange={(e) => setFormData({ ...formData, alto_mm: parseFloat(e.target.value) || 0 })}
          error={errors.alto_mm}
          required
        />
      </div>

      <div className="flex justify-end gap-3 pt-4">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" disabled={isSubmitting}>
          {isSubmitting ? 'Guardando...' : tamanio ? 'Actualizar' : 'Crear'}
        </Button>
      </div>
    </form>
  );
}
