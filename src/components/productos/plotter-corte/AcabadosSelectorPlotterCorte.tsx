import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../hooks/useAuth';
import { Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import { CATEGORIA_PLOTTER_CORTE_ID } from '../../../constants/categorias';

interface NivelPrecio {
  id: string;
  nombre: string;
  tipo_impacto: string;
  valor_impacto: number;
  orden: number;
}

interface Acabado {
  id: string;
  nombre: string;
  tiene_niveles_precio: boolean;
  niveles?: NivelPrecio[];
}

interface AcabadosSelectorPlotterCorteProps {
  acabadosSeleccionados: string[];
  onChange: (acabados: string[]) => void;
  error?: string;
}

export function AcabadosSelectorPlotterCorte({
  acabadosSeleccionados,
  onChange,
  error,
}: AcabadosSelectorPlotterCorteProps) {
  const [acabados, setAcabados] = useState<Acabado[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedAcabados, setExpandedAcabados] = useState<Set<string>>(new Set());
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
        .eq('categoria_id', CATEGORIA_PLOTTER_CORTE_ID);

      if (relError) {
        console.error('[AcabadosSelectorPlotterCorte] Error:', relError);
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
        .select('id, nombre, tiene_niveles_precio')
        .eq('company_id', profile?.company_id)
        .eq('is_active', true)
        .in('id', acabadoIds)
        .order('nombre');

      if (acabError) {
        console.error('[AcabadosSelectorPlotterCorte] Error:', acabError);
        setAcabados([]);
        return;
      }

      const acabadosConNiveles = await Promise.all(
        (acabadosData || []).map(async (acabado) => {
          if (acabado.tiene_niveles_precio) {
            const { data: niveles } = await supabase
              .from('acabado_niveles_precio')
              .select('*')
              .eq('acabado_id', acabado.id)
              .order('orden');

            return { ...acabado, niveles: niveles || [] };
          }
          return acabado;
        })
      );

      setAcabados(acabadosConNiveles);
    } catch (err) {
      console.error('[AcabadosSelectorPlotterCorte] Error:', err);
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

  const toggleExpanded = (acabadoId: string) => {
    const newExpanded = new Set(expandedAcabados);
    if (newExpanded.has(acabadoId)) {
      newExpanded.delete(acabadoId);
    } else {
      newExpanded.add(acabadoId);
    }
    setExpandedAcabados(newExpanded);
  };

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-2">
        <div className="h-10 bg-gray-200 rounded"></div>
        <div className="h-10 bg-gray-200 rounded"></div>
      </div>
    );
  }

  if (acabados.length === 0) {
    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            Acabados Disponibles
          </div>
        </label>
        <p className="text-sm text-gray-500 italic">
          No hay acabados disponibles para esta categoría. Puedes crear acabados en el módulo ABM Core.
        </p>
      </div>
    );
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4" />
          Acabados Disponibles
        </div>
      </label>
      <p className="text-sm text-gray-500 mb-3">
        Selecciona los acabados que estarán disponibles para este producto
      </p>
      <div className="space-y-2">
        {acabados.map((acabado) => {
          const isSelected = acabadosSeleccionados.includes(acabado.id);
          const isExpanded = expandedAcabados.has(acabado.id);

          return (
            <div key={acabado.id} className="border border-gray-200 rounded-lg">
              <div className="flex items-center gap-3 p-3">
                <input
                  type="checkbox"
                  id={`acabado-${acabado.id}`}
                  checked={isSelected}
                  onChange={() => toggleAcabado(acabado.id)}
                  className="w-4 h-4 text-pink-600 border-gray-300 rounded focus:ring-pink-500"
                />
                <label
                  htmlFor={`acabado-${acabado.id}`}
                  className="flex-1 text-sm font-medium text-gray-700 cursor-pointer"
                >
                  {acabado.nombre}
                </label>
                {acabado.tiene_niveles_precio && acabado.niveles && acabado.niveles.length > 0 && (
                  <button
                    type="button"
                    onClick={() => toggleExpanded(acabado.id)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </button>
                )}
              </div>
              {acabado.tiene_niveles_precio &&
                acabado.niveles &&
                acabado.niveles.length > 0 &&
                isExpanded && (
                  <div className="border-t border-gray-200 p-3 bg-gray-50">
                    <p className="text-xs font-medium text-gray-500 mb-2">Niveles de Precio:</p>
                    <div className="space-y-1">
                      {acabado.niveles.map((nivel) => (
                        <div key={nivel.id} className="text-xs text-gray-600 flex justify-between">
                          <span>{nivel.nombre}</span>
                          <span className="font-medium">
                            {nivel.tipo_impacto === 'porcentaje'
                              ? `${nivel.valor_impacto}%`
                              : nivel.tipo_impacto === 'fijo'
                              ? `$${nivel.valor_impacto}`
                              : nivel.tipo_impacto === 'multiplicador'
                              ? `x${nivel.valor_impacto}`
                              : nivel.tipo_impacto === 'precio_mt2'
                              ? `$${nivel.valor_impacto}/m²`
                              : nivel.tipo_impacto === 'precio_mt_lineal'
                              ? `$${nivel.valor_impacto}/m`
                              : nivel.tipo_impacto === 'precio_unidad'
                              ? `$${nivel.valor_impacto}/ud`
                              : `${nivel.valor_impacto}`}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
            </div>
          );
        })}
      </div>
      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
    </div>
  );
}
