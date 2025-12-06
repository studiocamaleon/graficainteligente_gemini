import { FileText, CheckCircle2 } from 'lucide-react';
import type { CentroCopiadoTamanioPapel } from '../../types/database';

interface TamaniosPapelSelectorProps {
  tamanios: CentroCopiadoTamanioPapel[];
  selectedId: string | undefined;
  onSelect: (id: string) => void;
  loading?: boolean;
}

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
      <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-2">
        {sortedTamanios.map((tamanio) => {
          const isSelected = selectedId === tamanio.id;

          return (
            <button
              key={tamanio.id}
              type="button"
              onClick={() => onSelect(tamanio.id)}
              className={`
                relative p-1.5 rounded-lg border-2 transition-all duration-200 text-center
                hover:shadow-sm flex flex-col items-center justify-center gap-1 h-full
                ${isSelected
                  ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500'
                  : 'border-gray-200 bg-white hover:border-gray-300'
                }
              `}
            >
              <div className="relative">
                <FileText
                  className={`w-6 h-8 ${isSelected ? 'text-blue-600' : 'text-gray-400'
                    }`}
                />
                {isSelected && (
                  <CheckCircle2 className="w-3 h-3 text-blue-600 absolute -top-1 -right-1 bg-white rounded-full" />
                )}
              </div>

              <div className="flex flex-col items-center w-full min-w-0">
                <span
                  className={`font-bold text-xs truncate w-full ${isSelected ? 'text-blue-700' : 'text-gray-900'
                    }`}
                >
                  {tamanio.nombre}
                </span>
                <span
                  className={`text-[9px] ${isSelected ? 'text-blue-600' : 'text-gray-500'
                    }`}
                >
                  {tamanio.ancho_mm}×{tamanio.alto_mm}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
