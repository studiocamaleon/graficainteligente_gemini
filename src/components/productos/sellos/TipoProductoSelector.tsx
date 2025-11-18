import { Select } from '../../ui/Select';
import type { TipoProductoSello } from '../../../types/database';

interface TipoProductoSelectorProps {
  value: TipoProductoSello;
  onChange: (value: TipoProductoSello) => void;
  error?: string;
}

const TIPOS_PRODUCTO: { value: TipoProductoSello; label: string }[] = [
  { value: 'sello', label: 'Sello' },
  { value: 'repuesto', label: 'Repuesto' },
  { value: 'polimero', label: 'Polímero' },
  { value: 'tinta', label: 'Tinta' },
  { value: 'accesorios', label: 'Accesorios' },
];

export function TipoProductoSelector({ value, onChange, error }: TipoProductoSelectorProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Tipo de Producto
        <span className="text-red-500 ml-1">*</span>
      </label>
      <Select
        value={value}
        onChange={(newValue) => onChange(newValue as TipoProductoSello)}
      >
        <option value="">Selecciona un tipo</option>
        {TIPOS_PRODUCTO.map((tipo) => (
          <option key={tipo.value} value={tipo.value}>
            {tipo.label}
          </option>
        ))}
      </Select>
      {error && <p className="text-sm text-red-600 mt-1">{error}</p>}
    </div>
  );
}
