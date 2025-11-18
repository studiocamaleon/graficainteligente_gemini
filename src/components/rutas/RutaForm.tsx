import { useState, useEffect } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import type { RutaProduccion, RutaProduccionFormData } from '../../types/database';

interface RutaFormProps {
  ruta?: RutaProduccion | null;
  onSubmit: (data: RutaProduccionFormData) => Promise<void>;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export function RutaForm({ ruta, onSubmit, onCancel, isSubmitting = false }: RutaFormProps) {
  const [formData, setFormData] = useState<RutaProduccionFormData>({
    nombre: '',
    descripcion: '',
  });

  const [errors, setErrors] = useState<Partial<Record<keyof RutaProduccionFormData, string>>>({});

  useEffect(() => {
    if (ruta) {
      setFormData({
        nombre: ruta.nombre,
        descripcion: ruta.descripcion || '',
      });
    }
  }, [ruta]);

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof RutaProduccionFormData, string>> = {};

    if (!formData.nombre.trim()) {
      newErrors.nombre = 'El nombre es obligatorio';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    await onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label htmlFor="nombre" className="block text-sm font-medium text-gray-700 mb-1">
          Nombre de la Ruta *
        </label>
        <Input
          id="nombre"
          value={formData.nombre}
          onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
          placeholder="Ej: Ruta Gran Formato Estándar"
          error={errors.nombre}
          disabled={isSubmitting}
        />
      </div>

      <div>
        <label htmlFor="descripcion" className="block text-sm font-medium text-gray-700 mb-1">
          Descripción
        </label>
        <textarea
          id="descripcion"
          value={formData.descripcion}
          onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
          placeholder="Descripción detallada de la ruta de producción..."
          rows={4}
          disabled={isSubmitting}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none disabled:bg-gray-100 disabled:cursor-not-allowed"
        />
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={isSubmitting}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" disabled={isSubmitting}>
          {isSubmitting ? 'Guardando...' : ruta ? 'Actualizar Ruta' : 'Crear Ruta'}
        </Button>
      </div>
    </form>
  );
}
