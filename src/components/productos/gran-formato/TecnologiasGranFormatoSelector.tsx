import { useState, useEffect } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { useTecnologias } from '../../../hooks/useTecnologias';

interface TecnologiasGranFormatoSelectorProps {
  tecnologiasSeleccionadas: string[];
  onChange: (tecnologias: string[]) => void;
  error?: string;
}

export function TecnologiasGranFormatoSelector({
  tecnologiasSeleccionadas,
  onChange,
  error,
}: TecnologiasGranFormatoSelectorProps) {
  const { tecnologias, loading } = useTecnologias();
  const [tecnologiasDisponibles, setTecnologiasDisponibles] = useState<any[]>([]);

  useEffect(() => {
    // Filtrar para excluir "Impresión Láser"
    const filtered = tecnologias.filter(
      (tec) => !tec.nombre.toLowerCase().includes('láser') && !tec.nombre.toLowerCase().includes('laser')
    );
    setTecnologiasDisponibles(filtered);
  }, [tecnologias]);

  const toggleTecnologia = (tecnologiaId: string) => {
    if (tecnologiasSeleccionadas.includes(tecnologiaId)) {
      onChange(tecnologiasSeleccionadas.filter((id) => id !== tecnologiaId));
    } else {
      onChange([...tecnologiasSeleccionadas, tecnologiaId]);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-3">
        Tecnologías de Impresión
        <span className="text-red-500 ml-1">*</span>
      </label>
      <p className="text-sm text-gray-500 mb-3">
        Selecciona una o más tecnologías disponibles para este producto
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {tecnologiasDisponibles.map((tecnologia) => {
          const isSelected = tecnologiasSeleccionadas.includes(tecnologia.id);
          return (
            <button
              key={tecnologia.id}
              type="button"
              onClick={() => toggleTecnologia(tecnologia.id)}
              className={`relative rounded-lg border p-4 transition-all duration-200 text-left ${
                isSelected
                  ? 'border-blue-600 bg-blue-50 ring-2 ring-blue-600'
                  : 'border-gray-300 bg-white hover:border-gray-400'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 pr-2">
                  <h4 className={`font-medium ${isSelected ? 'text-blue-900' : 'text-gray-900'}`}>
                    {tecnologia.nombre}
                  </h4>
                  <p className={`text-sm mt-1 ${isSelected ? 'text-blue-700' : 'text-gray-500'}`}>
                    {tecnologia.tintas?.length || 0} tipo{tecnologia.tintas?.length !== 1 ? 's' : ''} de tinta
                  </p>
                </div>
                {isSelected && (
                  <div className="flex-shrink-0">
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
      {tecnologiasDisponibles.length === 0 && !loading && (
        <p className="text-sm text-gray-500 mt-2">
          No hay tecnologías disponibles. Crea tecnologías en el módulo ABM Core.
        </p>
      )}
    </div>
  );
}
