import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../hooks/useAuth';
import { Sparkles } from 'lucide-react';
import { CATEGORIA_IMPRESION_LASER_ID } from '../../../constants/categorias';

interface Acabado {
  id: string;
  nombre: string;
}

interface AcabadosSelectorProps {
  acabadosSeleccionados: string[];
  onChange: (acabados: string[]) => void;
  error?: string;
}

export function AcabadosSelector({
  acabadosSeleccionados,
  onChange,
  error,
}: AcabadosSelectorProps) {
  const [acabados, setAcabados] = useState<Acabado[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user, profile } = useAuth();

  useEffect(() => {
    if (profile?.company_id) {
      cargarAcabados();
    } else if (user && !profile) {
      setIsLoading(true);
    } else {
      setIsLoading(false);
    }
  }, [profile?.company_id, user]);

  const cargarAcabados = async () => {
    try {
      setIsLoading(true);

      const { data: relaciones, error: relError } = await supabase
        .from('acabados_categorias')
        .select('acabado_id')
        .eq('categoria_id', CATEGORIA_IMPRESION_LASER_ID);

      if (relError) {
        console.error('[AcabadosSelector] Error:', relError);
        setAcabados([]);
        return;
      }

      if (!relaciones || relaciones.length === 0) {
        setAcabados([]);
        return;
      }

      const acabadoIds = relaciones.map((r) => r.acabado_id);

      const { data: acabadosData, error: acabError } = await supabase
        .from('acabados')
        .select('id, nombre')
        .eq('company_id', profile?.company_id)
        .eq('is_active', true)
        .in('id', acabadoIds)
        .order('nombre');

      if (acabError) {
        console.error('[AcabadosSelector] Error:', acabError);
        setAcabados([]);
        return;
      }

      setAcabados(acabadosData || []);
    } catch (err) {
      console.error('❌ [AcabadosSelector] Error cargando acabados:', err);
      setAcabados([]);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleAcabado = (acabadoId: string) => {
    if (acabadosSeleccionados.includes(acabadoId)) {
      onChange(acabadosSeleccionados.filter((id) => id !== acabadoId));
    } else {
      onChange([...acabadosSeleccionados, acabadoId]);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        <label className="block text-sm font-medium text-gray-700">Acabados</label>
        <div className="animate-pulse grid grid-cols-2 gap-3">
          <div className="h-20 bg-gray-200 rounded"></div>
          <div className="h-20 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (acabados.length === 0) {
    return (
      <div className="space-y-3">
        <label className="block text-sm font-medium text-gray-700">Acabados</label>
        <div className="text-center py-6 bg-gray-50 rounded-lg border border-gray-200">
          <Sparkles className="w-8 h-8 text-gray-400 mx-auto mb-2" />
          <p className="text-sm text-gray-500">
            No hay acabados disponibles para Impresión Láser
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gray-700">
        Acabados Disponibles
      </label>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {acabados.map((acabado) => {
          const isSelected = acabadosSeleccionados.includes(acabado.id);
          return (
            <button
              key={acabado.id}
              type="button"
              onClick={() => toggleAcabado(acabado.id)}
              className={`relative p-3 rounded-lg border-2 transition-all text-left ${
                isSelected
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <div className="flex items-start gap-2">
                <div
                  className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                    isSelected
                      ? 'bg-blue-500 border-blue-500'
                      : 'bg-white border-gray-300'
                  }`}
                >
                  {isSelected && (
                    <svg
                      className="w-3 h-3 text-white"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">
                    {acabado.nombre}
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {acabadosSeleccionados.length > 0 && (
        <p className="text-xs text-gray-500">
          {acabadosSeleccionados.length} acabado{acabadosSeleccionados.length !== 1 ? 's' : ''}{' '}
          seleccionado{acabadosSeleccionados.length !== 1 ? 's' : ''}
        </p>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
