import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../hooks/useAuth';
import { Percent } from 'lucide-react';
import { Select } from '../../ui/Select';

interface RangoPrecio {
  id: string;
  nombre: string;
  unidad_medida: string;
}

interface RangoPrecioSelectorPlotterCorteProps {
  rangoSeleccionado?: string;
  onChange: (rangoId?: string) => void;
}

export function RangoPrecioSelectorPlotterCorte({
  rangoSeleccionado,
  onChange,
}: RangoPrecioSelectorPlotterCorteProps) {
  const [rangos, setRangos] = useState<RangoPrecio[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user, profile } = useAuth();

  useEffect(() => {
    if (profile?.company_id) {
      cargarRangos();
    } else if (user && !profile) {
      setIsLoading(true);
    } else {
      setIsLoading(false);
    }
  }, [profile?.company_id, user]);

  const cargarRangos = async () => {
    try {
      setIsLoading(true);

      const { data, error } = await supabase
        .from('rangos_precio')
        .select('id, nombre, unidad_medida')
        .eq('company_id', profile?.company_id)
        .eq('is_active', true)
        .eq('unidad_medida', 'mt_lineal')
        .order('nombre');

      if (error) throw error;

      setRangos(data || []);
    } catch (err) {
      console.error('Error loading rangos precio:', err);
      setRangos([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (value: string) => {
    onChange(value === '' ? undefined : value);
  };

  if (isLoading) {
    return (
      <div className="animate-pulse">
        <div className="h-10 bg-gray-200 rounded"></div>
      </div>
    );
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        <div className="flex items-center gap-2">
          <Percent className="w-4 h-4" />
          Rango de Precios (Opcional)
        </div>
      </label>
      <p className="text-sm text-gray-500 mb-3">
        Selecciona un rango de precios para aplicar descuentos por cantidad
      </p>
      {rangos.length === 0 ? (
        <p className="text-sm text-gray-500 italic">
          No hay rangos de precio disponibles para metros lineales. Puedes crear uno en el módulo ABM Core.
        </p>
      ) : (
        <Select value={rangoSeleccionado || ''} onChange={handleChange}>
          <option value="">Sin rango de precios</option>
          {rangos.map((rango) => (
            <option key={rango.id} value={rango.id}>
              {rango.nombre}
            </option>
          ))}
        </Select>
      )}
    </div>
  );
}
