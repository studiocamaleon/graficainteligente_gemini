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
      <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="animate-pulse">
            <div className="h-12 bg-gray-200 rounded-lg"></div>
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
    <div className="space-y-2">
      <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
        {sortedTamanios.map((tamanio) => {
          const isSelected = selectedId === tamanio.id;
          const isCommon = isCommonSize(tamanio.nombre);

          return (
            <button
              key={tamanio.id}
              type="button"
              onClick={() => onSelect(tamanio.id)}
              className={`
                relative px-2 py-1.5 rounded-lg border-2 transition-all duration-200 text-left
                hover:shadow-sm
                ${
                  isSelected
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }
              `}
            >
              <div className="flex items-center gap-1.5">
                <FileText
                  className={`w-4 h-5 flex-shrink-0 ${
                    isSelected ? 'text-blue-600' : 'text-gray-400'
                  }`}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span
                      className={`font-bold text-xs truncate ${
                        isSelected ? 'text-blue-700' : 'text-gray-900'
                      }`}
                    >
                      {tamanio.nombre}
                    </span>
                    {isSelected && (
                      <CheckCircle2 className="w-3 h-3 text-blue-600 flex-shrink-0" />
                    )}
                  </div>
                  <div className="flex items-center gap-1 mt-0.5">
                    <span
                      className={`text-[9px] ${
                        isSelected ? 'text-blue-600' : 'text-gray-500'
                      }`}
                    >
                      {tamanio.ancho_mm} × {tamanio.alto_mm}
                    </span>
                    {isCommon && (
                      <span className="text-[8px] font-medium text-green-600 bg-green-50 px-1 py-0.5 rounded">
                        ✓
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
