import { Select } from '../../ui/Select';
import type { MarcaSello } from '../../../types/database';

interface MarcaSelloSelectorProps {
  value: MarcaSello | '';
  onChange: (value: MarcaSello | '') => void;
  error?: string;
}

export function MarcaSelloSelector({ value, onChange, error }: MarcaSelloSelectorProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Marca
        <span className="text-red-500 ml-1">*</span>
      </label>
      <Select
        value={value}
        onChange={(newValue) => onChange(newValue as MarcaSello | '')}
      >
        <option value="">Selecciona una marca</option>
        <option value="Trodat">Trodat</option>
        <option value="ColoP">ColoP</option>
        <option value="Shiny">Shiny</option>
      </Select>
      {error && <p className="text-sm text-red-600 mt-1">{error}</p>}
    </div>
  );
}
