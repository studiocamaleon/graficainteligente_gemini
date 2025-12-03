import { useState, useEffect } from 'react';
import { Loader2, Info } from 'lucide-react';
import { Select } from '../../ui/Select';
import { useRangosPrecio } from '../../../hooks/useRangosPrecio';

interface RangoPrecioSelectorLaserProps {
  rangoSeleccionado: string | undefined;
  onChange: (rangoId: string | undefined) => void;
  required?: boolean;
  error?: string;
}

export function RangoPrecioSelectorLaser({
  rangoSeleccionado,
  onChange,
  required = false,
  error,
}: RangoPrecioSelectorLaserProps) {
  const { rangos, loading } = useRangosPrecio();
  const [rangosFiltrados, setRangosFiltrados] = useState<any[]>([]);

  useEffect(() => {
    const filtered = rangos.filter((rango) => rango.unidad_medida === 'unidades');
    setRangosFiltrados(filtered);
  }, [rangos]);

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
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <p className="text-sm text-gray-500 mb-2 flex items-start gap-1">
        <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <span>Selecciona el rango de cantidades que aplicará para este producto</span>
      </p>
      <Select
        value={rangoSeleccionado || ''}
        onChange={(value) => {
          onChange(value === '' ? undefined : value);
        }}
      >
        <option value="">Seleccionar rango de precios</option>
        {rangosFiltrados.map((rango) => (
          <option key={rango.id} value={rango.id}>
            {rango.nombre} ({rango.rangos?.length || 0} nivel{rango.rangos?.length !== 1 ? 'es' : ''})
          </option>
        ))}
      </Select>
      {error && <p className="text-sm text-red-600 mt-1">{error}</p>}
      {rangosFiltrados.length === 0 && !loading && (
        <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-sm text-amber-800">
            No hay rangos de precios disponibles para "Unidades".
            Puedes crear uno en el módulo <span className="font-semibold">ABM Core → Rangos de Precio</span>.
          </p>
        </div>
      )}
    </div>
  );
}
