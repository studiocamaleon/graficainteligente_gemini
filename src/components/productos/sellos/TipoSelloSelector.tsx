import { Select } from '../../ui/Select';
import type { TipoSello } from '../../../types/database';

interface TipoSelloSelectorProps {
  value: TipoSello | '';
  onChange: (value: TipoSello | '') => void;
  error?: string;
}

export function TipoSelloSelector({ value, onChange, error }: TipoSelloSelectorProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Tipo de Sello
        <span className="text-red-500 ml-1">*</span>
      </label>
      <Select
        value={value}
        onChange={(e) => onChange(e.target.value as TipoSello | '')}
      >
        <option value="">Selecciona un tipo</option>
        <option value="manual">Manual</option>
        <option value="automatico">Automático</option>
      </Select>
      {error && <p className="text-sm text-red-600 mt-1">{error}</p>}
    </div>
  );
}
