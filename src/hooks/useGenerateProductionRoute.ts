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

      // Si no hay productoId o categoria, y tampoco hay una ruta manual en la config, no hacer nada
      if ((!productoId || !categoria) && !configuracion?.ruta_produccion_id) {
        setSteps([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // 1. Obtener ruta_produccion_id del producto según configuración o categoría
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
            case 'Gran Formato': {
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
          }
        }


        if (!rutaId) {
          setSteps([]);
          setLoading(false);
          return;
        }

        // 2. Obtener pasos de la ruta
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

        const pasos = (pasosRaw || []) as any[];

        if (pasosError) {
          console.error('❌ useGenerateProductionRoute: Error al obtener pasos:', pasosError);
          throw pasosError;
        }

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
        let servicios = configuracion?.servicios_seleccionados || configuracion?.servicios || [];
        let acabados = configuracion?.acabados_seleccionados || configuracion?.acabados || [];

        for (const paso of pasos) {
          let incluir = false;
          let razon = '';
          let pasoIdEspecifico: string | null = paso.paso_id;
          let nivelAplicado: string | undefined;
          let servicioNombre: string | undefined;
          let acabadoNombre: string | undefined;

          // Si es obligatorio, siempre incluir
          if ((paso as any).es_obligatorio) {
            incluir = true;
            razon = 'Paso obligatorio';
          } else {
            // Evaluar condición
            switch ((paso as any).tipo_condicion) {
              case 'sin_condicion':
                incluir = true;
                razon = 'Sin condición';
                break;

              case 'servicio_sin_nivel': {
                const servicio = servicios.find(
                  (s: any) => s.servicio_id === (paso as any).configuracion_condicion?.servicio_id
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
                  if (s.servicio_id !== (paso as any).configuracion_condicion?.servicio_id) {
                    return false;
                  }
                  const mapeoNiveles = ((paso as any).configuracion_condicion?.mapeo_niveles || {}) as Record<string, any>;
                  if (Object.keys(mapeoNiveles).length === 0) {
                    return true;
                  }
                  const nivelItem = s.nivel || s.nivel_nombre;
                  return nivelItem ? Object.keys(mapeoNiveles).includes(nivelItem) : false;
                });

                if (servicio) {
                  incluir = true;
                  servicioNombre = servicio.servicio_nombre || servicio.nombre;
                  nivelAplicado = servicio.nivel || servicio.nivel_nombre;

                  // SOLUCION: Consultar directamente en servicios_niveles_precio
                  const mapeoNiveles = ((paso as any).configuracion_condicion?.mapeo_niveles || {}) as Record<string, any>;

                  // Primero intentar con mapeo manual
                  if (nivelAplicado && mapeoNiveles[nivelAplicado]) {
                    pasoIdEspecifico = mapeoNiveles[nivelAplicado];
                  } else {
                    // Consulta dinámica a la BD
                    const { data: nivelData } = await supabase
                      .from('servicios_niveles_precio')
                      .select('paso_id')
                      .eq('servicio_id', (servicio as any).servicio_id)
                      .eq('nombre', nivelAplicado as any)
                      .maybeSingle();

                    if ((nivelData as any)?.paso_id) {
                      pasoIdEspecifico = (nivelData as any).paso_id;
                    }
                  }

                  razon = `${servicioNombre} - ${nivelAplicado}`;
                }
                break;
              }

              case 'acabado_sin_nivel': {
                const acabado = acabados.find(
                  (a: any) => a.acabado_id === (paso as any).configuracion_condicion?.acabado_id
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
                  if (a.acabado_id !== (paso as any).configuracion_condicion?.acabado_id) {
                    return false;
                  }
                  const mapeoNiveles = ((paso as any).configuracion_condicion?.mapeo_niveles || {}) as Record<string, any>;
                  if (Object.keys(mapeoNiveles).length === 0) {
                    return true;
                  }
                  const nivelItem = a.nivel || a.nivel_nombre;
                  return nivelItem ? Object.keys(mapeoNiveles).includes(nivelItem) : false;
                });

                if (acabado) {
                  incluir = true;
                  acabadoNombre = acabado.acabado_nombre || acabado.nombre;
                  nivelAplicado = acabado.nivel || acabado.nivel_nombre;

                  // SOLUCION: Consultar directamente en acabados_niveles_precio
                  const mapeoNiveles = ((paso as any).configuracion_condicion?.mapeo_niveles || {}) as Record<string, any>;

                  // Primero intentar con mapeo manual
                  if (nivelAplicado && mapeoNiveles[nivelAplicado]) {
                    pasoIdEspecifico = mapeoNiveles[nivelAplicado];
                  } else {
                    // Consulta dinámica a la BD
                    const { data: nivelData } = await supabase
                      .from('acabados_niveles_precio')
                      .select('paso_id')
                      .eq('acabado_id', (acabado as any).acabado_id)
                      .eq('nombre', nivelAplicado as any)
                      .maybeSingle();

                    if ((nivelData as any)?.paso_id) {
                      pasoIdEspecifico = (nivelData as any).paso_id;
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
                  const mapeoTintas = ((paso as any).configuracion_condicion?.mapeo_tintas || {}) as Record<string, any>;

                  // Primero intentar con mapeo manual (usa código de tinta)
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
              id: (paso as any).id,
              etapa: (paso as any).etapa,
              paso_id_especifico: pasoIdEspecifico,
              orden: (paso as any).orden,
              es_obligatorio: (paso as any).es_obligatorio,
              razon_inclusion: razon,
              nivel_aplicado: nivelAplicado,
              servicio_nombre: servicioNombre,
              acabado_nombre: acabadoNombre,
            });
          }
        }

        // 4. Consultar nombres reales y etapas de todos los pasos específicos
        const pasosIdsUnicos = [...new Set(
          generatedSteps
            .map(s => s.paso_id_especifico)
            .filter((id): id is string => id !== null)
        )];


        let dataPasosReales: Record<string, { nombre: string, etapa: string }> = {};
        if (pasosIdsUnicos.length > 0) {
          const { data: pasosRealesRaw } = await supabase
            .from('pasos')
            .select('id, nombre, etapa') // Agregado: etapa
            .in('id', pasosIdsUnicos);

          const pasosReales = (pasosRealesRaw || []) as any[];

          if (pasosReales) {
            dataPasosReales = pasosReales.reduce((acc: any, paso: any) => {
              acc[paso.id] = { nombre: paso.nombre, etapa: paso.etapa };
              return acc;
            }, {});
          }
        }

        // 5. Construir pasos finales con nombres reales y etapas correctas
        const pasosFinales: GeneratedStep[] = generatedSteps.map(step => {
          const datosReal = step.paso_id_especifico
            ? dataPasosReales[step.paso_id_especifico]
            : undefined;

          const nombreFinal = datosReal?.nombre || 'Paso sin nombre';

          // CRITICAL FIX: Use the stage defined in the actual STEP (paso) if available, 
          // falling back to the template stage (rutas_produccion_pasos.etapa) only if necessary.
          // This ensures that if "Impresion UV" generates a "Produccion" step, it appears in "Produccion".
          const etapaFinal = datosReal?.etapa || step.etapa;

          return {
            id: step.id,
            etapa: etapaFinal, // Direct use, assuming DB has valid enum values ('Produccion', etc.)
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

    if ((productoId && categoria) || configuracion?.ruta_produccion_id) {
      generateRoute();
    } else {
      setSteps([]);
      setLoading(false);
    }
  }, [productoId, categoria, JSON.stringify(configuracion)]);

  return { steps, loading, error };
}
