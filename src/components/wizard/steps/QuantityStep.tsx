import { Input } from '../../ui/Input';
import { Card } from '../../ui/card';
import { AlertCircle } from 'lucide-react';

interface QuantityStepProps {
  tipoVenta: 'unidad' | 'cantidad_fija' | null;
  cantidadesFijas: number[];
  cantidadMinima: number | null;
  cantidadSeleccionada: number | null;
  onSelect: (cantidad: number) => void;
}

export function QuantityStep({
  tipoVenta,
  cantidadesFijas,
  cantidadMinima,
  cantidadSeleccionada,
  onSelect,
}: QuantityStepProps) {
  const handleInputChange = (value: string) => {
    if (value === '') {
      return;
    }
    const num = parseInt(value, 10);
    if (!isNaN(num) && num > 0) {
      onSelect(num);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Cantidad</h2>
        <p className="text-gray-600">
          {tipoVenta === 'cantidad_fija'
            ? 'Seleccione una de las cantidades disponibles'
            : 'Ingrese la cantidad que desea ordenar'}
        </p>
      </div>

      {cantidadMinima && cantidadMinima > 1 && (
        <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-medium">Cantidad mínima: {cantidadMinima}</p>
            <p className="text-xs mt-1">
              Debe ordenar al menos {cantidadMinima} unidades de este producto
            </p>
          </div>
        </div>
      )}

      {tipoVenta === 'cantidad_fija' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {cantidadesFijas.map((cantidad) => (
            <Card
              key={cantidad}
              className={`p-6 cursor-pointer text-center transition-all hover:shadow-lg ${
                cantidadSeleccionada === cantidad
                  ? 'ring-2 ring-blue-600 bg-blue-50'
                  : 'hover:border-blue-300'
              }`}
              onClick={() => onSelect(cantidad)}
            >
              <p className="text-3xl font-bold text-gray-900">{cantidad}</p>
              <p className="text-sm text-gray-600 mt-1">unidades</p>
            </Card>
          ))}
        </div>
      ) : (
        <div className="max-w-md">
          <label htmlFor="cantidad" className="block text-sm font-medium text-gray-700 mb-2">
            Cantidad de unidades
          </label>
          <Input
            id="cantidad"
            type="number"
            min={cantidadMinima || 1}
            value={cantidadSeleccionada || ''}
            onChange={(e) => handleInputChange(e.target.value)}
            placeholder={`Mínimo ${cantidadMinima || 1}`}
            className="text-lg"
          />
          {cantidadSeleccionada !== null && cantidadSeleccionada > 0 && (
            <p className="mt-2 text-sm text-gray-600">
              {cantidadSeleccionada} {cantidadSeleccionada === 1 ? 'unidad' : 'unidades'}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
