import { useState, useEffect } from 'react';
import { Check, Loader2, AlertCircle } from 'lucide-react';
import { useTecnologias } from '../../../hooks/useTecnologias';
import type { TecnologiaTintasData } from '../../../types/database';

interface TintasPorTecnologiaSelectorProps {
  tecnologiasSeleccionadas: string[];
  tecnologiasTintas: TecnologiaTintasData[];
  onChange: (tecnologiasTintas: TecnologiaTintasData[]) => void;
  errors?: Record<string, string>;
}

interface ColorConfig {
  bgClass: string;
  textClass: string;
  dots?: Array<{ color: string; label: string }>;
}

const COLORES_TINTAS: Record<string, ColorConfig> = {
  'K': {
    bgClass: 'bg-gradient-to-br from-gray-700 to-gray-900',
    textClass: 'text-white',
    dots: [{ color: '#000000', label: 'K' }],
  },
  'CMYK': {
    bgClass: 'bg-gradient-to-br from-cyan-400 via-yellow-300 to-rose-400',
    textClass: 'text-gray-900',
    dots: [
      { color: '#00BCD4', label: 'C' },
      { color: '#E91E63', label: 'M' },
      { color: '#FFEB3B', label: 'Y' },
      { color: '#212121', label: 'K' },
    ],
  },
  'CMYK+W': {
    bgClass: 'bg-gradient-to-br from-cyan-400 via-yellow-300 to-gray-100',
    textClass: 'text-gray-900',
    dots: [
      { color: '#00BCD4', label: 'C' },
      { color: '#E91E63', label: 'M' },
      { color: '#FFEB3B', label: 'Y' },
      { color: '#212121', label: 'K' },
      { color: '#FFFFFF', label: 'W' },
    ],
  },
  'CMYK+V': {
    bgClass: 'bg-gradient-to-br from-cyan-400 via-yellow-300 to-gray-300',
    textClass: 'text-gray-900',
    dots: [
      { color: '#00BCD4', label: 'C' },
      { color: '#E91E63', label: 'M' },
      { color: '#FFEB3B', label: 'Y' },
      { color: '#212121', label: 'K' },
      { color: '#9E9E9E', label: 'V' },
    ],
  },
  'CMYK+W+V': {
    bgClass: 'bg-gradient-to-br from-cyan-400 via-yellow-300 to-rose-300',
    textClass: 'text-gray-900',
    dots: [
      { color: '#00BCD4', label: 'C' },
      { color: '#E91E63', label: 'M' },
      { color: '#FFEB3B', label: 'Y' },
      { color: '#212121', label: 'K' },
      { color: '#FFFFFF', label: 'W' },
      { color: '#9E9E9E', label: 'V' },
    ],
  },
};

export function TintasPorTecnologiaSelector({
  tecnologiasSeleccionadas,
  tecnologiasTintas,
  onChange,
  errors = {},
}: TintasPorTecnologiaSelectorProps) {
  const { tecnologias, loading } = useTecnologias();
  const [tecnologiasData, setTecnologiasData] = useState<any[]>([]);

  useEffect(() => {
    const filtered = tecnologias.filter((tec) =>
      tecnologiasSeleccionadas.includes(tec.id)
    );
    setTecnologiasData(filtered);
  }, [tecnologias, tecnologiasSeleccionadas]);

  const toggleTinta = (tecnologiaId: string, tinta: string) => {
    const existingIndex = tecnologiasTintas.findIndex((tt) => tt.tecnologia_id === tecnologiaId);

    if (existingIndex >= 0) {
      const existing = tecnologiasTintas[existingIndex];
      const newTintas = existing.tintas.includes(tinta)
        ? existing.tintas.filter((t) => t !== tinta)
        : [...existing.tintas, tinta];

      const updated = [...tecnologiasTintas];
      updated[existingIndex] = { tecnologia_id: tecnologiaId, tintas: newTintas };
      onChange(updated);
    } else {
      onChange([...tecnologiasTintas, { tecnologia_id: tecnologiaId, tintas: [tinta] }]);
    }
  };

  const getTintasSeleccionadas = (tecnologiaId: string): string[] => {
    const found = tecnologiasTintas.find((tt) => tt.tecnologia_id === tecnologiaId);
    return found?.tintas || [];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
      </div>
    );
  }

  if (tecnologiasSeleccionadas.length === 0) {
    return (
      <div className="rounded-lg border border-gray-300 bg-gray-50 p-6 text-center">
        <AlertCircle className="w-8 h-8 text-gray-400 mx-auto mb-2" />
        <p className="text-sm text-gray-600">
          Primero selecciona al menos una tecnología de impresión
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Tintas por Tecnología
          <span className="text-red-500 ml-1">*</span>
        </label>
        <p className="text-sm text-gray-500 mb-4">
          Selecciona las tintas disponibles para cada tecnología
        </p>
      </div>

      {tecnologiasData.map((tecnologia) => {
        const tintasSeleccionadas = getTintasSeleccionadas(tecnologia.id);
        const errorKey = tecnologia.id;

        return (
          <div key={tecnologia.id} className="rounded-lg border border-gray-200 p-4 bg-white">
            <h4 className="font-medium text-gray-900 mb-3">{tecnologia.nombre}</h4>

            {tecnologia.tintas && tecnologia.tintas.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {tecnologia.tintas.map((tinta: string) => {
                  const isSelected = tintasSeleccionadas.includes(tinta);
                  const colorConfig = COLORES_TINTAS[tinta] || {
                    bgClass: 'bg-gray-100',
                    textClass: 'text-gray-900',
                    dots: [],
                  };

                  return (
                    <button
                      key={tinta}
                      type="button"
                      onClick={() => toggleTinta(tecnologia.id, tinta)}
                      className={`relative rounded-lg border-2 transition-all duration-200 overflow-hidden ${
                        isSelected
                          ? 'border-blue-600 ring-2 ring-blue-600 shadow-lg'
                          : 'border-gray-300 hover:border-gray-400 hover:shadow-md'
                      }`}
                    >
                      <div className={`relative flex flex-col items-center justify-center p-4 min-h-[100px] ${colorConfig.bgClass}`}>
                        <span className={`text-sm font-bold mb-2 ${colorConfig.textClass} drop-shadow-sm`}>
                          {tinta}
                        </span>

                        {colorConfig.dots && colorConfig.dots.length > 0 && (
                          <div className="flex gap-1.5 mt-1">
                            {colorConfig.dots.map((dot, idx) => (
                              <div
                                key={idx}
                                className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shadow-md border border-gray-400"
                                style={{ backgroundColor: dot.color, color: dot.color === '#FFFFFF' ? '#000' : '#fff' }}
                                title={dot.label}
                              >
                                {dot.label}
                              </div>
                            ))}
                          </div>
                        )}

                        {isSelected && (
                          <div className="absolute top-2 right-2">
                            <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center shadow-lg border-2 border-white">
                              <Check className="w-4 h-4 text-white" />
                            </div>
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-gray-500">
                Esta tecnología no tiene tintas configuradas
              </p>
            )}

            {errors[errorKey] && (
              <p className="text-sm text-red-600 mt-2">{errors[errorKey]}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
