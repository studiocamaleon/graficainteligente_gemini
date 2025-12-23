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
  source_service_id?: string;
  source_acabado_id?: string;
}

interface GenerateRoutesParams {
  productoId: string;
  categoria: string;
  configuracion: any;
}

/**
 * Normaliza el valor de etapa a uno de los valores válidos del enum TipoEtapaRuta
 * Maneja diferentes variaciones de nombres (con espacios, guiones, mayúsculas, etc.)
 */
export function normalizarEtapa(etapa: string): TipoEtapaRuta {
  // 1. Normalizar string: minúsculas, reemplazo de guiones/espacios, eliminar acentos
  const etapaLower = etapa.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Eliminar acentos
    .replace(/[-\s]/g, '_');

  // 2. Si ya está normalizado, devolver sin cambios
  if (etapaLower === 'pre_prensa' || etapaLower === 'principal' || etapaLower === 'post_prensa') {
    return etapaLower as TipoEtapaRuta;
  }

  // 3. Instalacion (verificar ANTES de otros checks para evitar conversión errónea)
  // 3. Instalacion (verificar ANTES de otros checks para evitar conversión errónea)
  if (etapaLower.includes('instalacion')) {
    return 'instalacion';
  }

  // 4. Post-prensa (verificar ANTES que pre para evitar que "post_prensa" sea capturado por "pre")
  if (etapaLower.includes('post') ||
    etapaLower.includes('terminacion') ||
    etapaLower.includes('acabado')) {
    return 'post_prensa';
  }

  // 5. Pre-prensa (condición más estricta: startsWith 'pre' pero NO incluye 'post')
  if (etapaLower.startsWith('pre') && !etapaLower.includes('post')) {
    return 'pre_prensa';
  }

  // 6. Produccion/Principal
  if (etapaLower.includes('produccion') || etapaLower.includes('principal')) {
    return 'principal';
  }

  // 7. Fallback: Si no coincide con nada, forzamos 'principal' para cumplir constraint DB
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
    // 1. Obtener ruta_produccion_id de la configuración o del producto según categoría
    let rutaId: string | null = configuracion?.ruta_produccion_id || null;

    if (!rutaId) {

      switch (categoria) {
        case 'Impresion Laser': {
          const { data } = await supabase
            .from('productos_impresion_laser')
            .select('ruta_produccion_id')
            .eq('id', productoId)
            .maybeSingle();
          rutaId = (data as any)?.ruta_produccion_id || null;
          break;
        }
        case 'Impresion Gran Formato': {
          const { data } = await supabase
            .from('productos_gran_formato')
            .select('ruta_produccion_id')
            .eq('id', productoId)
            .maybeSingle();
          rutaId = (data as any)?.ruta_produccion_id || null;
          break;
        }
        case 'Materiales Rigidos': {
          const { data } = await supabase
            .from('productos_materiales_rigidos')
            .select('ruta_produccion_id')
            .eq('id', productoId)
            .maybeSingle();
          rutaId = (data as any)?.ruta_produccion_id || null;
          break;
        }
        case 'Plotter de Corte': {
          const { data } = await supabase
            .from('productos_plotter_corte')
            .select('ruta_produccion_id')
            .eq('id', productoId)
            .maybeSingle();
          rutaId = (data as any)?.ruta_produccion_id || null;
          break;
        }
        case 'Portabanners': {
          const { data } = await supabase
            .from('productos_portabanners')
            .select('ruta_produccion_id')
            .eq('id', productoId)
            .maybeSingle();
          rutaId = (data as any)?.ruta_produccion_id || null;
          break;
        }
        case 'Sellos': {
          const { data } = await supabase
            .from('productos_sellos')
            .select('ruta_produccion_id')
            .eq('id', productoId)
            .maybeSingle();
          rutaId = (data as any)?.ruta_produccion_id || null;
          break;
        }
        case 'Talonarios': {
          const { data } = await supabase
            .from('productos_talonarios')
            .select('ruta_produccion_id')
            .eq('id', productoId)
            .maybeSingle();
          rutaId = (data as any)?.ruta_produccion_id || null;
          break;
        }
        // case 'centro_copiado': REMOVED - We rely fully on dynamic rules now
        //   break;
        case 'personalizado': {
          // Primero intentar usar la ruta definida en la configuración (para productos ad-hoc)
          if (configuracion?.ruta_produccion_id) {
            rutaId = configuracion.ruta_produccion_id;
            break;
          }

          // Si no hay en config, buscar en la tabla (para plantillas guardadas)
          const { data } = await (supabase as any)
            .from('productos_personalizados')
            .select('ruta_produccion_id')
            .eq('id', productoId)
            .maybeSingle();
          rutaId = data?.ruta_produccion_id || null;
          break;
        }
      }
    }

    // 1b. Inyección Dinámica de Terminaciones (Centro de Copiado)
    let pasosExtra: GeneratedRouteStep[] = [];
    if (categoria === 'centro_copiado') {
      const keysToCheck = ['anillado', 'plastificado', 'guillotinado', 'tipo_tinta'];
      const dynamicStepsToAdd: { paso_id: string, orden_offset: number }[] = [];
      let maxOrden = 900;

      // Fetch ALL configuration rules for this company (optimized: could be cached or passed in)
      // For now, we fetch ad-hoc to ensure accuracy.
      const { data: configRules } = await supabase
        .from('centro_copiado_rutas_configuracion')
        .select('*');

      if (configRules) {
        for (const key of keysToCheck) {
          if (configuracion[key]) {
            const configValue = configuracion[key];
            let valueToMatch: string | null = null;

            // Extract value based on type (simulating PL/PGSQL logic)
            if (typeof configValue === 'string') {
              valueToMatch = configValue;
            } else if (typeof configValue === 'object' && configValue !== null) {
              valueToMatch = configValue.tipo || null;
            }

            // 1. Find match: Exact Match > Wildcard (Value is NULL)
            // Sort by valor NULLS LAST to prioritize specific value matches
            const match = configRules
              .filter(r => r.clave === key && (r.valor === valueToMatch || r.valor === null))
              .sort((a, b) => {
                if (a.valor === valueToMatch && b.valor !== valueToMatch) return -1;
                if (a.valor !== valueToMatch && b.valor === valueToMatch) return 1;
                return 0;
              })[0];

            if (match) {
              dynamicStepsToAdd.push({ paso_id: match.paso_id, orden_offset: maxOrden++ });
            } else {
              // Fallback Legacy Logic (only if no DB rule found)
              let fallbackPattern = '';
              if (key === 'anillado') fallbackPattern = '%Anillado%';
              else if (key === 'plastificado') fallbackPattern = '%Plastificado%';
              else if (key === 'guillotinado') fallbackPattern = '%Guillotinado%';

              if (fallbackPattern) {
                const { data: fallbackStep } = await supabase
                  .from('pasos')
                  .select('id')
                  .ilike('nombre', fallbackPattern)
                  .limit(1)
                  .maybeSingle();

                if (fallbackStep) {
                  dynamicStepsToAdd.push({ paso_id: fallbackStep.id, orden_offset: maxOrden++ });
                }
              }
            }
          }
        }
      }

      if (dynamicStepsToAdd.length > 0) {
        // Fetch details for all found steps
        const { data: pasosEncontradosRaw } = await supabase
          .from('pasos')
          .select('id, nombre, etapa')
          .in('id', dynamicStepsToAdd.map(d => d.paso_id))
          .returns<{ id: string, nombre: string, etapa: string }[]>();

        if (pasosEncontradosRaw) {
          const pasosMap = new Map((pasosEncontradosRaw as { id: string, nombre: string, etapa: string }[]).map(p => [p.id, p]));

          dynamicStepsToAdd.forEach((item, idx) => {
            const paso = pasosMap.get(item.paso_id);
            if (paso) {
              pasosExtra.push({
                id: `dynamic-${paso.id}-${idx}`,
                etapa: normalizarEtapa(paso.etapa), // Use dynamic stage
                paso_id: paso.id,
                paso_nombre: paso.nombre,
                orden: item.orden_offset,
                es_obligatorio: true,
                origen_plantilla_id: paso.id,
                comentario_vendedor: null
              });
            }
          });
        }
      }
    }

    if (!rutaId && pasosExtra.length === 0) {
      if (categoria === 'centro_copiado') {
        // Por lo menos agregar un paso de impresión básico si no hay nada
        return [{
          id: 'dynamic-print-basic',
          etapa: 'principal' as TipoEtapaRuta,
          paso_id: null,
          paso_nombre: 'Impresión / Copiado',
          orden: 1,
          es_obligatorio: true,
          origen_plantilla_id: 'centro_copiado_default'
        }];
      }
      return [];
    }

    interface RutaPasoRow {
      id: string;
      etapa: string;
      paso_id: string | null;
      orden: number;
      es_obligatorio: boolean;
      tipo_condicion: string;
      configuracion_condicion: any;
      pasos: { nombre: string } | null; // Joined table can be single object or array depending on relation, here likely object
    }

    // 2. Obtener pasos de la ruta principal (si existe)
    let pasosFinales: GeneratedRouteStep[] = [];

    if (rutaId) {
      const { data: pasosRaw, error: pasosError } = await supabase
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

      // Cast to explicit type to avoid 'never' inference
      const pasos = pasosRaw as unknown as RutaPasoRow[];

      if (pasos && pasos.length > 0) {
        // 3. Evaluar cada paso según condiciones
        const generatedSteps: Array<{
          etapa: string;
          paso_id_especifico: string | null;
          orden: number;
          es_obligatorio: boolean;
          origen_plantilla_id: string;
          source_service_id?: string;
          source_acabado_id?: string;
        }> = [];

        // Extraer servicios y acabados con compatibilidad
        let servicios = configuracion?.servicios_seleccionados || configuracion?.servicios || [];
        let acabados = configuracion?.acabados_seleccionados || configuracion?.acabados || [];

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

                    if ((nivelData as any)?.paso_id) {
                      pasoIdEspecifico = (nivelData as any).paso_id;
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

                    if ((nivelData as any)?.paso_id) {
                      pasoIdEspecifico = (nivelData as any).paso_id;
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

                    if ((tintaData as any)?.paso_id) {
                      pasoIdEspecifico = (tintaData as any).paso_id;
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
            let sourceServiceId: string | undefined;
            let sourceAcabadoId: string | undefined;

            // Determinar ID del origen
            if (paso.tipo_condicion === 'servicio_sin_nivel' || paso.tipo_condicion === 'servicio_con_nivel') {
              sourceServiceId = paso.configuracion_condicion?.servicio_id;
            } else if (paso.tipo_condicion === 'acabado_sin_nivel' || paso.tipo_condicion === 'acabado_con_nivel') {
              sourceAcabadoId = paso.configuracion_condicion?.acabado_id;
            }

            generatedSteps.push({
              etapa: paso.etapa,
              paso_id_especifico: pasoIdEspecifico,
              orden: paso.orden,
              es_obligatorio: paso.es_obligatorio,
              origen_plantilla_id: paso.id,
              source_service_id: sourceServiceId,
              source_acabado_id: sourceAcabadoId,
            });
          }
        }

        // 4. Consultar nombres reales Y ETAPAS de todos los pasos específicos
        const pasosIdsUnicos = [...new Set(
          generatedSteps
            .map(s => s.paso_id_especifico)
            .filter((id): id is string => id !== null)
        )];

        let datosRealesPasos: Record<string, { nombre: string, etapa: string }> = {};
        if (pasosIdsUnicos.length > 0) {
          const { data: pasosReales } = await supabase
            .from('pasos')
            .select('id, nombre, etapa')
            .in('id', pasosIdsUnicos);

          if (pasosReales) {
            datosRealesPasos = (pasosReales as any[]).reduce((acc, paso) => {
              acc[paso.id] = { nombre: paso.nombre, etapa: paso.etapa };
              return acc;
            }, {} as Record<string, { nombre: string, etapa: string }>);
          }
        }

        // 5. Construir pasos finales con nombres reales y etapas normalizadas
        pasosFinales = generatedSteps.map((step, index) => {
          const datosReal = step.paso_id_especifico
            ? datosRealesPasos[step.paso_id_especifico]
            : undefined;

          const nombreFinal = datosReal?.nombre || 'Paso sin nombre';

          // FIX: Usar la etapa real definida en el paso si existe, sino fallback al template
          const etapaOrigen = datosReal?.etapa || step.etapa;
          const etapaNormalizada = normalizarEtapa(etapaOrigen);

          return {
            id: `temp-${step.origen_plantilla_id}-${index}`,
            etapa: etapaNormalizada,
            paso_id: step.paso_id_especifico,
            paso_nombre: nombreFinal,
            orden: step.orden,
            es_obligatorio: step.es_obligatorio,
            origen_plantilla_id: step.origen_plantilla_id,
            comentario_vendedor: null,
            source_service_id: step.source_service_id,
            source_acabado_id: step.source_acabado_id,
          };
        });
      }
    }

    // 6. Concatenar pasos dinámicos (terminaciones copiado)
    if (pasosExtra.length > 0) {
      pasosFinales = [...pasosFinales, ...pasosExtra];
    }

    return pasosFinales;
  } catch (err) {
    console.error('Error generando rutas:', err);
    return [];
  }
}
