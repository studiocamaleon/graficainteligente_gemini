import { useState, useEffect } from 'react';
import { Plus, X, Info } from 'lucide-react';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Select } from '../ui/Select';
import { Tooltip } from '../ui/Tooltip';
import type { RangoPrecio, RangoDetalle, UnidadMedida } from '../../hooks/useRangosPrecio';

export interface RangoPrecioFormData {
  nombre: string;
  unidad_medida: UnidadMedida;
  rangos: RangoDetalle[];
}

interface RangoPrecioFormProps {
  initialData?: RangoPrecio | null;
  onSubmit: (data: RangoPrecioFormData) => void;
  onCancel: () => void;
  loading?: boolean;
}

export function RangoPrecioForm({ initialData, onSubmit, onCancel, loading }: RangoPrecioFormProps) {
  const [formData, setFormData] = useState<RangoPrecioFormData>({
    nombre: '',
    unidad_medida: 'unidades',
    rangos: [{ min: 1, max: 10 }],
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (initialData) {
      setFormData({
        nombre: initialData.nombre,
        unidad_medida: initialData.unidad_medida,
        rangos: initialData.rangos.length > 0 ? initialData.rangos : [{ min: 1, max: 10 }],
      });
    }
  }, [initialData]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.nombre.trim()) {
      newErrors.nombre = 'El nombre es requerido';
    }

    if (formData.rangos.length === 0) {
      newErrors.rangos = 'Debe agregar al menos un rango';
    }

    const rangosOrdenados = [...formData.rangos].sort((a, b) => a.min - b.min);

    rangosOrdenados.forEach((rango, index) => {
      if (rango.min < 0) {
        newErrors[`rango_${index}_min`] = 'El mínimo no puede ser negativo';
      }

      if (rango.max !== null && rango.max < 0) {
        newErrors[`rango_${index}_max`] = 'El máximo no puede ser negativo';
      }

      if (rango.max !== null && rango.min >= rango.max) {
        newErrors[`rango_${index}_max`] = 'El máximo debe ser mayor que el mínimo';
      }

      if (rango.max === null && index < rangosOrdenados.length - 1) {
        newErrors[`rango_${index}_max`] = 'Solo el último rango puede ser ilimitado';
      }

      if (index > 0) {
        const rangoAnterior = rangosOrdenados[index - 1];

        if (rangoAnterior.max === null) {
          newErrors[`rango_${index}_continuidad`] = 'No puede haber rangos después de un rango ilimitado';
        } else if (rangoAnterior.max !== rango.min) {
          newErrors[`rango_${index}_continuidad`] = `Debe comenzar en ${rangoAnterior.max} para mantener la continuidad`;
        }
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      const rangosOrdenados = [...formData.rangos].sort((a, b) => a.min - b.min);
      onSubmit({ ...formData, rangos: rangosOrdenados });
    }
  };

  const handleAgregarRango = () => {
    const rangosOrdenados = [...formData.rangos].sort((a, b) => a.min - b.min);
    const ultimoRango = rangosOrdenados[rangosOrdenados.length - 1];

    if (ultimoRango.max === null) {
      alert('No se pueden agregar más rangos después de un rango ilimitado');
      return;
    }

    const nuevoMin = ultimoRango.max;
    const nuevoMax = nuevoMin + 10;

    setFormData({
      ...formData,
      rangos: [...formData.rangos, { min: nuevoMin, max: nuevoMax }],
    });
  };

  const handleEliminarRango = (index: number) => {
    if (formData.rangos.length === 1) {
      alert('Debe tener al menos un rango');
      return;
    }

    setFormData({
      ...formData,
      rangos: formData.rangos.filter((_, i) => i !== index),
    });
  };

  const handleRangoChange = (index: number, field: keyof RangoDetalle, value: number | null) => {
    const newRangos = [...formData.rangos];
    newRangos[index] = { ...newRangos[index], [field]: value };
    setFormData({ ...formData, rangos: newRangos });

    const newErrors = { ...errors };
    delete newErrors[`rango_${index}_${field}`];
    delete newErrors[`rango_${index}_continuidad`];
    setErrors(newErrors);
  };

  const handleToggleIlimitado = (index: number, isIlimitado: boolean) => {
    const newRangos = [...formData.rangos];
    if (isIlimitado) {
      newRangos[index] = { ...newRangos[index], max: null };
    } else {
      const valorSugerido = newRangos[index].min + 10;
      newRangos[index] = { ...newRangos[index], max: valorSugerido };
    }
    setFormData({ ...formData, rangos: newRangos });

    const newErrors = { ...errors };
    delete newErrors[`rango_${index}_max`];
    setErrors(newErrors);
  };

  const rangosOrdenados = [...formData.rangos].sort((a, b) => a.min - b.min);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <Input
          label="Nombre del Rango"
          value={formData.nombre}
          onChange={(e) => {
            setFormData({ ...formData, nombre: e.target.value });
            if (errors.nombre) {
              setErrors({ ...errors, nombre: '' });
            }
          }}
          error={errors.nombre}
          placeholder="Ej: Descuento por Volumen"
          required
        />
      </div>

      <div>
        <Select
          label="Unidad de Medida"
          value={formData.unidad_medida}
          onChange={(value) => {
            setFormData({ ...formData, unidad_medida: value as UnidadMedida });
          }}
          options={[
            { value: 'unidades', label: 'Unidades' },
            { value: 'mt2', label: 'MT² (Metros Cuadrados)' },
            { value: 'mt_lineal', label: 'MT Lineal (Metros Lineales)' },
          ]}
          required
        />
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-gray-900">Rangos de Cantidad</h3>
            <Tooltip content="Los rangos deben ser continuos. El valor máximo de un rango es el valor mínimo del siguiente. Los rangos intermedios incluyen valores desde el mínimo hasta (máximo - 0.01).">
              <Info className="w-4 h-4 text-gray-400" />
            </Tooltip>
          </div>
          <Button type="button" variant="secondary" size="sm" onClick={handleAgregarRango}>
            <Plus className="w-4 h-4" />
            Agregar Rango
          </Button>
        </div>

        {errors.rangos && (
          <div className="text-sm text-red-600">{errors.rangos}</div>
        )}

        <div className="space-y-3">
          {rangosOrdenados.map((rango, index) => {
            const rangoOriginalIndex = formData.rangos.findIndex(r => r === rango);
            const isIlimitado = rango.max === null;

            return (
              <div key={rangoOriginalIndex} className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <div className="flex items-start gap-3">
                  <div className="flex-1 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Input
                          label="Cantidad Mínima"
                          type="number"
                          min="0"
                          step="0.01"
                          value={rango.min}
                          onChange={(e) => handleRangoChange(rangoOriginalIndex, 'min', Number(e.target.value))}
                          error={errors[`rango_${index}_min`]}
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <Input
                          label="Cantidad Máxima"
                          type="number"
                          min="0"
                          step="0.01"
                          value={isIlimitado ? '' : rango.max!}
                          onChange={(e) => handleRangoChange(rangoOriginalIndex, 'max', Number(e.target.value))}
                          error={errors[`rango_${index}_max`]}
                          placeholder={isIlimitado ? 'Ilimitado' : '0'}
                          disabled={isIlimitado}
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id={`ilimitado_${rangoOriginalIndex}`}
                        checked={isIlimitado}
                        onChange={(e) => handleToggleIlimitado(rangoOriginalIndex, e.target.checked)}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <label
                        htmlFor={`ilimitado_${rangoOriginalIndex}`}
                        className="text-sm text-gray-700 cursor-pointer"
                      >
                        Sin límite máximo (ilimitado)
                      </label>
                    </div>

                    {errors[`rango_${index}_continuidad`] && (
                      <div className="text-sm text-red-600">{errors[`rango_${index}_continuidad`]}</div>
                    )}

                    {index < rangosOrdenados.length - 1 && (
                      <div className="text-xs text-gray-500 bg-blue-50 p-2 rounded">
                        Este rango incluye desde <strong>{rango.min}</strong> hasta valores menores a <strong>{rango.max}</strong> (por ejemplo, hasta {(rango.max! - 0.01).toFixed(2)})
                      </div>
                    )}

                    {index === rangosOrdenados.length - 1 && !isIlimitado && (
                      <div className="text-xs text-gray-500 bg-blue-50 p-2 rounded">
                        Este rango incluye desde <strong>{rango.min}</strong> hasta <strong>{rango.max}</strong> (ambos valores inclusive)
                      </div>
                    )}

                    {isIlimitado && (
                      <div className="text-xs text-gray-500 bg-blue-50 p-2 rounded">
                        Este rango incluye desde <strong>{rango.min}</strong> en adelante (sin límite superior)
                      </div>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEliminarRango(rangoOriginalIndex)}
                    className="mt-6"
                    disabled={formData.rangos.length === 1}
                  >
                    <X className="w-4 h-4 text-red-600" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={loading}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" loading={loading}>
          {initialData ? 'Actualizar' : 'Crear'} Rango
        </Button>
      </div>
    </form>
  );
}
