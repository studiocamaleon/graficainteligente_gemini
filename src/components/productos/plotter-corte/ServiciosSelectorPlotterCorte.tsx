import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../hooks/useAuth';
import { Wrench, ChevronDown, ChevronUp } from 'lucide-react';
import { CATEGORIA_PLOTTER_CORTE_ID } from '../../../constants/categorias';

interface NivelPrecio {
  id: string;
  nombre: string;
  tipo_impacto: string;
  valor_impacto: number;
  orden: number;
}

interface Servicio {
  id: string;
  nombre: string;
  tiene_niveles_precio: boolean;
  niveles?: NivelPrecio[];
}

interface ServiciosSelectorPlotterCorteProps {
  serviciosSeleccionados: string[];
  onChange: (servicios: string[]) => void;
  error?: string;
}

export function ServiciosSelectorPlotterCorte({
  serviciosSeleccionados,
  onChange,
  error,
}: ServiciosSelectorPlotterCorteProps) {
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedServicios, setExpandedServicios] = useState<Set<string>>(new Set());
  const { user, profile } = useAuth();

  useEffect(() => {
    if (profile?.company_id) {
      cargarServicios();
    } else if (user && !profile) {
      setIsLoading(true);
    } else {
      setIsLoading(false);
    }
  }, [profile?.company_id, user]);

  const cargarServicios = async () => {
    try {
      setIsLoading(true);

      const { data: relaciones, error: relError } = await supabase
        .from('servicios_categorias')
        .select('servicio_id')
        .eq('categoria_id', CATEGORIA_PLOTTER_CORTE_ID);

      if (relError) {
        console.error('[ServiciosSelectorPlotterCorte] Error:', relError);
        setServicios([]);
        return;
      }

      if (!relaciones || relaciones.length === 0) {
        setServicios([]);
        return;
      }

      const servicioIds = relaciones.map((r) => r.servicio_id);

      const { data: serviciosData, error: servError } = await supabase
        .from('servicios')
        .select('id, nombre, tiene_niveles_precio')
        .eq('company_id', profile?.company_id)
        .eq('is_active', true)
        .in('id', servicioIds)
        .order('nombre');

      if (servError) {
        console.error('[ServiciosSelectorPlotterCorte] Error:', servError);
        setServicios([]);
        return;
      }

      const serviciosConNiveles = await Promise.all(
        (serviciosData || []).map(async (servicio) => {
          if (servicio.tiene_niveles_precio) {
            const { data: niveles } = await supabase
              .from('servicio_niveles_precio')
              .select('*')
              .eq('servicio_id', servicio.id)
              .order('orden');

            return { ...servicio, niveles: niveles || [] };
          }
          return servicio;
        })
      );

      setServicios(serviciosConNiveles);
    } catch (err) {
      console.error('[ServiciosSelectorPlotterCorte] Error:', err);
      setServicios([]);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleServicio = (servicioId: string) => {
    if (serviciosSeleccionados.includes(servicioId)) {
      onChange(serviciosSeleccionados.filter((id) => id !== servicioId));
    } else {
      onChange([...serviciosSeleccionados, servicioId]);
    }
  };

  const toggleExpanded = (servicioId: string) => {
    const newExpanded = new Set(expandedServicios);
    if (newExpanded.has(servicioId)) {
      newExpanded.delete(servicioId);
    } else {
      newExpanded.add(servicioId);
    }
    setExpandedServicios(newExpanded);
  };

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-2">
        <div className="h-10 bg-gray-200 rounded"></div>
        <div className="h-10 bg-gray-200 rounded"></div>
      </div>
    );
  }

  if (servicios.length === 0) {
    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          <div className="flex items-center gap-2">
            <Wrench className="w-4 h-4" />
            Servicios Disponibles
          </div>
        </label>
        <p className="text-sm text-gray-500 italic">
          No hay servicios disponibles para esta categoría. Puedes crear servicios en el módulo ABM Core.
        </p>
      </div>
    );
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-3">
        <div className="flex items-center gap-2">
          <Wrench className="w-4 h-4" />
          Servicios Disponibles
        </div>
      </label>
      <p className="text-sm text-gray-500 mb-3">
        Selecciona los servicios que estarán disponibles para este producto
      </p>
      <div className="space-y-2">
        {servicios.map((servicio) => {
          const isSelected = serviciosSeleccionados.includes(servicio.id);
          const isExpanded = expandedServicios.has(servicio.id);

          return (
            <div key={servicio.id} className="border border-gray-200 rounded-lg">
              <div className="flex items-center gap-3 p-3">
                <input
                  type="checkbox"
                  id={`servicio-${servicio.id}`}
                  checked={isSelected}
                  onChange={() => toggleServicio(servicio.id)}
                  className="w-4 h-4 text-pink-600 border-gray-300 rounded focus:ring-pink-500"
                />
                <label
                  htmlFor={`servicio-${servicio.id}`}
                  className="flex-1 text-sm font-medium text-gray-700 cursor-pointer"
                >
                  {servicio.nombre}
                </label>
                {servicio.tiene_niveles_precio && servicio.niveles && servicio.niveles.length > 0 && (
                  <button
                    type="button"
                    onClick={() => toggleExpanded(servicio.id)}
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
              {servicio.tiene_niveles_precio &&
                servicio.niveles &&
                servicio.niveles.length > 0 &&
                isExpanded && (
                  <div className="border-t border-gray-200 p-3 bg-gray-50">
                    <p className="text-xs font-medium text-gray-500 mb-2">Niveles de Precio:</p>
                    <div className="space-y-1">
                      {servicio.niveles.map((nivel) => (
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
