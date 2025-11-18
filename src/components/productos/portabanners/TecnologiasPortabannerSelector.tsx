import { useTecnologiasPortabanner } from '../../../hooks/useTecnologiasPortabanner';
import { TechnologyMiniCard } from '../../ui/TechnologyMiniCard';
import { X } from 'lucide-react';

interface TecnologiasPortabannerSelectorProps {
  tecnologiasSeleccionadas: string[];
  onTecnologiasChange: (tecnologias: string[]) => void;
  error?: string;
}

export function TecnologiasPortabannerSelector({
  tecnologiasSeleccionadas,
  onTecnologiasChange,
  error,
}: TecnologiasPortabannerSelectorProps) {
  const { tecnologias, isLoading } = useTecnologiasPortabanner();

  const handleToggleTecnologia = (tecnologiaId: string) => {
    if (tecnologiasSeleccionadas.includes(tecnologiaId)) {
      onTecnologiasChange(tecnologiasSeleccionadas.filter((id) => id !== tecnologiaId));
    } else {
      onTecnologiasChange([...tecnologiasSeleccionadas, tecnologiaId]);
    }
  };

  const handleEliminarTecnologia = (tecnologiaId: string) => {
    onTecnologiasChange(tecnologiasSeleccionadas.filter((id) => id !== tecnologiaId));
  };

  const tecnologiasSeleccionadasData = tecnologias.filter((t) =>
    tecnologiasSeleccionadas.includes(t.id)
  );

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Tecnologías de Impresión</h3>
        <p className="text-sm text-gray-600 mb-4">
          Selecciona las tecnologías disponibles para este portabanner. Podrás asignar precios
          diferenciados por tecnología en el módulo de precios.
        </p>
        <p className="text-xs text-gray-500 mb-4">
          Nota: Todas las tecnologías utilizarán tintas CMYK por defecto.
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Tecnologías disponibles
          <span className="text-red-500 ml-1">*</span>
        </label>

        {isLoading ? (
          <div className="text-center py-8 text-gray-500">Cargando tecnologías...</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {tecnologias.map((tecnologia) => {
              const isSelected = tecnologiasSeleccionadas.includes(tecnologia.id);
              return (
                <button
                  key={tecnologia.id}
                  type="button"
                  onClick={() => handleToggleTecnologia(tecnologia.id)}
                  className={`
                    relative p-4 rounded-lg border-2 text-left transition-all
                    ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }
                  `}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-900">{tecnologia.nombre}</span>
                    <div
                      className={`
                        w-5 h-5 rounded border-2 flex items-center justify-center
                        ${
                          isSelected
                            ? 'border-blue-500 bg-blue-500'
                            : 'border-gray-300 bg-white'
                        }
                      `}
                    >
                      {isSelected && (
                        <svg
                          className="w-3 h-3 text-white"
                          fill="none"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
      </div>

      {tecnologiasSeleccionadasData.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Tecnologías seleccionadas ({tecnologiasSeleccionadasData.length})
          </label>
          <div className="flex flex-wrap gap-2">
            {tecnologiasSeleccionadasData.map((tecnologia) => (
              <div
                key={tecnologia.id}
                className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-100 text-blue-800 rounded-lg"
              >
                <span className="text-sm font-medium">{tecnologia.nombre}</span>
                <button
                  type="button"
                  onClick={() => handleEliminarTecnologia(tecnologia.id)}
                  className="text-blue-600 hover:text-blue-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {tecnologiasSeleccionadas.length === 0 && (
        <p className="text-sm text-gray-500">
          Selecciona al menos una tecnología para este producto.
        </p>
      )}
    </div>
  );
}
