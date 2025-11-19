import { Card } from '../../ui/Card';
import { Ruler } from 'lucide-react';
import type { MedidaDisponible } from '../../../types/wizard';

interface SizeStepProps {
  medidasDisponibles: MedidaDisponible[];
  medidaSeleccionada: { ancho: number; alto: number } | null;
  onSelect: (medida: MedidaDisponible) => void;
}

export function SizeStep({
  medidasDisponibles,
  medidaSeleccionada,
  onSelect,
}: SizeStepProps) {
  const isSelected = (medida: MedidaDisponible) => {
    if (!medidaSeleccionada) return false;
    return (
      medidaSeleccionada.ancho === medida.ancho &&
      medidaSeleccionada.alto === medida.alto
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Medida</h2>
        <p className="text-gray-600">
          Seleccione el tamaño del producto
        </p>
      </div>

      {medidasDisponibles.length === 0 ? (
        <div className="text-center py-12 bg-yellow-50 rounded-lg border border-yellow-200">
          <Ruler className="w-12 h-12 text-yellow-600 mx-auto mb-3" />
          <p className="text-yellow-800 font-medium">No hay medidas configuradas</p>
          <p className="text-sm text-yellow-700 mt-1">
            Configure precios para este producto para ver medidas disponibles
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {medidasDisponibles.map((medida, index) => (
            <Card
              key={index}
              className={`p-6 cursor-pointer text-center transition-all hover:shadow-lg ${
                isSelected(medida)
                  ? 'ring-2 ring-blue-600 bg-blue-50'
                  : 'hover:border-blue-300'
              }`}
              onClick={() => onSelect(medida)}
            >
              <Ruler className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="text-lg font-bold text-gray-900">
                {medida.ancho} × {medida.alto}
              </p>
              <p className="text-sm text-gray-600">cm</p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
