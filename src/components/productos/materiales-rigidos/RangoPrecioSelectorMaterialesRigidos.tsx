import { useRangosPrecio } from '../../../hooks/useRangosPrecio';
import { SearchableSelect } from '../../ui/SearchableSelect';
import { Loader2 } from 'lucide-react';

interface RangoPrecioSelectorMaterialesRigidosProps {
  value: string | null;
  onChange: (value: string | null) => void;
}

export function RangoPrecioSelectorMaterialesRigidos({
  value,
  onChange,
}: RangoPrecioSelectorMaterialesRigidosProps) {
  const { rangos, isLoading } = useRangosPrecio();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
      </div>
    );
  }

  const rangosMt2 = rangos.filter((r) => r.unidad_medida === 'mt2' && r.is_active);

  const options = [
    { value: '', label: 'Sin rango de precios' },
    ...rangosMt2.map((r) => ({
      value: r.id,
      label: r.nombre,
    })),
  ];

  const handleChange = (newValue: string) => {
    onChange(newValue === '' ? null : newValue);
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Rango de Precios (Opcional)
      </label>
      <SearchableSelect
        options={options}
        value={value || ''}
        onChange={handleChange}
        placeholder="Selecciona un rango de precios..."
        emptyMessage="No hay rangos de precios disponibles"
      />
      <p className="mt-1 text-xs text-gray-500">
        Solo se muestran rangos configurados para metros cuadrados (m²)
      </p>
    </div>
  );
}
