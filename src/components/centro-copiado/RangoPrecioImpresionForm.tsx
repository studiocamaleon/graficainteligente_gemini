import { useState, useEffect } from 'react';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import type { CentroCopiadoRangoPrecioImpresion, CentroCopiadoRangoPrecioImpresionFormData } from '../../types/database';

interface RangoPrecioImpresionFormProps {
  rango?: CentroCopiadoRangoPrecioImpresion;
  onSubmit: (data: CentroCopiadoRangoPrecioImpresionFormData) => Promise<void>;
  onCancel: () => void;
  maxOrden?: number;
}

export function RangoPrecioImpresionForm({ rango, onSubmit, onCancel, maxOrden = 0 }: RangoPrecioImpresionFormProps) {
  const [formData, setFormData] = useState<CentroCopiadoRangoPrecioImpresionFormData>({
    nombre: '',
    hojas_desde: 1,
    hojas_hasta: null,
    orden: maxOrden + 1,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [esInfinito, setEsInfinito] = useState(false);

  useEffect(() => {
    if (rango) {
      setFormData({
        nombre: rango.nombre,
        hojas_desde: rango.hojas_desde,
        hojas_hasta: rango.hojas_hasta,
        orden: rango.orden,
      });
      setEsInfinito(rango.hojas_hasta === null);
    }
  }, [rango]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.nombre.trim()) {
      newErrors.nombre = 'El nombre es requerido';
    }

    if (formData.hojas_desde <= 0) {
      newErrors.hojas_desde = 'Debe ser mayor a 0';
    }

    if (!esInfinito && formData.hojas_hasta !== null && formData.hojas_hasta < formData.hojas_desde) {
      newErrors.hojas_hasta = 'Debe ser mayor o igual al límite inferior';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    const dataToSubmit = {
      ...formData,
      hojas_hasta: esInfinito ? null : formData.hojas_hasta,
    };

    setIsSubmitting(true);
    try {
      await onSubmit(dataToSubmit);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label="Nombre del Rango"
        value={formData.nombre}
        onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
        placeholder="Ej: 1-50 hojas, 51-100 hojas"
        error={errors.nombre}
        required
      />

      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Hojas Desde"
          type="number"
          value={formData.hojas_desde}
          onChange={(e) => setFormData({ ...formData, hojas_desde: parseInt(e.target.value) || 0 })}
          error={errors.hojas_desde}
          required
        />

        <div>
          <Input
            label="Hojas Hasta"
            type="number"
            value={esInfinito ? '' : (formData.hojas_hasta || '')}
            onChange={(e) => setFormData({ ...formData, hojas_hasta: parseInt(e.target.value) || null })}
            error={errors.hojas_hasta}
            disabled={esInfinito}
            placeholder={esInfinito ? '∞' : ''}
          />
          <label className="flex items-center mt-2 text-sm">
            <input
              type="checkbox"
              checked={esInfinito}
              onChange={(e) => setEsInfinito(e.target.checked)}
              className="mr-2"
            />
            Sin límite superior (infinito)
          </label>
        </div>
      </div>

      <Input
        label="Orden de visualización"
        type="number"
        value={formData.orden}
        onChange={(e) => setFormData({ ...formData, orden: parseInt(e.target.value) || 0 })}
        help="Orden en que se mostrará este rango en la tabla de precios"
      />

      <div className="flex justify-end gap-3 pt-4">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" disabled={isSubmitting}>
          {isSubmitting ? 'Guardando...' : rango ? 'Actualizar' : 'Crear'}
        </Button>
      </div>
    </form>
  );
}
