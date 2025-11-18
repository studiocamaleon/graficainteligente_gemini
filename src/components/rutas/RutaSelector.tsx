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
  const { rutas, loading } = useRutasProduccion({
    isActive: true,
    itemsPerPage: 1000,
  });

  const [selectedRuta, setSelectedRuta] = useState<RutaProduccion | null>(null);

  useEffect(() => {
    if (value && rutas.length > 0) {
      const ruta = rutas.find((r) => r.id === value);
      setSelectedRuta(ruta || null);
    } else {
      setSelectedRuta(null);
    }
  }, [value, rutas]);

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
