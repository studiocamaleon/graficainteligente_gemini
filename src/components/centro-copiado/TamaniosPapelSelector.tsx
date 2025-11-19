import { FileText, CheckCircle2 } from 'lucide-react';
import type { CentroCopiadoTamanioPapel } from '../../types/database';

interface TamaniosPapelSelectorProps {
  tamanios: CentroCopiadoTamanioPapel[];
  selectedId: string | undefined;
  onSelect: (id: string) => void;
  loading?: boolean;
}

const getTamanioIcon = (nombre: string) => {
  const nombreUpper = nombre.toUpperCase();
  if (nombreUpper.includes('A4') || nombreUpper.includes('CARTA')) {
    return 'w-6 h-8';
  } else if (nombreUpper.includes('A3') || nombreUpper.includes('TABLOIDE')) {
    return 'w-8 h-10';
  } else if (nombreUpper.includes('A5')) {
    return 'w-5 h-6';
  }
  return 'w-6 h-8';
};

const isCommonSize = (nombre: string) => {
  const common = ['A4', 'CARTA', 'OFICIO', 'A3'];
  return common.some(c => nombre.toUpperCase().includes(c));
};

export function TamaniosPapelSelector({
  tamanios,
  selectedId,
  onSelect,
  loading = false,
}: TamaniosPapelSelectorProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="animate-pulse">
            <div className="h-24 bg-gray-200 rounded-lg"></div>
          </div>
        ))}
      </div>
    );
  }

  const sortedTamanios = [...tamanios].sort((a, b) => {
    const aCommon = isCommonSize(a.nombre);
    const bCommon = isCommonSize(b.nombre);
    if (aCommon && !bCommon) return -1;
    if (!aCommon && bCommon) return 1;
    return a.nombre.localeCompare(b.nombre);
  });

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {sortedTamanios.map((tamanio) => {
          const isSelected = selectedId === tamanio.id;
          const isCommon = isCommonSize(tamanio.nombre);

          return (
            <button
              key={tamanio.id}
              type="button"
              onClick={() => onSelect(tamanio.id)}
              className={`
                relative p-4 rounded-lg border-2 transition-all duration-200 text-left
                hover:shadow-md hover:scale-102
                ${
                  isSelected
                    ? 'border-blue-500 bg-blue-50 shadow-sm'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }
              `}
            >
              <div className="flex flex-col items-center justify-center space-y-2 min-h-[80px]">
                <div className="flex items-center gap-2">
                  <FileText
                    className={`${getTamanioIcon(tamanio.nombre)} ${
                      isSelected ? 'text-blue-600' : 'text-gray-400'
                    }`}
                  />
                  {isCommon && !isSelected && (
                    <span className="text-[10px] font-medium text-green-600 bg-green-50 px-1.5 py-0.5 rounded">
                      Común
                    </span>
                  )}
                </div>

                <div className="text-center w-full">
                  <div
                    className={`font-bold text-base ${
                      isSelected ? 'text-blue-700' : 'text-gray-900'
                    }`}
                  >
                    {tamanio.nombre}
                  </div>
                  <div
                    className={`text-xs mt-1 ${
                      isSelected ? 'text-blue-600' : 'text-gray-500'
                    }`}
                  >
                    {tamanio.ancho_mm} × {tamanio.alto_mm} mm
                  </div>
                </div>
              </div>

              {isSelected && (
                <div className="absolute top-2 right-2">
                  <CheckCircle2 className="w-5 h-5 text-blue-600" />
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
