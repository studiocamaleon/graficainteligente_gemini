import { useState, useEffect } from 'react';
import { Sparkles, ChevronDown } from 'lucide-react';
import { Card } from '../../ui/Card';
import { supabase } from '../../../lib/supabase';

interface Acabado {
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

interface FinishingsStepProps {
  categoriaNombre: string;
  acabadosSeleccionados: Array<{
    acabado_id: string;
    nivel_id: string | null;
  }>;
  onToggleAcabado: (acabadoId: string) => void;
  onSelectNivel: (acabadoId: string, nivelId: string) => void;
  precioBase: number | null;
}

export function FinishingsStep({
  categoriaNombre,
  acabadosSeleccionados,
  onToggleAcabado,
  onSelectNivel,
  precioBase,
}: FinishingsStepProps) {
  const [acabados, setAcabados] = useState<Acabado[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadAcabados();
  }, [categoriaNombre]);

  const loadAcabados = async () => {
    setIsLoading(true);
    try {
      const { data: categoriasData } = await supabase
        .from('categorias')
        .select('id')
        .eq('nombre', categoriaNombre)
        .maybeSingle();

      if (!categoriasData) {
        setAcabados([]);
        return;
      }

      const { data: acabadosData } = await supabase
        .from('acabados')
        .select(`
          id,
          nombre,
          descripcion,
          categorias_acabados!inner(categoria_id),
          acabados_niveles(
            id,
            nombre,
            tipo_impacto,
            valor_porcentaje,
            valor_monto,
            orden
          )
        `)
        .eq('activo', true)
        .eq('categorias_acabados.categoria_id', categoriasData.id)
        .order('nombre');

      if (acabadosData) {
        const mapped = acabadosData.map(a => {
          const niveles = (a.acabados_niveles || []).sort((a: any, b: any) => a.orden - b.orden);
          const tipoImpacto = niveles.length > 0 ? niveles[0].tipo_impacto : 'porcentaje';

          return {
            id: a.id,
            nombre: a.nombre,
            descripcion: a.descripcion,
            tipo_impacto: tipoImpacto,
            niveles: niveles.map((n: any) => ({
              id: n.id,
              nombre: n.nombre,
              valor_porcentaje: n.valor_porcentaje,
              valor_monto: n.valor_monto,
            })),
          };
        });
        setAcabados(mapped);
      }
    } catch (error) {
      console.error('Error loading acabados:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const isAcabadoSelected = (acabadoId: string) => {
    return acabadosSeleccionados.some(a => a.acabado_id === acabadoId);
  };

  const getNivelSeleccionado = (acabadoId: string) => {
    const seleccionado = acabadosSeleccionados.find(a => a.acabado_id === acabadoId);
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
        <p className="mt-2 text-gray-600">Cargando acabados...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Acabados</h2>
        <p className="text-gray-600">
          Seleccione acabados finales (opcional)
        </p>
      </div>

      {acabados.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <Sparkles className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600">No hay acabados disponibles para esta categoría</p>
        </div>
      ) : (
        <div className="space-y-4">
          {acabados.map((acabado) => {
            const isSelected = isAcabadoSelected(acabado.id);
            const nivelSeleccionado = getNivelSeleccionado(acabado.id);

            return (
              <Card
                key={acabado.id}
                className={`p-4 transition-all ${
                  isSelected ? 'ring-2 ring-blue-600 bg-blue-50' : ''
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onToggleAcabado(acabado.id)}
                    className="mt-1 w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">{acabado.nombre}</h3>
                    {acabado.descripcion && (
                      <p className="text-sm text-gray-600 mt-1">{acabado.descripcion}</p>
                    )}

                    {isSelected && acabado.niveles.length > 0 && (
                      <div className="mt-3">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Seleccione nivel:
                        </label>
                        <div className="relative">
                          <select
                            value={nivelSeleccionado || ''}
                            onChange={(e) => onSelectNivel(acabado.id, e.target.value)}
                            className="block w-full pl-3 pr-10 py-2 text-base border border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 rounded-md"
                          >
                            <option value="">-- Seleccione un nivel --</option>
                            {acabado.niveles.map((nivel) => {
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
