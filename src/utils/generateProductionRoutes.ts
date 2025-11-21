import { supabase } from '../lib/supabase';
import type { TipoEtapaRuta } from '../types/database';

export interface GeneratedRouteStep {
  id: string;
  etapa: TipoEtapaRuta;
  paso_id: string | null;
  paso_nombre: string;
  orden: number;
  es_obligatorio: boolean;
  origen_plantilla_id: string;
  comentario_vendedor?: string | null;
}

interface GenerateRoutesParams {
  productoId: string;
  categoria: string;
  configuracion: any;
}

/**
 * Normaliza el valor de etapa a uno de los valores válidos del enum TipoEtapaRuta
 * Maneja diferentes variaciones de nombres (con espacios, guiones, mayúsculas, etc.)
 *
 * Casos manejados:
 * - 'Pre-prensa', 'pre-prensa', 'Pre prensa' → 'pre_prensa'
 * - 'Terminacion', 'Post-prensa', 'post-prensa' → 'post_prensa'
 * - 'Produccion', 'Impresion', cualquier otro → 'principal'
 *
 * IMPORTANTE: El orden de las verificaciones es crítico para evitar falsos positivos
 */
function normalizarEtapa(etapa: string): TipoEtapaRuta {
  const etapaLower = etapa.toLowerCase().replace(/[-\s]/g, '_');

  // 1. Si ya está normalizado, devolver sin cambios
  if (etapaLower === 'pre_prensa' || etapaLower === 'principal' || etapaLower === 'post_prensa') {
    return etapaLower as TipoEtapaRuta;
  }

  // 2. Post-prensa (verificar ANTES que pre para evitar que "post_prensa" sea capturado por "pre")
  if (etapaLower.includes('post') ||
      etapaLower.includes('terminacion') ||
      etapaLower.includes('acabado')) {
    return 'post_prensa';
  }

  // 3. Pre-prensa (usar condiciones más específicas)
  if (etapaLower.startsWith('pre') || etapaLower.includes('_pre_')) {
    return 'pre_prensa';
  }

  // 4. Principal por defecto (producción, impresión, etc.)
  return 'principal';
}

/**
 * Genera las rutas de producción para un producto basándose en su configuración
 * Esta es la misma lógica que useGenerateProductionRoute pero de manera programática
 */
export async function generateProductionRoutes({
  productoId,
  categoria,
  configuracion,
}: GenerateRoutesParams): Promise<GeneratedRouteStep[]> {
  try {
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
      return [];
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
      return [];
    }

    // 3. Evaluar cada paso según condiciones
    const generatedSteps: Array<{
      etapa: string;
      paso_id_especifico: string | null;
      orden: number;
      es_obligatorio: boolean;
      origen_plantilla_id: string;
    }> = [];

    // Extraer servicios y acabados con compatibilidad
    const servicios = configuracion?.servicios_seleccionados || configuracion?.servicios || [];
    const acabados = configuracion?.acabados_seleccionados || configuracion?.acabados || [];

    for (const paso of pasos) {
      let incluir = false;
      let pasoIdEspecifico: string | null = paso.paso_id;

      // Si es obligatorio, siempre incluir
      if (paso.es_obligatorio) {
        incluir = true;
      } else {
        // Evaluar condición
        switch (paso.tipo_condicion) {
          case 'sin_condicion':
            incluir = true;
            break;

          case 'servicio_sin_nivel': {
            const servicio = servicios.find(
              (s: any) => s.servicio_id === paso.configuracion_condicion?.servicio_id
            );
            if (servicio) {
              incluir = true;
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
              const nivelAplicado = servicio.nivel || servicio.nivel_nombre;
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
            }
            break;
          }

          case 'acabado_sin_nivel': {
            const acabado = acabados.find(
              (a: any) => a.acabado_id === paso.configuracion_condicion?.acabado_id
            );
            if (acabado) {
              incluir = true;
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
              const nivelAplicado = acabado.nivel || acabado.nivel_nombre;
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
            }
            break;
          }

          case 'tecnologia_tinta': {
            const tecnologiaId = configuracion?.tecnologia_id;
            const tintaCodigo = configuracion?.tipo_tinta || configuracion?.tinta;

            if (tecnologiaId && tintaCodigo) {
              incluir = true;
              const mapeoTintas = paso.configuracion_condicion?.mapeo_tintas || {};

              // Primero intentar con mapeo manual
              if (mapeoTintas[tintaCodigo]) {
                pasoIdEspecifico = mapeoTintas[tintaCodigo];
              } else {
                // Consulta dinámica a la BD
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
            }
            break;
          }

          default:
            incluir = false;
        }
      }

      // Solo incluir si cumple condiciones
      if (incluir) {
        generatedSteps.push({
          etapa: paso.etapa,
          paso_id_especifico: pasoIdEspecifico,
          orden: paso.orden,
          es_obligatorio: paso.es_obligatorio,
          origen_plantilla_id: paso.id,
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

    // 5. Construir pasos finales con nombres reales y etapas normalizadas
    const pasosFinales: GeneratedRouteStep[] = generatedSteps.map((step, index) => {
      const nombreReal = step.paso_id_especifico
        ? nombresRealesPasos[step.paso_id_especifico]
        : undefined;

      const nombreFinal = nombreReal || 'Paso sin nombre';
      const etapaNormalizada = normalizarEtapa(step.etapa);

      console.log('🔄 Normalizando etapa:', { original: step.etapa, normalizada: etapaNormalizada, paso: nombreFinal });

      return {
        id: `temp-${step.origen_plantilla_id}-${index}`,
        etapa: etapaNormalizada,
        paso_id: step.paso_id_especifico,
        paso_nombre: nombreFinal,
        orden: step.orden,
        es_obligatorio: step.es_obligatorio,
        origen_plantilla_id: step.origen_plantilla_id,
        comentario_vendedor: null,
      };
    });

    return pasosFinales;
  } catch (err) {
    console.error('Error generando rutas:', err);
    return [];
  }
}
