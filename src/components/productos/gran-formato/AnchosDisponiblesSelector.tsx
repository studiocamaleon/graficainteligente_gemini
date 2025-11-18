import { Check } from 'lucide-react';

interface AnchosDisponiblesSelectorProps {
  anchosSeleccionados: number[];
  onChange: (anchos: number[]) => void;
  error?: string;
}

const ANCHOS_FIJOS = [30, 60, 120, 127, 135, 150]; // cm

export function AnchosDisponiblesSelector({
  anchosSeleccionados,
  onChange,
  error,
}: AnchosDisponiblesSelectorProps) {
  const selectAncho = (ancho: number) => {
    // Solo permitir seleccionar un único ancho
    onChange([ancho]);
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-3">
        Ancho Fijo
        <span className="text-red-500 ml-1">*</span>
      </label>
      <p className="text-sm text-gray-500 mb-3">
        Selecciona el ancho fijo para este producto (solo uno permitido)
      </p>
      <div className="grid grid-cols-3 gap-3">
        {ANCHOS_FIJOS.map((ancho) => {
          const isSelected = anchosSeleccionados.includes(ancho);
          return (
            <button
              key={ancho}
              type="button"
              onClick={() => selectAncho(ancho)}
              className={`relative rounded-lg border p-4 transition-all duration-200 ${
                isSelected
                  ? 'border-blue-600 bg-blue-50 ring-2 ring-blue-600'
                  : 'border-gray-300 bg-white hover:border-gray-400'
              }`}
            >
              <div className="flex flex-col items-center">
                <span className={`text-2xl font-bold ${isSelected ? 'text-blue-900' : 'text-gray-900'}`}>
                  {ancho}
                </span>
                <span className={`text-sm ${isSelected ? 'text-blue-700' : 'text-gray-500'}`}>
                  cm
                </span>
                {isSelected && (
                  <div className="absolute top-2 right-2">
                    <div className="w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center">
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
