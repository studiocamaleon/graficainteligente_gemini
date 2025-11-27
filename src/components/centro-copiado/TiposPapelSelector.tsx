import { useState, useMemo } from 'react';
import { Search, CheckCircle2 } from 'lucide-react';
import { Input } from '../ui/Input';
import { Badge } from '../ui/Badge';
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
  const [searchTerm, setSearchTerm] = useState('');
  const [showAll, setShowAll] = useState(false);

  const filteredPapeles = useMemo(() => {
    let filtered = papeles;

    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (papel) =>
          papel.variante_nombre.toLowerCase().includes(search) ||
          papel.material?.nombre.toLowerCase().includes(search)
      );
    }

    const sorted = [...filtered].sort((a, b) => {
      if (a.orden !== b.orden) {
        return (a.orden || 999) - (b.orden || 999);
      }

      return a.variante_nombre.localeCompare(b.variante_nombre);
    });

    return sorted;
  }, [papeles, searchTerm]);

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
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          type="text"
          placeholder="Buscar tipo de papel..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9"
        />
        {searchTerm && (
          <button
            type="button"
            onClick={() => setSearchTerm('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            ×
          </button>
        )}
      </div>

      {filteredPapeles.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p className="text-sm">No se encontraron tipos de papel</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 md:grid-cols-4 gap-2 max-h-[400px] overflow-y-auto pr-1">
            {displayedPapeles.map((papel) => {
              const isSelected = selectedId === papel.id;
              const colorClass = getMaterialColor(papel.material?.nombre);

              return (
                <button
                  key={papel.id}
                  type="button"
                  onClick={() => onSelect(papel.id)}
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
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <span
                          className={`font-bold text-xs truncate ${
                            isSelected ? 'text-blue-700' : 'text-gray-900'
                          }`}
                        >
                          {papel.variante_nombre}
                        </span>
                        {isSelected && (
                          <CheckCircle2 className="w-3 h-3 text-blue-600 flex-shrink-0" />
                        )}
                      </div>

                      <div className="flex items-center justify-between gap-1.5">
                        {papel.material && (
                          <span
                            className={`text-[8px] font-medium px-1 py-0.5 rounded border truncate ${colorClass}`}
                          >
                            {papel.material.nombre}
                          </span>
                        )}
                        {papel.espesor && (
                          <span
                            className={`text-xs font-bold flex-shrink-0 ${
                              isSelected
                                ? 'text-blue-700'
                                : 'text-gray-800'
                            }`}
                          >
                            {papel.espesor}{papel.unidad_espesor}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {hasMore && !searchTerm && (
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

          {searchTerm && (
            <div className="text-xs text-gray-500 text-center">
              {filteredPapeles.length} resultado{filteredPapeles.length !== 1 ? 's' : ''}
            </div>
          )}
        </>
      )}
    </div>
  );
}
