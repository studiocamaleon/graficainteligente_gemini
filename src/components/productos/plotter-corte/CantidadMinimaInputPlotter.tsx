import { Ruler } from 'lucide-react';
import { Input } from '../../ui/Input';

interface CantidadMinimaInputPlotterProps {
  value: number | undefined;
  onChange: (value: number | undefined) => void;
}

export function CantidadMinimaInputPlotter({
  value,
  onChange,
}: CantidadMinimaInputPlotterProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val === '') {
      onChange(undefined);
    } else {
      const numVal = parseFloat(val);
      if (!isNaN(numVal) && numVal > 0) {
        onChange(numVal);
      }
    }
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        <div className="flex items-center gap-2">
          <Ruler className="w-4 h-4" />
          Cantidad Mínima a Cobrar (Opcional)
        </div>
      </label>
      <p className="text-sm text-gray-500 mb-3">
        Cantidad mínima en metros lineales que se cobrará aunque se solicite menos
      </p>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          value={value === undefined ? '' : value}
          onChange={handleChange}
          placeholder="Ej: 1"
          min="0"
          step="0.01"
          className="flex-1"
        />
        <span className="text-sm text-gray-600 font-medium whitespace-nowrap">
          metros lineales
        </span>
      </div>
      <p className="text-xs text-gray-500 mt-2">
        Si no se especifica, no habrá cantidad mínima obligatoria
      </p>
    </div>
  );
}
