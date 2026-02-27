import { useState, useMemo } from 'react';
import { CheckCircle2 } from 'lucide-react';
import type { CentroCopiadoPapel } from '../../types/database';

interface PapelWithMaterial extends CentroCopiadoPapel {
  material?: {
    id: string;
    nombre: string;
  };
}

interface TiposPapelSelectorProps {
  papeles: PapelWithMaterial[];
  selectedId: string | undefined;
  onSelect: (id: string) => void;
  loading?: boolean;
}

const getMaterialColor = (materialNombre: string | undefined) => {
  if (!materialNombre) return 'bg-gray-100 text-gray-700 border-gray-200';

  const nombre = materialNombre.toUpperCase();
  if (nombre.includes('BOND')) return 'bg-blue-50 text-blue-700 border-blue-200';
  if (nombre.includes('OPALINA')) return 'bg-purple-50 text-purple-700 border-purple-200';
  if (nombre.includes('COUCHE')) return 'bg-green-50 text-green-700 border-green-200';
  if (nombre.includes('KRAFT')) return 'bg-amber-50 text-amber-700 border-amber-200';
  if (nombre.includes('CARTULINA')) return 'bg-pink-50 text-pink-700 border-pink-200';

  return 'bg-gray-50 text-gray-700 border-gray-200';
};

export function TiposPapelSelector({
  papeles,
  selectedId,
  onSelect,
  loading = false,
}: TiposPapelSelectorProps) {
  const [showAll, setShowAll] = useState(false);

  const filteredPapeles = useMemo(() => {
    let filtered = papeles;

    const sorted = [...filtered].sort((a, b) => {
      // @ts-ignore - orden property might not exist on type definition but exists in DB
      if (a.orden !== b.orden) {
        // @ts-ignore
        return (a.orden || 999) - (b.orden || 999);
      }

      return a.variante_nombre.localeCompare(b.variante_nombre);
    });

    return sorted;
  }, [papeles]);

  const displayedPapeles = showAll ? filteredPapeles : filteredPapeles.slice(0, 8);
  const hasMore = filteredPapeles.length > 8;

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="animate-pulse h-10 bg-gray-200 rounded-lg"></div>
        <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="animate-pulse h-12 bg-gray-200 rounded-lg"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">

      {filteredPapeles.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p className="text-sm">No se encontraron tipos de papel</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 max-h-[400px] overflow-y-auto pr-1">
            {displayedPapeles.map((papel) => {
              const isSelected = selectedId === papel.id;
              const colorClass = getMaterialColor(papel.material?.nombre);

              return (
                <button
                  key={papel.id}
                  type="button"
                  onClick={() => onSelect(papel.id)}
                  className={`
                    relative p-2 rounded-lg border-2 transition-all duration-200 text-left
                    hover:shadow-md flex flex-col gap-1 h-full
                    ${isSelected
                      ? 'border-slate-800 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-900 text-white shadow-[0_10px_24px_rgba(15,23,42,0.35)]'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                    }
                  `}
                >
                  <div className="flex justify-between items-start w-full">
                    <span className={`font-bold text-sm leading-tight ${isSelected ? 'text-white' : 'text-gray-900'}`}>
                      {papel.variante_nombre}
                    </span>
                    {isSelected && (
                      <CheckCircle2 className="w-4 h-4 text-white flex-shrink-0 ml-1" />
                    )}
                  </div>

                  <div className="flex items-center gap-2 mt-auto">
                    {papel.espesor && (
                      <span className={`text-xs font-bold ${isSelected ? 'text-slate-200' : 'text-gray-700'}`}>
                        {papel.espesor}{papel.unidad_espesor}
                      </span>
                    )}
                    {papel.material && (
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border truncate ${colorClass}`}>
                        {papel.material.nombre}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {hasMore && (
            <div className="flex justify-center pt-2">
              <button
                type="button"
                onClick={() => setShowAll(!showAll)}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                {showAll ? 'Ver menos' : `Ver todos (${filteredPapeles.length})`}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
