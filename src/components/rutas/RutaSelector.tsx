import { useEffect, useState } from 'react';
import { Route } from 'lucide-react';
import { SearchableSelect } from '../ui/SearchableSelect';
import { Badge } from '../ui/Badge';
import { useRutasProduccion } from '../../hooks/useRutasProduccion';
import type { RutaProduccion } from '../../types/database';

interface RutaSelectorProps {
  value: string;
  onChange: (rutaId: string) => void;
  error?: string;
  disabled?: boolean;
  showDescription?: boolean;
}

export function RutaSelector({
  value,
  onChange,
  error,
  disabled = false,
  showDescription = false,
}: RutaSelectorProps) {
  console.log('🎯 RutaSelector renderizado con value:', value);

  const { rutas, loading } = useRutasProduccion({
    isActive: true,
    itemsPerPage: 1000,
  });

  console.log('📋 Estado de rutas:', {
    loading,
    rutasCount: rutas.length,
    rutasIds: rutas.map(r => ({ id: r.id, nombre: r.nombre }))
  });

  const [selectedRuta, setSelectedRuta] = useState<RutaProduccion | null>(null);

  useEffect(() => {
    console.log('🔄 RutaSelector useEffect ejecutado', {
      value,
      valueType: typeof value,
      rutasLength: rutas.length,
      loading
    });

    if (value && rutas.length > 0) {
      const ruta = rutas.find((r) => r.id === value);
      console.log('🔍 Buscando ruta:', {
        valueToFind: value,
        rutaFound: !!ruta,
        rutaNombre: ruta?.nombre
      });
      setSelectedRuta(ruta || null);
    } else if (!value) {
      console.log('⚠️ No hay value, reseteando selectedRuta');
      setSelectedRuta(null);
    } else {
      console.log('⏳ Esperando rutas... value existe pero rutas.length = 0');
    }
  }, [value, rutas, loading]);

  const handleChange = (rutaId: string) => {
    onChange(rutaId);
    const ruta = rutas.find((r) => r.id === rutaId);
    setSelectedRuta(ruta || null);
  };

  const rutasOptions = rutas.map((ruta) => ({
    value: ruta.id,
    label: ruta.nombre,
  }));

  return (
    <div className="space-y-3">
      <SearchableSelect
        options={rutasOptions}
        value={value}
        onChange={handleChange}
        placeholder={loading ? 'Cargando rutas...' : 'Seleccionar ruta de producción...'}
        error={error}
        disabled={disabled || loading}
        loading={loading}
      />

      {selectedRuta && showDescription && selectedRuta.descripcion && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-sm text-blue-900">{selectedRuta.descripcion}</p>
        </div>
      )}

      {!loading && rutas.length === 0 && (
        <p className="text-sm text-amber-600">
          No hay rutas de producción activas disponibles. Crea una nueva ruta en el módulo ABM Core.
        </p>
      )}
    </div>
  );
}
