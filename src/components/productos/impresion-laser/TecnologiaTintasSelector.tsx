import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../hooks/useAuth';
import { TECNOLOGIA_IMPRESION_LASER_ID } from '../../../constants/tecnologias';

interface TecnologiaTintasSelectorProps {
  tintasSeleccionadas: string[];
  onTintasChange: (tintas: string[]) => void;
  onTecnologiaChange: (tecnologiaId: string) => void;
  error?: string;
}

export function TecnologiaTintasSelector({
  tintasSeleccionadas,
  onTintasChange,
  onTecnologiaChange,
  error,
}: TecnologiaTintasSelectorProps) {
  const [tintas, setTintas] = useState<string[]>([]);
  const [tecnologiaId, setTecnologiaId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const { user, profile } = useAuth();

  useEffect(() => {
    if (profile?.company_id) {
      cargarTecnologiaYTintas();
    } else if (user && !profile) {
      setIsLoading(true);
    } else {
      setIsLoading(false);
    }
  }, [profile?.company_id, user]);

  const cargarTecnologiaYTintas = async () => {
    try {
      setIsLoading(true);

      const { data: tecnologiaData, error } = await supabase
        .from('tecnologias')
        .select('id, tintas')
        .eq('id', TECNOLOGIA_IMPRESION_LASER_ID)
        .eq('company_id', profile?.company_id)
        .eq('is_active', true)
        .maybeSingle();

      if (error) {
        console.error('[TecnologiaTintasSelector] Error:', error);
        setTintas([]);
        return;
      }

      if (!tecnologiaData) {
        setTintas([]);
        return;
      }

      setTecnologiaId(tecnologiaData.id);
      onTecnologiaChange(tecnologiaData.id);
      setTintas(tecnologiaData.tintas || []);
    } catch (err) {
      console.error('❌ [TecnologiaTintasSelector] Error cargando tecnología y tintas:', err);
      setTintas([]);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleTinta = (tinta: string) => {
    if (tintasSeleccionadas.includes(tinta)) {
      onTintasChange(tintasSeleccionadas.filter((t) => t !== tinta));
    } else {
      onTintasChange([...tintasSeleccionadas, tinta]);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        <label className="block text-sm font-medium text-gray-700">
          Tecnología y Tintas
        </label>
        <div className="animate-pulse space-y-2">
          <div className="h-20 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (tintas.length === 0) {
    return (
      <div className="space-y-3">
        <label className="block text-sm font-medium text-gray-700">
          Tecnología y Tintas
        </label>
        <div className="text-center py-6 bg-yellow-50 rounded-lg border border-yellow-200">
          <p className="text-sm text-yellow-800">
            No se encontraron tintas configuradas para Impresión Láser
          </p>
          <p className="text-xs text-yellow-600 mt-1">
            Configura las tintas en el módulo de Tecnologías primero
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gray-700">
        Tecnología y Tintas
        <span className="text-red-500 ml-1">*</span>
      </label>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {tintas.map((tinta) => {
          const isSelected = tintasSeleccionadas.includes(tinta);
          return (
            <button
              key={tinta}
              type="button"
              onClick={() => toggleTinta(tinta)}
              className={`relative p-3 rounded-lg border-2 transition-all ${
                isSelected
                  ? 'border-blue-500 bg-blue-50 shadow-sm'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <div className="flex items-center justify-center">
                <p className="text-sm font-medium text-gray-900">{tinta}</p>
              </div>
              {isSelected && (
                <div className="absolute top-2 right-2 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {tintasSeleccionadas.length > 0 && (
        <p className="text-xs text-gray-500">
          {tintasSeleccionadas.length} tinta{tintasSeleccionadas.length !== 1 ? 's' : ''}{' '}
          seleccionada{tintasSeleccionadas.length !== 1 ? 's' : ''}
        </p>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
