import { Select } from '../../ui/Select';

interface ImpuestoSelloSelectorProps {
  value: number;
  onChange: (value: number) => void;
  error?: string;
}

export function ImpuestoSelloSelector({ value, onChange, error }: ImpuestoSelloSelectorProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Impuesto IVA
        <span className="text-red-500 ml-1">*</span>
      </label>
      <Select value={value} onChange={(e) => onChange(parseFloat(e.target.value))}>
        <option value="21">21%</option>
        <option value="10.5">10.5%</option>
      </Select>
      {error && <p className="text-sm text-red-600 mt-1">{error}</p>}
      <p className="text-xs text-gray-500 mt-1">
        Porcentaje de IVA aplicable al producto
      </p>
    </div>
  );
}
