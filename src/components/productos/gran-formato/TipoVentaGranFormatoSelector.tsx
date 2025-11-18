import { Check } from 'lucide-react';
import type { TipoVenta } from '../../../types/database';

interface TipoVentaGranFormatoSelectorProps {
  value: TipoVenta;
  onChange: (value: TipoVenta) => void;
  error?: string;
}

const tiposVenta = [
  { value: 'mt2' as TipoVenta, label: 'Por M²', description: 'Precio por metro cuadrado' },
  { value: 'mt_lineal' as TipoVenta, label: 'Por Metro Lineal', description: 'Precio por metro lineal' },
];

export function TipoVentaGranFormatoSelector({
  value,
  onChange,
  error,
}: TipoVentaGranFormatoSelectorProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-3">
        Tipo de Venta
        <span className="text-red-500 ml-1">*</span>
      </label>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {tiposVenta.map((tipo) => {
          const isSelected = value === tipo.value;
          return (
            <button
              key={tipo.value}
              type="button"
              onClick={() => onChange(tipo.value)}
              className={`relative flex cursor-pointer rounded-lg border ${
                isSelected
                  ? 'border-blue-600 bg-blue-50 ring-2 ring-blue-600'
                  : 'border-gray-300 bg-white hover:border-gray-400'
              } p-4 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200`}
            >
              <div className="flex w-full items-center justify-between">
                <div className="flex items-center">
                  <div className="text-sm text-left">
                    <p className={`font-medium ${isSelected ? 'text-blue-900' : 'text-gray-900'}`}>
                      {tipo.label}
                    </p>
                    <span className={`inline ${isSelected ? 'text-blue-700' : 'text-gray-500'}`}>
                      {tipo.description}
                    </span>
                  </div>
                </div>
                {isSelected && (
                  <div className="flex-shrink-0 text-blue-600">
                    <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
    </div>
  );
}
