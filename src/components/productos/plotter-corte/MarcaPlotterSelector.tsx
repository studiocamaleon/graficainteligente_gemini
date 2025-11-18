import { Tag } from 'lucide-react';
import { Select } from '../../ui/Select';
import type { MarcaPlotter } from '../../../types/database';

interface MarcaPlotterSelectorProps {
  value: MarcaPlotter | null;
  onChange: (marca: MarcaPlotter | null) => void;
}

const MARCAS: MarcaPlotter[] = ['Avery', 'Oracal', 'Ritrama', 'McCal', 'Orajet', 'Importado'];

export function MarcaPlotterSelector({ value, onChange }: MarcaPlotterSelectorProps) {
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedValue = e.target.value;
    onChange(selectedValue === '' ? null : (selectedValue as MarcaPlotter));
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        <div className="flex items-center gap-2">
          <Tag className="w-4 h-4" />
          Marca (Opcional)
        </div>
      </label>
      <p className="text-sm text-gray-500 mb-3">
        Selecciona la marca del producto si aplica
      </p>
      <Select value={value || ''} onChange={handleChange}>
        <option value="">Sin Marca</option>
        {MARCAS.map((marca) => (
          <option key={marca} value={marca}>
            {marca}
          </option>
        ))}
      </Select>
    </div>
  );
}
