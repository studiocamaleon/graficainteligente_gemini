import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export interface GeneratedStep {
  id: string;
  etapa: string;
  paso_id: string | null;
  paso_nombre: string;
  orden: number;
  es_obligatorio: boolean;
  razon_inclusion: string;
}

interface UseGenerateProductionRouteProps {
  productoId: string;
  categoria: string;
  configuracion: any;
}

export function useGenerateProductionRoute({
  productoId,
  categoria,
  configuracion,
}: UseGenerateProductionRouteProps) {
  const [steps, setSteps] = useState<GeneratedStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function generateRoute() {
      try {
        setLoading(true);
        setError(null);

        // 1. Obtener ruta_produccion_id del producto según categoría
        let rutaId: string | null = null;

        switch (categoria) {
          case 'Impresion Laser': {
            const { data } = await supabase
              .from('productos_impresion_laser')
              .select('ruta_produccion_id')
              .eq('id', productoId)
              .maybeSingle();
            rutaId = data?.ruta_produccion_id || null;
            break;
          }
          case 'Gran Formato': {
            const { data } = await supabase
              .from('productos_gran_formato')
              .select('ruta_produccion_id')
              .eq('id', productoId)
              .maybeSingle();
            rutaId = data?.ruta_produccion_id || null;
            break;
          }
          case 'Materiales Rigidos': {
            const { data } = await supabase
              .from('productos_materiales_rigidos')
              .select('ruta_produccion_id')
              .eq('id', productoId)
              .maybeSingle();
            rutaId = data?.ruta_produccion_id || null;
            break;
          }
          case 'Plotter de Corte': {
            const { data } = await supabase
              .from('productos_plotter_corte')
              .select('ruta_produccion_id')
              .eq('id', productoId)
              .maybeSingle();
            rutaId = data?.ruta_produccion_id || null;
            break;
          }
          case 'Portabanners': {
            const { data } = await supabase
              .from('productos_portabanners')
              .select('ruta_produccion_id')
              .eq('id', productoId)
              .maybeSingle();
            rutaId = data?.ruta_produccion_id || null;
            break;
          }
          case 'Sellos': {
            const { data } = await supabase
              .from('productos_sellos')
              .select('ruta_produccion_id')
              .eq('id', productoId)
              .maybeSingle();
            rutaId = data?.ruta_produccion_id || null;
            break;
          }
        }

        if (!rutaId) {
          setSteps([]);
          setLoading(false);
          return;
        }

        // 2. Obtener pasos de la ruta
        const { data: pasos, error: pasosError } = await supabase
          .from('rutas_produccion_pasos')
          .select(`
            id,
            etapa,
            paso_id,
            orden,
            es_obligatorio,
            tipo_condicion,
            configuracion_condicion,
            pasos (
              nombre
            )
          `)
          .eq('ruta_id', rutaId)
          .order('etapa')
          .order('orden');

        if (pasosError) throw pasosError;
        if (!pasos || pasos.length === 0) {
          setSteps([]);
          setLoading(false);
          return;
        }

        // 3. Evaluar cada paso según condiciones
        const generatedSteps: GeneratedStep[] = [];

        // Extraer servicios y acabados con compatibilidad
        const servicios = configuracion?.servicios_seleccionados || configuracion?.servicios || [];
        const acabados = configuracion?.acabados_seleccionados || configuracion?.acabados || [];

        for (const paso of pasos) {
          let incluir = false;
          let razon = '';

          // Si es obligatorio, siempre incluir
          if (paso.es_obligatorio) {
            incluir = true;
            razon = 'Paso obligatorio';
          } else {
            // Evaluar condición
            switch (paso.tipo_condicion) {
              case 'sin_condicion':
                incluir = true;
                razon = 'Sin condición';
                break;

              case 'servicio_sin_nivel': {
                const tieneServicio = servicios.some(
                  (s: any) => s.servicio_id === paso.configuracion_condicion?.servicio_id
                );
                incluir = tieneServicio;
                razon = tieneServicio ? 'Servicio aplicado' : 'Servicio no aplicado';
                break;
              }

              case 'servicio_con_nivel': {
                const tieneServicioConNivel = servicios.some((s: any) => {
                  if (s.servicio_id !== paso.configuracion_condicion?.servicio_id) {
                    return false;
                  }
                  // Verificar si el nivel coincide con el mapeo
                  const mapeoNiveles = paso.configuracion_condicion?.mapeo_niveles || {};
                  if (Object.keys(mapeoNiveles).length === 0) {
                    return true; // Sin mapeo específico, cualquier nivel vale
                  }
                  const nivelItem = s.nivel || s.nivel_nombre;
                  return Object.keys(mapeoNiveles).includes(nivelItem);
                });
                incluir = tieneServicioConNivel;
                razon = tieneServicioConNivel ? 'Servicio con nivel aplicado' : 'Servicio con nivel no aplicado';
                break;
              }

              case 'acabado_sin_nivel': {
                const tieneAcabado = acabados.some(
                  (a: any) => a.acabado_id === paso.configuracion_condicion?.acabado_id
                );
                incluir = tieneAcabado;
                razon = tieneAcabado ? 'Acabado aplicado' : 'Acabado no aplicado';
                break;
              }

              case 'acabado_con_nivel': {
                const tieneAcabadoConNivel = acabados.some((a: any) => {
                  if (a.acabado_id !== paso.configuracion_condicion?.acabado_id) {
                    return false;
                  }
                  // Verificar si el nivel coincide con el mapeo
                  const mapeoNiveles = paso.configuracion_condicion?.mapeo_niveles || {};
                  if (Object.keys(mapeoNiveles).length === 0) {
                    return true; // Sin mapeo específico, cualquier nivel vale
                  }
                  const nivelItem = a.nivel || a.nivel_nombre;
                  return Object.keys(mapeoNiveles).includes(nivelItem);
                });
                incluir = tieneAcabadoConNivel;
                razon = tieneAcabadoConNivel ? 'Acabado con nivel aplicado' : 'Acabado con nivel no aplicado';
                break;
              }

              case 'tecnologia_tinta':
                incluir = paso.configuracion_condicion?.tecnologia_id !== null;
                razon = 'Tecnología configurada';
                break;

              default:
                incluir = false;
                razon = 'Condición no evaluada';
            }
          }

          // Solo incluir si cumple condiciones
          if (incluir) {
            generatedSteps.push({
              id: `temp-${paso.id}`,
              etapa: paso.etapa,
              paso_id: paso.paso_id,
              paso_nombre: (paso.pasos as any)?.nombre || 'Paso sin nombre',
              orden: paso.orden,
              es_obligatorio: paso.es_obligatorio,
              razon_inclusion: razon,
            });
          }
        }

        setSteps(generatedSteps);
      } catch (err) {
        console.error('Error generando ruta:', err);
        setError(err instanceof Error ? err.message : 'Error desconocido');
        setSteps([]);
      } finally {
        setLoading(false);
      }
    }

    if (productoId && categoria) {
      generateRoute();
    } else {
      setSteps([]);
      setLoading(false);
    }
  }, [productoId, categoria, JSON.stringify(configuracion)]);

  return { steps, loading, error };
}
