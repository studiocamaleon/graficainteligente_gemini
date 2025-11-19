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
    unidades_desde: 1,
    unidades_hasta: null,
    precio: 0,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [esInfinito, setEsInfinito] = useState(false);

  useEffect(() => {
    if (plastificado) {
      setFormData({
        tipo: plastificado.tipo,
        unidades_desde: plastificado.unidades_desde,
        unidades_hasta: plastificado.unidades_hasta,
        precio: plastificado.precio,
      });
      setEsInfinito(plastificado.unidades_hasta === null);
    }
  }, [plastificado]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.tipo) {
      newErrors.tipo = 'Debes seleccionar un tipo de plastificado';
    }

    if (formData.unidades_desde <= 0) {
      newErrors.unidades_desde = 'Debe ser mayor a 0';
    }

    if (!esInfinito && formData.unidades_hasta !== null && formData.unidades_hasta < formData.unidades_desde) {
      newErrors.unidades_hasta = 'Debe ser mayor o igual al límite inferior';
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

    const dataToSubmit = {
      ...formData,
      unidades_hasta: esInfinito ? null : formData.unidades_hasta,
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
      <Select
        label="Tipo de Plastificado"
        value={formData.tipo}
        onChange={(e) => setFormData({ ...formData, tipo: e.target.value as 'A4' | 'SRA3' | 'Carnet' })}
        options={TIPOS_PLASTIFICADO}
        error={errors.tipo}
        required
      />

      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Unidades Desde"
          type="number"
          value={formData.unidades_desde}
          onChange={(e) => setFormData({ ...formData, unidades_desde: parseInt(e.target.value) || 0 })}
          error={errors.unidades_desde}
          required
        />

        <div>
          <Input
            label="Unidades Hasta"
            type="number"
            value={esInfinito ? '' : (formData.unidades_hasta || '')}
            onChange={(e) => setFormData({ ...formData, unidades_hasta: parseInt(e.target.value) || null })}
            error={errors.unidades_hasta}
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
