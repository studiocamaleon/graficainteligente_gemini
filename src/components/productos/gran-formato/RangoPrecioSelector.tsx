import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { Select } from '../../ui/Select';
import { useRangosPrecio } from '../../../hooks/useRangosPrecio';
import type { TipoVenta } from '../../../types/database';

interface RangoPrecioSelectorProps {
  tipoVenta: TipoVenta;
  rangoSeleccionado: string | undefined;
  onChange: (rangoId: string | undefined) => void;
  error?: string;
}

export function RangoPrecioSelector({
  tipoVenta,
  rangoSeleccionado,
  onChange,
  error,
}: RangoPrecioSelectorProps) {
  const { rangos, loading } = useRangosPrecio();
  const [rangosFiltrados, setRangosFiltrados] = useState<any[]>([]);

  useEffect(() => {
    // Filtrar rangos según el tipo de venta
    const filtered = rangos.filter((rango) => {
      if (!rango.unidad_medida) return false;
      return rango.unidad_medida === tipoVenta;
    });
    setRangosFiltrados(filtered);
  }, [rangos, tipoVenta]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Rango de Precios
        <span className="text-gray-500 ml-1">(Opcional)</span>
      </label>
      <p className="text-sm text-gray-500 mb-2">
        Asocia un rango de precios existente (debe coincidir con el tipo de venta: {tipoVenta === 'mt2' ? 'M²' : 'Metro Lineal'})
      </p>
      <Select
        value={rangoSeleccionado || ''}
        onChange={(value) => {
          onChange(value === '' ? undefined : value);
        }}
      >
        <option value="">Sin rango de precios</option>
        {rangosFiltrados.map((rango) => (
          <option key={rango.id} value={rango.id}>
            {rango.nombre} ({rango.rangos?.length || 0} nivel{rango.rangos?.length !== 1 ? 'es' : ''})
          </option>
        ))}
      </Select>
      {error && <p className="text-sm text-red-600 mt-1">{error}</p>}
      {rangosFiltrados.length === 0 && !loading && (
        <p className="text-sm text-amber-600 mt-2">
          No hay rangos de precios disponibles para "{tipoVenta === 'mt2' ? 'M²' : 'Metro Lineal'}".
          Puedes crear uno en el módulo ABM Core.
        </p>
      )}
    </div>
  );
}
