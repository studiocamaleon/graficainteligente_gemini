import { Check } from 'lucide-react';

interface AnchosDisponiblesPlotterSelectorProps {
  anchosSeleccionados: number[];
  onChange: (anchos: number[]) => void;
  error?: string;
}

const ANCHOS_PLOTTER = [30, 50, 60, 120];

export function AnchosDisponiblesPlotterSelector({
  anchosSeleccionados,
  onChange,
  error,
}: AnchosDisponiblesPlotterSelectorProps) {
  const toggleAncho = (ancho: number) => {
    if (anchosSeleccionados.includes(ancho)) {
      onChange(anchosSeleccionados.filter((a) => a !== ancho));
    } else {
      onChange([...anchosSeleccionados, ancho].sort((a, b) => a - b));
    }
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-3">
        Anchos Disponibles
        <span className="text-red-500 ml-1">*</span>
      </label>
      <p className="text-sm text-gray-500 mb-3">
        Selecciona los anchos disponibles para este producto (en centímetros)
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {ANCHOS_PLOTTER.map((ancho) => {
          const isSelected = anchosSeleccionados.includes(ancho);
          return (
            <button
              key={ancho}
              type="button"
              onClick={() => toggleAncho(ancho)}
              className={`relative rounded-lg border p-4 transition-all duration-200 ${
                isSelected
                  ? 'border-pink-600 bg-pink-50 ring-2 ring-pink-600'
                  : 'border-gray-300 bg-white hover:border-gray-400'
              }`}
            >
              <div className="flex flex-col items-center">
                <span className={`text-2xl font-bold ${isSelected ? 'text-pink-900' : 'text-gray-900'}`}>
                  {ancho}
                </span>
                <span className={`text-sm ${isSelected ? 'text-pink-700' : 'text-gray-500'}`}>
                  cm
                </span>
                {isSelected && (
                  <div className="absolute top-2 right-2">
                    <div className="w-5 h-5 bg-pink-600 rounded-full flex items-center justify-center">
                      <Check className="w-3 h-3 text-white" />
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
