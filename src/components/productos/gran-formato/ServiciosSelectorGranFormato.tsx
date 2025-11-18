import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../hooks/useAuth';
import { Wrench, ChevronDown, ChevronUp } from 'lucide-react';
import { CATEGORIA_GRAN_FORMATO_ID } from '../../../constants/categorias';

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

interface ServiciosSelectorGranFormatoProps {
  serviciosSeleccionados: string[];
  onChange: (servicios: string[]) => void;
  error?: string;
}

export function ServiciosSelectorGranFormato({
  serviciosSeleccionados,
  onChange,
  error,
}: ServiciosSelectorGranFormatoProps) {
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
        .eq('categoria_id', CATEGORIA_GRAN_FORMATO_ID);

      if (relError) {
        console.error('[ServiciosSelectorGranFormato] Error:', relError);
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
        console.error('[ServiciosSelectorGranFormato] Error:', servError);
        setServicios([]);
        return;
      }

      const serviciosConNiveles = await Promise.all(
        (serviciosData || []).map(async (servicio) => {
          if (servicio.tiene_niveles_precio) {
            const { data: niveles, error: nivelesError } = await supabase
              .from('servicios_niveles_precio')
              .select('id, nombre, tipo_impacto, valor_impacto, orden')
              .eq('servicio_id', servicio.id)
              .order('orden');

            if (nivelesError) {
              console.error('[ServiciosSelectorGranFormato] Error cargando niveles:', nivelesError);
              return { ...servicio, niveles: [] };
            }

            return { ...servicio, niveles: niveles || [] };
          }
          return servicio;
        })
      );

      setServicios(serviciosConNiveles);
    } catch (err) {
      console.error('❌ [ServiciosSelectorGranFormato] Error cargando servicios:', err);
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
      <div className="space-y-3">
        <label className="block text-sm font-medium text-gray-700">Servicios</label>
        <div className="animate-pulse grid grid-cols-2 gap-3">
          <div className="h-20 bg-gray-200 rounded"></div>
          <div className="h-20 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (servicios.length === 0) {
    return (
      <div className="space-y-3">
        <label className="block text-sm font-medium text-gray-700">Servicios</label>
        <div className="text-center py-6 bg-gray-50 rounded-lg border border-gray-200">
          <Wrench className="w-8 h-8 text-gray-400 mx-auto mb-2" />
          <p className="text-sm text-gray-500">
            No hay servicios disponibles para Gran Formato
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gray-700">
        Servicios Disponibles
      </label>

      <div className="space-y-3">
        {servicios.map((servicio) => {
          const isSelected = serviciosSeleccionados.includes(servicio.id);
          const isExpanded = expandedServicios.has(servicio.id);
          const tieneNiveles = servicio.tiene_niveles_precio && servicio.niveles && servicio.niveles.length > 0;

          return (
            <div key={servicio.id} className="space-y-2">
              <div
                className={`relative p-3 rounded-lg border-2 transition-all ${
                  isSelected
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <div className="flex items-start gap-2">
                  <button
                    type="button"
                    onClick={() => toggleServicio(servicio.id)}
                    className="flex items-start gap-2 flex-1 text-left"
                  >
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
                        {servicio.nombre}
                      </p>
                      {tieneNiveles && (
                        <p className="text-xs text-gray-500 mt-0.5">
                          {servicio.niveles.length} niveles de precio disponibles
                        </p>
                      )}
                    </div>
                  </button>

                  {tieneNiveles && (
                    <button
                      type="button"
                      onClick={() => toggleExpanded(servicio.id)}
                      className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </button>
                  )}
                </div>

                {tieneNiveles && isExpanded && (
                  <div className="mt-3 pt-3 border-t border-gray-200 space-y-2">
                    <p className="text-xs font-medium text-gray-700 mb-2">Niveles disponibles:</p>
                    {servicio.niveles.map((nivel) => (
                      <div
                        key={nivel.id}
                        className="flex items-center justify-between text-xs bg-gray-50 rounded p-2"
                      >
                        <span className="font-medium text-gray-700">{nivel.nombre}</span>
                        <span className="text-gray-500">
                          {nivel.tipo_impacto === 'precio_fijo' && `$${nivel.valor_impacto}`}
                          {nivel.tipo_impacto === 'porcentual' && `${nivel.valor_impacto}%`}
                          {nivel.tipo_impacto === 'por_unidad' && `$${nivel.valor_impacto}/u`}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {serviciosSeleccionados.length > 0 && (
        <p className="text-xs text-gray-500">
          {serviciosSeleccionados.length} servicio{serviciosSeleccionados.length !== 1 ? 's' : ''}{' '}
          seleccionado{serviciosSeleccionados.length !== 1 ? 's' : ''}
        </p>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
