import { Info } from 'lucide-react';
import { Input } from '../../ui/Input';
import { Tooltip } from '../../ui/Tooltip';
import type { TipoVenta } from '../../../types/database';

interface CantidadMinimaInputProps {
  tipoVenta: TipoVenta;
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  error?: string;
}

export function CantidadMinimaInput({
  tipoVenta,
  value,
  onChange,
  error,
}: CantidadMinimaInputProps) {
  const unidadMedida = tipoVenta === 'mt2' ? 'metros cuadrados (m²)' : 'metros lineales';
  const ejemploUnidad = tipoVenta === 'mt2' ? 'm²' : 'mts lineales';

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;

    if (inputValue === '' || inputValue === '0') {
      onChange(undefined);
      return;
    }

    const numValue = parseFloat(inputValue);
    if (!isNaN(numValue) && numValue > 0) {
      onChange(numValue);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <label className="block text-sm font-medium text-gray-700">
          Cantidad Mínima a Cobrar
          <span className="text-gray-500 ml-1">(Opcional)</span>
        </label>
        <Tooltip content={`Si configuras una cantidad mínima, el sistema cobrará este valor aunque el cliente solicite menos ${ejemploUnidad}. Ejemplo: si configuras 0.5 ${ejemploUnidad} y el cliente pide 0.3 ${ejemploUnidad}, se le cobrará 0.5 ${ejemploUnidad}.`}>
          <Info className="w-4 h-4 text-gray-400 cursor-help" />
        </Tooltip>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex-1">
          <Input
            type="number"
            value={value !== undefined ? value : ''}
            onChange={handleChange}
            placeholder={`Ej: 0.5 ${ejemploUnidad}`}
            step="0.01"
            min="0"
            error={error}
          />
        </div>
        <div className="text-sm text-gray-600 min-w-[120px]">
          {tipoVenta === 'mt2' ? 'm² mínimo' : 'mts lineales'}
        </div>
      </div>

      <p className="text-xs text-gray-500">
        Cantidad mínima en <strong>{unidadMedida}</strong> que se cobrará al cliente,
        incluso si solicita una cantidad menor. Déjalo vacío si no aplica cantidad mínima.
      </p>

      {value && value > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-2">
          <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-blue-800">
            <strong>Ejemplo:</strong> Si el cliente solicita menos de {value} {ejemploUnidad},
            se le facturará {value} {ejemploUnidad} y el vendedor verá un indicador de "Precio mínimo aplicado".
          </p>
        </div>
      )}
    </div>
  );
}
