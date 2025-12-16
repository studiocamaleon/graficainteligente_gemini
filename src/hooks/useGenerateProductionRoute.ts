import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { normalizarEtapa } from '../utils/generateProductionRoutes';

export interface GeneratedStep {
  id: string;
  etapa: string;
  paso_id: string | null;
  paso_nombre: string;
  orden: number;
  es_obligatorio: boolean;
  razon_inclusion: string;
  nivel_aplicado?: string;
  servicio_nombre?: string;
  acabado_nombre?: string;
  comentario_vendedor?: string | null;
  origen_plantilla_id?: string | null;
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
      // Si no hay productoId o categoria, no hacer nada (optimización)
      if (!productoId || !categoria) {
        setSteps([]);
        setLoading(false);
        return;
      }

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

        // 3. Evaluar cada paso según condiciones y extraer paso_id específico
        const generatedSteps: Array<{
          id: string;
          etapa: string;
          paso_id_especifico: string | null;
          orden: number;
          es_obligatorio: boolean;
          razon_inclusion: string;
          nivel_aplicado?: string;
          servicio_nombre?: string;
          acabado_nombre?: string;
        }> = [];

        // Extraer servicios y acabados con compatibilidad
        const servicios = configuracion?.servicios_seleccionados || configuracion?.servicios || [];
        const acabados = configuracion?.acabados_seleccionados || configuracion?.acabados || [];

        for (const paso of pasos) {
          let incluir = false;
          let razon = '';
          let pasoIdEspecifico: string | null = paso.paso_id;
          let nivelAplicado: string | undefined;
          let servicioNombre: string | undefined;
          let acabadoNombre: string | undefined;

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
                const servicio = servicios.find(
                  (s: any) => s.servicio_id === paso.configuracion_condicion?.servicio_id
                );
                if (servicio) {
                  incluir = true;
                  servicioNombre = servicio.servicio_nombre || servicio.nombre;
                  razon = `Servicio: ${servicioNombre}`;
                }
                break;
              }

              case 'servicio_con_nivel': {
                const servicio = servicios.find((s: any) => {
                  if (s.servicio_id !== paso.configuracion_condicion?.servicio_id) {
                    return false;
                  }
                  const mapeoNiveles = paso.configuracion_condicion?.mapeo_niveles || {};
                  if (Object.keys(mapeoNiveles).length === 0) {
                    return true;
                  }
                  const nivelItem = s.nivel || s.nivel_nombre;
                  return Object.keys(mapeoNiveles).includes(nivelItem);
                });

                if (servicio) {
                  incluir = true;
                  servicioNombre = servicio.servicio_nombre || servicio.nombre;
                  nivelAplicado = servicio.nivel || servicio.nivel_nombre;

                  // SOLUCION: Consultar directamente en servicios_niveles_precio
                  const mapeoNiveles = paso.configuracion_condicion?.mapeo_niveles || {};

                  // Primero intentar con mapeo manual
                  if (nivelAplicado && mapeoNiveles[nivelAplicado]) {
                    pasoIdEspecifico = mapeoNiveles[nivelAplicado];
                  } else {
                    // Consulta dinámica a la BD
                    const { data: nivelData } = await supabase
                      .from('servicios_niveles_precio')
                      .select('paso_id')
                      .eq('servicio_id', servicio.servicio_id)
                      .eq('nombre', nivelAplicado)
                      .maybeSingle();

                    if (nivelData?.paso_id) {
                      pasoIdEspecifico = nivelData.paso_id;
                    }
                  }

                  razon = `${servicioNombre} - ${nivelAplicado}`;
                }
                break;
              }

              case 'acabado_sin_nivel': {
                const acabado = acabados.find(
                  (a: any) => a.acabado_id === paso.configuracion_condicion?.acabado_id
                );
                if (acabado) {
                  incluir = true;
                  acabadoNombre = acabado.acabado_nombre || acabado.nombre;
                  razon = `Acabado: ${acabadoNombre}`;
                }
                break;
              }

              case 'acabado_con_nivel': {
                const acabado = acabados.find((a: any) => {
                  if (a.acabado_id !== paso.configuracion_condicion?.acabado_id) {
                    return false;
                  }
                  const mapeoNiveles = paso.configuracion_condicion?.mapeo_niveles || {};
                  if (Object.keys(mapeoNiveles).length === 0) {
                    return true;
                  }
                  const nivelItem = a.nivel || a.nivel_nombre;
                  return Object.keys(mapeoNiveles).includes(nivelItem);
                });

                if (acabado) {
                  incluir = true;
                  acabadoNombre = acabado.acabado_nombre || acabado.nombre;
                  nivelAplicado = acabado.nivel || acabado.nivel_nombre;

                  // SOLUCION: Consultar directamente en acabados_niveles_precio
                  const mapeoNiveles = paso.configuracion_condicion?.mapeo_niveles || {};

                  // Primero intentar con mapeo manual
                  if (nivelAplicado && mapeoNiveles[nivelAplicado]) {
                    pasoIdEspecifico = mapeoNiveles[nivelAplicado];
                  } else {
                    // Consulta dinámica a la BD
                    const { data: nivelData } = await supabase
                      .from('acabados_niveles_precio')
                      .select('paso_id')
                      .eq('acabado_id', acabado.acabado_id)
                      .eq('nombre', nivelAplicado)
                      .maybeSingle();

                    if (nivelData?.paso_id) {
                      pasoIdEspecifico = nivelData.paso_id;
                    }
                  }

                  razon = `${acabadoNombre} - ${nivelAplicado}`;
                }
                break;
              }

              case 'tecnologia_tinta': {
                const tecnologiaId = configuracion?.tecnologia_id;
                // CORRECCION: Usar tipo_tinta (código) en lugar de tinta_nombre (nombre legible)
                // tipo_tinta contiene: 'K', 'CMYK', 'CMYK+W', etc (coincide con BD)
                // tinta_nombre contiene: 'Color (CMYK)', 'Negro (K)', etc (para display)
                const tintaCodigo = configuracion?.tipo_tinta || configuracion?.tinta;
                const tintaNombreDisplay = configuracion?.tinta_nombre || tintaCodigo;

                if (tecnologiaId && tintaCodigo) {
                  incluir = true;

                  // SOLUCION: Consultar directamente en tecnologias_tintas_pasos
                  const mapeoTintas = paso.configuracion_condicion?.mapeo_tintas || {};

                  // Primero intentar con mapeo manual (usa código de tinta)
                  if (mapeoTintas[tintaCodigo]) {
                    pasoIdEspecifico = mapeoTintas[tintaCodigo];
                  } else {
                    // Consulta dinámica a la BD usando código de tinta
                    const { data: tintaData } = await supabase
                      .from('tecnologias_tintas_pasos')
                      .select('paso_id')
                      .eq('tecnologia_id', tecnologiaId)
                      .eq('tinta', tintaCodigo)
                      .maybeSingle();

                    if (tintaData?.paso_id) {
                      pasoIdEspecifico = tintaData.paso_id;
                    }
                  }

                  razon = `Impresión ${tintaNombreDisplay}`;
                }
                break;
              }

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
              paso_id_especifico: pasoIdEspecifico,
              orden: paso.orden,
              es_obligatorio: paso.es_obligatorio,
              razon_inclusion: razon,
              nivel_aplicado: nivelAplicado,
              servicio_nombre: servicioNombre,
              acabado_nombre: acabadoNombre,
            });
          }
        }

        // 4. Consultar nombres reales de todos los pasos específicos
        const pasosIdsUnicos = [...new Set(
          generatedSteps
            .map(s => s.paso_id_especifico)
            .filter((id): id is string => id !== null)
        )];

        let nombresRealesPasos: Record<string, string> = {};
        if (pasosIdsUnicos.length > 0) {
          const { data: pasosReales } = await supabase
            .from('pasos')
            .select('id, nombre')
            .in('id', pasosIdsUnicos);

          if (pasosReales) {
            nombresRealesPasos = pasosReales.reduce((acc, paso) => {
              acc[paso.id] = paso.nombre;
              return acc;
            }, {} as Record<string, string>);
          }
        }

        // 5. Construir pasos finales con nombres reales
        const pasosFinales: GeneratedStep[] = generatedSteps.map(step => {
          const nombreReal = step.paso_id_especifico
            ? nombresRealesPasos[step.paso_id_especifico]
            : undefined;

          const nombreFinal = nombreReal || 'Paso sin nombre';

          return {
            id: step.id,
            etapa: normalizarEtapa(step.etapa),
            paso_id: step.paso_id_especifico,
            paso_nombre: nombreFinal,
            orden: step.orden,
            es_obligatorio: step.es_obligatorio,
            razon_inclusion: step.razon_inclusion,
            nivel_aplicado: step.nivel_aplicado,
            servicio_nombre: step.servicio_nombre,
            acabado_nombre: step.acabado_nombre,
            comentario_vendedor: null,
            origen_plantilla_id: rutaId,
          };
        });

        setSteps(pasosFinales);
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
