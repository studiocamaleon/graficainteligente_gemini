import { useState, useEffect } from 'react';
import { Wrench, ChevronDown } from 'lucide-react';
import { Card } from '../../ui/Card';
import { supabase } from '../../../lib/supabase';

interface Servicio {
  id: string;
  nombre: string;
  descripcion: string | null;
  tipo_impacto: 'porcentaje' | 'monto_fijo' | 'ambos';
  niveles: {
    id: string;
    nombre: string;
    valor_porcentaje: number | null;
    valor_monto: number | null;
  }[];
}

interface ServicesStepProps {
  categoriaNombre: string;
  serviciosSeleccionados: Array<{
    servicio_id: string;
    nivel_id: string | null;
  }>;
  onToggleServicio: (servicioId: string) => void;
  onSelectNivel: (servicioId: string, nivelId: string) => void;
  precioBase: number | null;
}

export function ServicesStep({
  categoriaNombre,
  serviciosSeleccionados,
  onToggleServicio,
  onSelectNivel,
  precioBase,
}: ServicesStepProps) {
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadServicios();
  }, [categoriaNombre]);

  const loadServicios = async () => {
    setIsLoading(true);
    try {
      const { data: categoriasData } = await supabase
        .from('categorias')
        .select('id')
        .eq('nombre', categoriaNombre)
        .maybeSingle();

      if (!categoriasData) {
        setServicios([]);
        return;
      }

      const { data: serviciosData } = await supabase
        .from('servicios')
        .select(`
          id,
          nombre,
          descripcion,
          categorias_servicios!inner(categoria_id),
          servicios_niveles(
            id,
            nombre,
            tipo_impacto,
            valor_porcentaje,
            valor_monto,
            orden
          )
        `)
        .eq('activo', true)
        .eq('categorias_servicios.categoria_id', categoriasData.id)
        .order('nombre');

      if (serviciosData) {
        const mapped = serviciosData.map(s => {
          const niveles = (s.servicios_niveles || []).sort((a: any, b: any) => a.orden - b.orden);
          const tipoImpacto = niveles.length > 0 ? niveles[0].tipo_impacto : 'porcentaje';

          return {
            id: s.id,
            nombre: s.nombre,
            descripcion: s.descripcion,
            tipo_impacto: tipoImpacto,
            niveles: niveles.map((n: any) => ({
              id: n.id,
              nombre: n.nombre,
              valor_porcentaje: n.valor_porcentaje,
              valor_monto: n.valor_monto,
            })),
          };
        });
        setServicios(mapped);
      }
    } catch (error) {
      console.error('Error loading servicios:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const isServicioSelected = (servicioId: string) => {
    return serviciosSeleccionados.some(s => s.servicio_id === servicioId);
  };

  const getNivelSeleccionado = (servicioId: string) => {
    const seleccionado = serviciosSeleccionados.find(s => s.servicio_id === servicioId);
    return seleccionado?.nivel_id || null;
  };

  const calcularImpacto = (nivel: any) => {
    if (!precioBase) return null;

    let impacto = 0;
    if (nivel.valor_porcentaje !== null) {
      impacto += precioBase * (nivel.valor_porcentaje / 100);
    }
    if (nivel.valor_monto !== null) {
      impacto += nivel.valor_monto;
    }
    return impacto;
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
    }).format(value);
  };

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-gray-200 border-t-blue-600" />
        <p className="mt-2 text-gray-600">Cargando servicios...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Servicios</h2>
        <p className="text-gray-600">
          Seleccione servicios adicionales (opcional)
        </p>
      </div>

      {servicios.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <Wrench className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600">No hay servicios disponibles para esta categoría</p>
        </div>
      ) : (
        <div className="space-y-4">
          {servicios.map((servicio) => {
            const isSelected = isServicioSelected(servicio.id);
            const nivelSeleccionado = getNivelSeleccionado(servicio.id);

            return (
              <Card
                key={servicio.id}
                className={`p-4 transition-all ${
                  isSelected ? 'ring-2 ring-blue-600 bg-blue-50' : ''
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onToggleServicio(servicio.id)}
                    className="mt-1 w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">{servicio.nombre}</h3>
                    {servicio.descripcion && (
                      <p className="text-sm text-gray-600 mt-1">{servicio.descripcion}</p>
                    )}

                    {isSelected && servicio.niveles.length > 0 && (
                      <div className="mt-3">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Seleccione nivel:
                        </label>
                        <div className="relative">
                          <select
                            value={nivelSeleccionado || ''}
                            onChange={(e) => onSelectNivel(servicio.id, e.target.value)}
                            className="block w-full pl-3 pr-10 py-2 text-base border border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 rounded-md"
                          >
                            <option value="">-- Seleccione un nivel --</option>
                            {servicio.niveles.map((nivel) => {
                              const impacto = calcularImpacto(nivel);
                              return (
                                <option key={nivel.id} value={nivel.id}>
                                  {nivel.nombre}
                                  {impacto !== null && ` (+${formatCurrency(impacto)})`}
                                </option>
                              );
                            })}
                          </select>
                          <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
