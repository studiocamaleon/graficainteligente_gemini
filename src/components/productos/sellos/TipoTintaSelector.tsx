import { Select } from '../../ui/Select';
import type { TipoTinta } from '../../../types/database';

interface TipoTintaSelectorProps {
  value: TipoTinta | '';
  onChange: (value: TipoTinta | '') => void;
  error?: string;
}

export function TipoTintaSelector({ value, onChange, error }: TipoTintaSelectorProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Tipo de Tinta
        <span className="text-red-500 ml-1">*</span>
      </label>
      <Select
        value={value}
        onChange={(e) => onChange(e.target.value as TipoTinta | '')}
      >
        <option value="">Selecciona un tipo</option>
        <option value="textil">Textil</option>
        <option value="papel">Papel</option>
      </Select>
      {error && <p className="text-sm text-red-600 mt-1">{error}</p>}
    </div>
  );
}
