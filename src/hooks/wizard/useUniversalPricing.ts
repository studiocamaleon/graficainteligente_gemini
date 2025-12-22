import { useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../useAuth';
import type { ProductCategory } from './useUniversalProductSearch';
import type { SelectedConfiguration, MeasurementLine } from '../../components/wizard/steps/ConfigurationStep';
import type { SelectedService, SelectedFinishing } from '../../components/wizard/steps/ServicesAndFinishingsStep';

export interface PriceCalculationResult {
  precio_base: number | null;
  precio_servicios: number;
  precio_acabados: number;
  precio_total: number | null;
  tiene_precio: boolean;
  componentes_actualizados?: any[];
  lineas_actualizadas?: any[];
}

export function useUniversalPricing() {
  const [isCalculating, setIsCalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { profile } = useAuth();
  const companyId = profile?.company_id;

  const calculatePrice = useCallback(async (
    productId: string,
    categoria: ProductCategory,
    config: SelectedConfiguration,
    servicios: SelectedService[],
    acabados: SelectedFinishing[],
    cantidadesFijas?: number[],
    isPersonalized: boolean = false,
    parentQuantity: number = 1
  ): Promise<PriceCalculationResult> => {
    setIsCalculating(true);
    setError(null);

    try {
      // NORMALIZACIÓN DE CANTIDAD:
      // Algunos flujos (como Centro de Copiado) pueden no tener 'cantidad' definida en el objeto config 
      // o pueden tenerla en 0. Aseguramos un valor mínimo de 1 para evitar divisiones NaN / Infinity.
      const safeQty = Math.max(1, (config as any).cantidad || (config as any).cantidad_copias || 1);

      // Inyectar la cantidad normalizada en el config para que las funciones internas la usen
      const normalizedConfig = { ...config, cantidad: safeQty };

      let precioBase: number | null = null;
      let componentesActualizados: any[] | undefined;

      if (isPersonalized) {
        // Para productos personalizados (compuestos), inyectamos la cantidad del padre (inyectada por el motor)
        const personalizedConfig = { ...normalizedConfig, cantidad: safeQty * parentQuantity };
        const result = await getPrecioPersonalizado(productId, personalizedConfig, companyId);
        precioBase = result?.totalPrice || null;
        componentesActualizados = result?.updatedComponents;
      } else {
        // Para productos simples
        const consolidatedConfig = { ...normalizedConfig, cantidad: safeQty * parentQuantity };
        precioBase = await getBasePriceInternal(productId, categoria, consolidatedConfig, companyId);
      }

      if (precioBase === null) {
        return {
          precio_base: null,
          precio_servicios: 0,
          precio_acabados: 0,
          precio_total: null,
          tiene_precio: false,
          componentes_actualizados: componentesActualizados
        };
      }

      // ==========================================================================================
      // LÓGICA MULTI-LÍNEA (Gran Formato y otros que usen lineas_medidas)
      // ==========================================================================================
      const lineas = config.lineas_medidas || [];
      const tieneLineas = lineas.length > 0;
      let lineasActualizadas: any[] = [];
      let consolidatedBasePrice = 0;

      if (tieneLineas) {
        // 1. Calcular Totales Agregados de las líneas
        let totalMt2Lines = 0;
        let totalMlLines = 0;
        let totalItemsCount = 0;

        // Primero calculamos el precio base de cada línea si no viene pre-calculado
        // Ojo: En GF el precio base suele venir del componente AddLineForm, pero aquí podríamos recalcularlo si fuera necesario.
        // Por ahora asumimos que linea.precio_total_linea (base) viene populado o lo tomamos.
        // Si no, usamos las métricas.

        // DEBUG: Trace pricing inputs
        console.log('DEBUG_PRICING: Starting Calculation', {
          acabadosParam: acabados.map(a => `${a.nombre} (${a.tipo_impacto})`),
          linesBasePrices: lineas.map(l => ({ id: l.id, base: l.precio_base_unitario, total: l.precio_total_linea })),
          totalPrevious: precioBase
        });

        lineasActualizadas = await Promise.all(lineas.map(async l => {
          // Asegurar métricas por línea
          const lMt2 = l.mt2_calculado || ((l.ancho_seleccionado || 0) / 100) * ((l.metros_lineales || l.alto || 0) / 100) * (l.cantidad || 1);
          const lMl = (l.metros_lineales || ((l.alto || 0) / 100)) * (l.cantidad || 1);

          totalMt2Lines += lMt2;
          totalMlLines += lMl;
          totalItemsCount += (l.cantidad || 1);

          // Precio base de la línea (sin extras globales todavía)
          // Si el precio base unitario no está set, intentamos calcularlo de cero
          let baseUnitario = l.precio_base_unitario || 0;

          if (!baseUnitario && productId) {
            // Intento de recuperación robusta del precio base
            try {
              // Configuración base sin líneas
              const baseConfigForLine = { ...normalizedConfig, lineas_medidas: [] };
              // Llamamos a la función unitaria (exportada en este mismo archivo)
              // Pasamos arrays vacíos de servicios/acabados porque solo queremos el base
              const priceResult = await calculateLinePrice(
                productId,
                categoria,
                l,
                baseConfigForLine,
                [],
                [],
                normalizedConfig.tipo_venta_real as any // cast if needed
              );

              if (priceResult?.precio_base_unitario) {
                baseUnitario = priceResult.precio_base_unitario;
                console.log("DEBUG_PRICING: Recovered base price for line", { lineId: l.id, baseUnitario });
              }
            } catch (err) {
              console.error("Error recovering line base price:", err);
            }
          }

          const baseLinePrice = baseUnitario * (l.cantidad || 1);
          consolidatedBasePrice += baseLinePrice;

          return {
            ...l,
            precio_base_unitario: baseUnitario, // Ensure it is set for next steps
            _metrics: { mt2: lMt2, ml: lMl, qty: l.cantidad || 1, baseTotal: baseLinePrice },
            precio_servicios_extra_total: 0,
            precio_acabados_extra_total: 0
          };
        }));



        // Use the aggregated total as the base for global calculations if needed
        if (precioBase === null) precioBase = consolidatedBasePrice;

      }

      // ==========================================================================================
      // CÁLCULO ESTÁNDAR (O BASE PARA LÍNEAS)
      // ==========================================================================================

      // Si no hay líneas, usamos la lógica original para precio base total
      // Para productos con cantidades fijas, el precio base es para toda la cantidad
      // Para productos con cantidades variables, el precio base ya es unitario
      const esCantidadFija = cantidadesFijas && cantidadesFijas.length > 0;

      // Si tiene líneas, precioBaseTotal es la suma de todas
      const precioBaseTotal = tieneLineas
        ? consolidatedBasePrice
        : (esCantidadFija ? precioBase : (precioBase || 0) * safeQty);

      const precioBaseUnitario = tieneLineas
        ? (safeQty > 0 ? consolidatedBasePrice / safeQty : 0) // Promedio si es multi línea? Ojo, safeQty en multi línea es 1 (la orden) o N? Normalmente parentQuantity.
        : (esCantidadFija ? (precioBase || 0) / safeQty : (precioBase || 0));

      // Métricas globales (si no es multi-linea)
      const mt2 = tieneLineas
        ? 0 // Se usa por línea
        : (config.medida_ancho && config.medida_alto ? (config.medida_ancho / 100) * (config.medida_alto / 100) : 0);

      const metrosLineales = tieneLineas
        ? 0 // Se usa por línea
        : (config.medida_alto ? config.medida_alto / 100 : 0);


      // ==========================================================================================
      // CÁLCULO DE SERVICIOS Y ACABADOS (GLOBALES)
      // ==========================================================================================

      let precioServiciosTotal = 0;
      let precioAcabadosTotal = 0;

      // Helper para distribuir costos a líneas
      const distribuirAlineas = (tipo: 'servicio' | 'acabado', item: any, costoTotalCalculado: number) => {
        if (!tieneLineas) return;

        lineasActualizadas = lineasActualizadas.map(linea => {
          let impactoLinea = 0;
          const { mt2, ml, qty, baseTotal } = linea._metrics;

          // Normalizar valores (fallback a raw value si monto/porcentaje no estan definidos)
          const valMonto = item.valor_monto ?? item.valor_impacto ?? 0;
          // Para tipos mixtos, el secundario suele ser el porcentaje/variable. 
          // Para porcentuales puros, el valor principal (impacto) es el porcentaje.
          let valPorc = item.valor_porcentaje ?? item.valor_impacto_secundario ?? 0;
          if (item.tipo_impacto === 'porcentual' && !valPorc) {
            valPorc = item.valor_impacto ?? 0;
          }

          // Lógica de distribución según tipo de impacto
          switch (item.tipo_impacto) {
            // 1. Porcentuales: Se aplican al precio base de LA LÍNEA
            case 'porcentual':
              impactoLinea = (valPorc * baseTotal) / 100;
              break;

            // 2. Por métrica (mt2 / ml): Se aplican a las métricas DE LA LÍNEA
            case 'por_mt2':
              impactoLinea = valMonto * mt2;
              break;
            case 'por_metro_lineal':
              impactoLinea = valMonto * ml;
              break;

            // 3. Fijos: Se prorratean entre todas las líneas
            case 'precio_fijo':
              impactoLinea = valMonto / lineasActualizadas.length;
              break;

            // 4. Mixtos (Fijo + Variable)
            case 'fijo_metro_cuadrado':
            case 'fijo_mt2':
            case 'fijo_m2':
              // Fijo (prorrateado) + Variable (métrica linea)
              const fijoPart4 = valMonto / lineasActualizadas.length;
              const varPart4 = valPorc * mt2;
              impactoLinea = fijoPart4 + varPart4;
              break;

            case 'fijo_metro_lineal':
            case 'fijo_mt_lineal':
              const fijoPartMl = valMonto / lineasActualizadas.length;
              const varPartMl = valPorc * ml; // assuming ml is meters
              impactoLinea = fijoPartMl + varPartMl;
              break;

            case 'fijo_porcentual':
              const fijoPart5 = valMonto / lineasActualizadas.length;
              const varPart5 = (valPorc * baseTotal) / 100; // Porcentaje de ESA línea
              impactoLinea = fijoPart5 + varPart5;
              break;

            // 5. Por Tiempo (Minutos / Horas)
            case 'por_minuto':
              // Se aplica: (Valor Mins * Cantidad Minutos) / N Líneas ?? 
              // O si es "Por minuto GLOBAL" se divide?
              // Generalmente el tiempo es global "X minutos de trabajo total".
              // Entonces Impacto Total = Valor * CantidadMins.
              // Y eso se prorratea entre las líneas.
              const totalTimeCost = valMonto * (item.cantidad || 1);
              impactoLinea = totalTimeCost / lineasActualizadas.length;
              break;

            // 6. Mixto Tiempo (Fijo + Minutos)
            case 'fijo_minuto':
              // Fijo (setup) + Variable (mins * valor min)
              // Todo es global y se prorratea.
              const fixedPartTime = valMonto; // Fijo (Base)
              const varPartTime = valPorc * (item.cantidad || 1); // Variable (Minutos * PrecioMin)

              const totalMixedTime = fixedPartTime + varPartTime;

              if (item.tipo_impacto === 'fijo_minuto') {
                console.log('DEBUG_TIME_PRICING:', {
                  tipo: item.tipo_impacto,
                  valMonto, // Fixed
                  valPorc, // Min price ??
                  qty: item.cantidad,
                  varPartTime,
                  itemRaw: item
                });
              }

              impactoLinea = totalMixedTime / lineasActualizadas.length;
              break;

            default:
              // Fallback: Proporcional al precio base
              if (consolidatedBasePrice > 0) {
                impactoLinea = costoTotalCalculado * (baseTotal / consolidatedBasePrice);
              } else {
                impactoLinea = costoTotalCalculado / lineasActualizadas.length;
              }
          }

          // Acumular en la línea
          if (tipo === 'servicio') {
            linea.precio_servicios_extra_total += impactoLinea;
          } else {
            linea.precio_acabados_extra_total += impactoLinea;
          }

          return linea;
        });
      };


      // --- Procesar Servicios ---
      for (const servicio of servicios) {
        let impacto = 0;
        if (tieneLineas) {
          // Calcular impacto "Virtual" global para distribuir o calcular directo
          // Nota: Para porcentuales en multi-linea, el "Total" es la suma de los porcentuales individuales.
          // Para simplificar, calculamos y distribuimos dentro de la función auxiliar.
          distribuirAlineas('servicio', servicio, servicio.valor_monto || 0); // Pasamos valor fijo 'raw' para distribución
        } else {
          impacto = calcularImpacto(
            servicio.tipo_impacto,
            servicio.valor_monto ?? servicio.valor_impacto ?? 0,
            servicio.valor_porcentaje ?? servicio.valor_impacto_secundario ?? 0,
            precioBaseTotal,
            mt2,
            metrosLineales,
            safeQty,
            servicio.cantidad
          );
        }
        precioServiciosTotal += impacto;
      }

      // Si es multi-linea, recalcular el total de servicios sumando lo de las líneas
      if (tieneLineas) {
        precioServiciosTotal = lineasActualizadas.reduce((acc, l) => acc + l.precio_servicios_extra_total, 0);
      }


      // --- Procesar Acabados ---
      for (const acabado of acabados) {
        let impacto = 0;
        if (tieneLineas) {
          distribuirAlineas('acabado', acabado, acabado.valor_monto || 0);
        } else {
          impacto = calcularImpacto(
            acabado.tipo_impacto,
            acabado.valor_monto ?? acabado.valor_impacto ?? 0,
            acabado.valor_porcentaje ?? acabado.valor_impacto_secundario ?? 0,
            precioBaseTotal,
            mt2,
            metrosLineales,
            safeQty,
            acabado.cantidad
          );
        }
        precioAcabadosTotal += impacto;
      }

      // Si es multi-linea, recalcular el total de acabados sumando lo de las líneas
      if (tieneLineas) {
        precioAcabadosTotal = lineasActualizadas.reduce((acc, l) => acc + l.precio_acabados_extra_total, 0);

        // FINALIZAR LÍNEAS ACTUALIZADAS
        // Actualizar los unitarios finales de cada línea para que el wizard los guarde bien
        lineasActualizadas = lineasActualizadas.map(l => {
          const base = l.precio_base_unitario || 0;

          // Recuperar precios base "limpios" (Step 2) usando propiedad privada persistente
          // Si no existe, asumimos que l.precio_X es el base (primera ejecución limpia)
          const servBaseUnit = (l as any)._precio_servicios_unitario_base !== undefined
            ? (l as any)._precio_servicios_unitario_base
            : (l.precio_servicios_unitario || 0);

          const acabBaseUnit = (l as any)._precio_acabados_unitario_base !== undefined
            ? (l as any)._precio_acabados_unitario_base
            : (l.precio_acabados_unitario || 0);

          const servExtrasUnit = l.precio_servicios_extra_total / (l.cantidad || 1);
          const acabExtrasUnit = l.precio_acabados_extra_total / (l.cantidad || 1);

          // Sumar: Base (Step 2) + Extras (Step 3)
          const servTotalUnit = servBaseUnit + servExtrasUnit;
          const acabTotalUnit = acabBaseUnit + acabExtrasUnit;

          const finalUnit = base + servTotalUnit + acabTotalUnit;

          return {
            ...l,
            // Persistir los bases limpios para futuras ejecuciones
            _precio_servicios_unitario_base: servBaseUnit,
            _precio_acabados_unitario_base: acabBaseUnit,

            // Actualizar los totales visibles
            precio_servicios_unitario: servTotalUnit,
            precio_acabados_unitario: acabTotalUnit,

            precio_unitario_final: finalUnit,
            precio_total_linea: finalUnit * (l.cantidad || 1),

            // Limpiar props temporales
            _metrics: undefined,
            precio_servicios_extra_total: undefined,
            precio_acabados_extra_total: undefined
          };
        });
      }


      // Convertir a precios unitarios globales (promedio ponderado o simple división)
      const divider = safeQty;
      const precioServiciosUnitario = divider > 0 ? precioServiciosTotal / divider : 0;
      const precioAcabadosUnitario = divider > 0 ? precioAcabadosTotal / divider : 0;
      const precioTotalUnitario = precioBaseUnitario + precioServiciosUnitario + precioAcabadosUnitario;

      console.log('📊 Resultado final:', {
        precio_base_unitario: precioBaseUnitario,
        precio_servicios_unitario: precioServiciosUnitario,
        precio_acabados_unitario: precioAcabadosUnitario,
        precio_total_unitario: precioTotalUnitario,
        precio_total_completo: precioTotalUnitario * safeQty
      });

      // Devolvemos los precios unitarios
      return {
        precio_base: precioBaseUnitario,
        precio_servicios: precioServiciosUnitario,
        precio_acabados: precioAcabadosUnitario,
        precio_total: precioTotalUnitario,
        tiene_precio: true,
        componentes_actualizados: componentesActualizados,
        lineas_actualizadas: tieneLineas ? lineasActualizadas : undefined
      };
    } catch (err) {
      console.error('Error calculando precio:', err);
      setError(err instanceof Error ? err.message : 'Error desconocido');
      return {
        precio_base: null,
        precio_servicios: 0,
        precio_acabados: 0,
        precio_total: null,
        tiene_precio: false
      };
    } finally {
      setIsCalculating(false);
    }
  }, []);

  return { calculatePrice, isCalculating, error };
}

// ===============================================
// FUNCIONES DE CÁLCULO POR CATEGORÍA
// ===============================================

async function getPrecioImpresionLaser(
  productId: string,
  config: SelectedConfiguration
): Promise<number | null> {
  if (!config.medida_ancho || !config.medida_alto || !config.tinta || !config.cara_impresa) {
    return null;
  }

  // Primero consultar el producto para verificar si usa rangos
  const { data: producto, error: productoError } = await (supabase as any)
    .from('productos_impresion_laser')
    .select('rango_precio_id')
    .eq('id', productId)
    .maybeSingle();

  if (productoError) {
    console.error('Error consultando producto laser:', productoError);
    return null;
  }

  const usaRangos = producto?.rango_precio_id !== null;

  if (usaRangos) {
    // Buscar precios con rangos
    const { data: precios, error } = await (supabase as any)
      .from('productos_impresion_laser_precios')
      .select('precio, rango_precio_min, rango_precio_max')
      .eq('producto_laser_id', productId)
      .eq('medida_ancho', config.medida_ancho)
      .eq('medida_alto', config.medida_alto)
      .eq('tinta', config.tinta)
      .eq('cara_impresa', config.cara_impresa);

    if (error) {
      console.error('Error buscando precio laser con rangos:', error);
      return null;
    }

    if (!precios || precios.length === 0) return null;

    // Buscar en qué rango cae la cantidad
    const precioEnRango = precios.find((p: any) => {
      if (p.rango_precio_max === null) {
        return config.cantidad >= p.rango_precio_min;
      }
      return config.cantidad >= p.rango_precio_min && config.cantidad <= p.rango_precio_max;
    });

    return precioEnRango?.precio || null;
  } else {
    // Buscar precio por cantidad exacta (comportamiento original)
    const { data, error } = await (supabase as any)
      .from('productos_impresion_laser_precios')
      .select('precio')
      .eq('producto_laser_id', productId)
      .eq('medida_ancho', config.medida_ancho)
      .eq('medida_alto', config.medida_alto)
      .eq('tinta', config.tinta)
      .eq('cantidad', config.cantidad)
      .eq('cara_impresa', config.cara_impresa)
      .maybeSingle();

    if (error) {
      console.error('Error buscando precio laser por cantidad exacta:', error);
      return null;
    }

    return data?.precio || null;
  }
}

async function getPrecioGranFormato(
  productId: string,
  config: SelectedConfiguration
): Promise<number | null> {
  if (!config.tinta) {
    return null;
  }

  // Para gran formato, buscar en rangos de precio
  const { data: rawData, error } = await (supabase as any)
    .from('productos_gran_formato_precios')
    .select('precio, rango_precio_min, rango_precio_max')
    .eq('producto_gran_formato_id', productId)
    .eq('tinta', config.tinta);

  const data = (rawData as any[]) || [];

  if (error) {
    console.error('Error buscando precio gran formato:', error);
    return null;
  }

  if (!data || data.length === 0) return null;

  // Calcular metros cuadrados
  const mt2 = config.medida_ancho && config.medida_alto
    ? (config.medida_ancho / 100) * (config.medida_alto / 100)
    : 1;

  // Buscar en qué rango cae
  const precioEnRango = data.find((p: any) => {
    const min = p.rango_precio_min;
    const max = p.rango_precio_max;
    return max === null ? config.cantidad >= min : (config.cantidad >= min && config.cantidad <= max);
  });

  return precioEnRango ? precioEnRango.precio * mt2 : null;
}

async function getPrecioMaterialesRigidos(
  productId: string,
  config: SelectedConfiguration
): Promise<number | null> {
  if (!config.material_id || !config.espesor) {
    console.warn('⚠️ Missing config for MR:', config);
    return null;
  }

  console.log('🔍 MR Pricing Query params:', {
    producto_materiales_rigidos_id: productId,
    material_id: config.material_id,
    variante_nombre: config.variante_nombre,
    espesor: config.espesor
  });

  const { data: rawData, error } = await supabase
    .from('productos_materiales_rigidos_precios')
    .select('precio_mt2')
    .eq('producto_materiales_rigidos_id', productId)
    .eq('material_id', config.material_id)
    .eq('variante_nombre', config.variante_nombre)
    .eq('espesor', config.espesor)
    .maybeSingle();

  const data = (rawData as any);

  if (error) {
    console.error('Error buscando precio materiales rígidos:', error);
    return null;
  }

  if (!data) return null;

  // Calcular por mt2
  const mt2 = config.medida_ancho && config.medida_alto
    ? (config.medida_ancho / 100) * (config.medida_alto / 100)
    : 1;

  // MR tiene precio único por combinación, no rangos
  // La cantidad_minima se aplica a nivel de UI o en el cálculo de múltiples líneas
  return (data as any).precio_mt2 * mt2;
}

async function getPrecioPlotterCorte(
  productId: string,
  config: SelectedConfiguration
): Promise<number | null> {
  if (!config.medida_ancho) {
    return null;
  }

  const { data: rawData, error } = await supabase
    .from('productos_plotter_corte_precios')
    .select('precio, cantidad_desde, cantidad_hasta')
    .eq('producto_id', productId)
    .eq('ancho', config.medida_ancho);

  const data = (rawData as any[]) || [];

  if (error) {
    console.error('Error buscando precio plotter corte:', error);
    return null;
  }

  if (!data || data.length === 0) return null;

  // Buscar en qué rango cae
  const precioEnRango = data.find(p => {
    if (p.cantidad_hasta === null) {
      return config.cantidad >= p.cantidad_desde;
    }
    return config.cantidad >= p.cantidad_desde && config.cantidad <= p.cantidad_hasta;
  });

  if (!precioEnRango) return null;

  // Precio por metro lineal
  const metrosLineales = config.medida_alto ? config.medida_alto / 100 : 1;
  return precioEnRango.precio * metrosLineales;
}

async function getPrecioPortabanners(
  productId: string,
  config: SelectedConfiguration
): Promise<number | null> {
  if (!config.tecnologia_id) {
    return null;
  }

  const { data, error } = await (supabase as any)
    .from('productos_portabanners_precios')
    .select('precio, cantidad_desde, cantidad_hasta')
    .eq('producto_id', productId)
    .eq('tecnologia_id', config.tecnologia_id);

  if (error) {
    console.error('Error buscando precio portabanners:', error);
    return null;
  }

  if (!data || data.length === 0) return null;

  // Buscar en qué rango cae
  const precioEnRango = data.find(p => {
    if (p.cantidad_hasta === null) {
      return config.cantidad >= p.cantidad_desde;
    }
    return config.cantidad >= p.cantidad_desde && config.cantidad <= p.cantidad_hasta;
  });

  return precioEnRango?.precio || null;
}

async function getPrecioSellos(
  productId: string,
  config: SelectedConfiguration
): Promise<number | null> {
  const { data, error } = await (supabase as any)
    .from('productos_sellos_precios')
    .select('precio_unitario')
    .eq('producto_id', productId)
    .maybeSingle();

  if (error) {
    console.error('Error buscando precio sellos:', error);
    return null;
  }

  if (!data) return null;

  return data.precio_unitario;
}

async function getPrecioTalonarios(
  productId: string,
  config: SelectedConfiguration
): Promise<number | null> {
  if (!config.medida_ancho || !config.medida_alto || !config.tinta || !config.tipo_copia) {
    return null;
  }

  const { data, error } = await (supabase as any)
    .from('productos_talonarios_precios')
    .select('precio')
    .eq('producto_talonario_id', productId)
    .eq('medida_ancho', config.medida_ancho)
    .eq('medida_alto', config.medida_alto)
    .eq('tinta', config.tinta)
    .eq('cantidad', config.cantidad)
    .eq('tipo_copia', config.tipo_copia)
    .maybeSingle();

  if (error) {
    console.error('Error buscando precio talonarios:', error);
    return null;
  }

  return data?.precio || null;
}

async function getBasePriceInternal(
  productId: string,
  categoria: ProductCategory,
  config: SelectedConfiguration,
  companyId?: string | null | undefined
): Promise<number | null> {
  switch (categoria) {
    case 'Impresion Laser':
      return await getPrecioImpresionLaser(productId, config);
    case 'Impresion Gran Formato':
      return await getPrecioGranFormato(productId, config);
    case 'Materiales Rigidos':
      return await getPrecioMaterialesRigidos(productId, config);
    case 'Plotter de Corte':
      return await getPrecioPlotterCorte(productId, config);
    case 'Portabanners':
      return await getPrecioPortabanners(productId, config);
    case 'Sellos':
      return await getPrecioSellos(productId, config);
    case 'Talonarios':
      return await getPrecioTalonarios(productId, config);
    case 'Centro de Copiado':
      return await getPrecioCentroCopiado(config, companyId);
    default:
      return null;
  }
}

async function getPrecioCentroCopiado(
  config: any,
  companyId?: string | null | undefined
): Promise<number | null> {
  if (!companyId) return null;

  try {
    // Extraer datos básicos
    const {
      tamanio_papel_id,
      papel_id,
      tipo_tinta,
      cara_impresa,
      cantidad_hojas = 0
    } = config;

    // La cantidad total de copias para el cálculo de rangos es 'cantidad' (inyectada por el motor de pricing)
    const totalCopias = config.cantidad || config.cantidad_copias || 1;
    const totalHojasParaRango = (cantidad_hojas || 0) * totalCopias;

    if (!tamanio_papel_id || !papel_id || !tipo_tinta || !cara_impresa) {
      return null;
    }

    // 1. Obtener rango de impresión aplicable
    const { data: rangosImp } = await (supabase as any)
      .from('centro_copiado_rangos_precio_impresion')
      .select('*')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .order('hojas_desde', { ascending: true });

    if (!rangosImp || rangosImp.length === 0) {
      console.error('[getPrecioCentroCopiado] No ranges found');
      return null;
    }

    const rangoAplicable = rangosImp.find((r: any) =>
      totalHojasParaRango >= r.hojas_desde &&
      (r.hojas_hasta === null || totalHojasParaRango <= r.hojas_hasta)
    );

    if (!rangoAplicable) {
      console.warn('[getPrecioCentroCopiado] No matching range for', totalHojasParaRango, 'sheets');
      return null;
    }

    // 2. Obtener precio de impresión
    const { data: precioRecord } = await (supabase as any)
      .from('centro_copiado_precios_impresion')
      .select('precio')
      .eq('company_id', companyId)
      .eq('tamanio_papel_id', tamanio_papel_id)
      .eq('papel_id', papel_id)
      .eq('tipo_tinta', tipo_tinta)
      .eq('cara_impresa', cara_impresa)
      .eq('rango_precio_id', rangoAplicable.id)
      .maybeSingle();

    if (!precioRecord) {
      console.warn('[getPrecioCentroCopiado] No price found in matrix');
      return null;
    }

    const precioImpresionUnitario = Number(precioRecord.precio);
    const subtotalImpresionTotal = precioImpresionUnitario * totalHojasParaRango;

    // 3. Calcular Terminaciones (Anillado, Plastificado, Guillotinado)
    let totalTerminaciones = 0;

    // Anillado
    const anillado = config.anillado || config.terminacion_anillado;
    if (anillado && anillado.tipo) {
      const { data: rangosAn } = await (supabase as any)
        .from('centro_copiado_rangos_anillado')
        .select('*')
        .eq('company_id', companyId)
        .eq('is_active', true);

      const rAn = (rangosAn || []).find((r: any) =>
        cantidad_hojas >= r.hojas_desde && (r.hojas_hasta === null || cantidad_hojas <= r.hojas_hasta)
      );
      if (rAn) {
        const pUnit = anillado.tipo === 'ring_wire' ? rAn.precio_ring_wire : rAn.precio_plastico;
        totalTerminaciones += Number(pUnit) * totalCopias;
      }
    }

    // Plastificado
    const plastificado = config.plastificado || config.terminacion_plastificado;
    if (plastificado && plastificado.tipo) {
      const { data: plasRecords } = await (supabase as any)
        .from('centro_copiado_plastificados')
        .select('*')
        .eq('company_id', companyId)
        .eq('tipo', plastificado.tipo)
        .eq('is_active', true);

      const cantHojasP = plastificado.cantidad_especifica || cantidad_hojas || 0;
      const rPl = (plasRecords || []).find((r: any) =>
        cantHojasP >= r.unidades_desde && (r.unidades_hasta === null || cantHojasP <= r.unidades_hasta)
      );
      if (rPl) {
        totalTerminaciones += Number(rPl.precio) * cantHojasP * totalCopias;
      }
    }

    // Guillotinado
    if (config.guillotinado || config.con_guillotinado) {
      const { data: rangosGui } = await (supabase as any)
        .from('centro_copiado_rangos_guillotinado')
        .select('*')
        .eq('company_id', companyId)
        .eq('is_active', true);

      const rGui = (rangosGui || []).find((r: any) =>
        cantidad_hojas >= r.hojas_desde && (r.hojas_hasta === null || cantidad_hojas <= r.hojas_hasta)
      );
      if (rGui) {
        totalTerminaciones += Number(rGui.precio) * totalCopias;
      }
    }

    const totalFinal = subtotalImpresionTotal + totalTerminaciones;
    console.log('[getPrecioCentroCopiado] Result:', { totalFinal, unitPerCopy: totalFinal / totalCopias });

    return totalFinal / totalCopias; // Devolvemos el unitario por copia (que es lo que el motor espera sumar)
  } catch (err) {
    console.error('[getPrecioCentroCopiado] Error:', err);
    return null;
  }
}

async function getPrecioPersonalizado(
  productId: string,
  config: SelectedConfiguration,
  companyId?: string | null | undefined
): Promise<{ totalPrice: number; updatedComponents: any[] } | null> {
  console.log('[getPrecioPersonalizado] Starting calculation for Product:', productId, 'Total Order Qty:', config.cantidad);

  // Intentar cargar componentes desde la base de datos (para productos guardados en catálogo)
  const { data: dbComponentes, error } = await (supabase as any)
    .from('producto_personalizado_componentes')
    .select('configuracion, cantidad_por_unidad, tipo_componente, referencia_id, nombre_personalizado')
    .eq('producto_personalizado_id', productId);

  // Mapear componentes ya sea de DB o de la config local (wizard)
  const componentesFinales = (dbComponentes && dbComponentes.length > 0)
    ? dbComponentes.map((c: any) => ({
      nombre: c.nombre_personalizado,
      tipo_componente: c.tipo_componente,
      referencia_id: c.referencia_id,
      cantidad: c.cantidad_por_unidad,
      configuracion: c.configuracion
    }))
    : (config.componentes || []);

  if (componentesFinales.length === 0) {
    console.warn('[getPrecioPersonalizado] No components found for product:', productId);
    return null;
  }

  let totalAcumuladoPerUnit = 0;

  for (const comp of componentesFinales) {
    const category = mapTipoToCategory(comp.tipo_componente);
    const subConfig = comp.configuracion || comp.config;

    // Cantidad total para este componente = (Cant. Producto) * (Cant. Componente por Unidad)
    const totalComponentQty = (config.cantidad || 1) * (comp.cantidad || 1);

    console.log(`[getPrecioPersonalizado] -> Processing Component: "${comp.nombre}" (${comp.tipo_componente})`);
    console.log(`[getPrecioPersonalizado]    Multiplier: ${comp.cantidad}, Total Qty for calculation: ${totalComponentQty}`);

    if (category) {
      // Inyectamos la cantidad total calculada para que el catálogo aplique el rango (tier) correcto
      const specializedConfig = { ...subConfig, cantidad: totalComponentQty };

      const precioUnitarioCatalogo = await getBasePriceInternal(comp.referencia_id, category, specializedConfig, companyId);

      console.log(`[getPrecioPersonalizado]    Catalog Price Result (unit): $${precioUnitarioCatalogo}`);

      let precioAUsar = 0;
      if (precioUnitarioCatalogo !== null) {
        precioAUsar = precioUnitarioCatalogo;
      } else {
        // Fallback al precio guardado en la configuración si no está en catálogo (ej. centro de copiado)
        // Buscamos precio_total, precio_unitario o precio en ese orden
        precioAUsar = subConfig?.precio_total || subConfig?.precio || comp.precio || 0;
        console.log(`[getPrecioPersonalizado]    Catalog failed/missing, using fallback: $${precioAUsar}`);
      }

      // Sumamos al costo base unitario del producto padre
      totalAcumuladoPerUnit += (precioAUsar || 0) * (comp.cantidad || 1);

      // Guardamos el precio unitario calculado en el componente para retornarlo
      comp.precio = precioAUsar;
    } else {
      // Fallback para servicios o tipos no categorizados (usan el precio guardado en el constructor)
      const precioGuardado = subConfig?.precio_total || comp.precio || 0;
      console.log(`[getPrecioPersonalizado]    Non-catalog fallback price: $${precioGuardado}`);
      totalAcumuladoPerUnit += (precioGuardado || 0) * (comp.cantidad || 1);
      comp.precio = precioGuardado;
    }
  }

  console.log('[getPrecioPersonalizado] Final Computed Base Price (per unit): $', totalAcumuladoPerUnit);
  return {
    totalPrice: totalAcumuladoPerUnit,
    updatedComponents: componentesFinales
  };
}

export function mapTipoToCategory(tipo: string): ProductCategory | null {
  const t = tipo.toLowerCase();
  switch (t) {
    case 'laser':
    case 'impresion_laser':
    case 'catalogo':
    case 'catálogo':
      return 'Impresion Laser';
    case 'gran_formato':
    case 'impresion_gran_formato':
      return 'Impresion Gran Formato';
    case 'materiales_rigidos':
    case 'materiales_rigidos_uv':
    case 'rigido':
    case 'rígido':
      return 'Materiales Rigidos';
    case 'plotter':
    case 'plotter_corte':
      return 'Plotter de Corte';
    case 'portabanners':
    case 'banner':
      return 'Portabanners';
    case 'sellos':
    case 'sello':
      return 'Sellos';
    case 'talonarios':
    case 'talonario':
      return 'Talonarios';
    case 'centro_copiado':
    case 'copiado':
      return 'Centro de Copiado';
    default:
      return null;
  }
}


// ===============================================
// FUNCIÓN PARA CALCULAR IMPACTO SEGÚN TIPO
// ===============================================

/**
 * Calcula el impacto TOTAL de un servicio o acabado según su tipo de impacto
 * @param tipoImpacto - Tipo de impacto del servicio/acabado
 * @param valorMonto - Valor en monto fijo (si aplica)
 * @param valorPorcentaje - Valor en porcentaje (si aplica)
 * @param precioBaseTotal - Precio base TOTAL del producto (para toda la cantidad)
 * @param mt2 - Metros cuadrados del producto
 * @param metrosLineales - Metros lineales del producto
 * @param cantidad - Cantidad del producto
 * @returns El precio TOTAL a sumar por este servicio/acabado (se dividirá por cantidad después)
 */
export function calcularImpacto(
  tipoImpacto: string,
  valorMonto: number | null,
  valorPorcentaje: number | null,
  precioBaseTotal: number,
  mt2: number,
  metrosLineales: number,
  cantidad: number, // Cantidad global del producto
  cantidadServicio: number = 1 // Cantidad específica del servicio (ej. minutos, u otras unidades)
): number {
  switch (tipoImpacto) {
    case 'precio_fijo':
      // Precio fijo se suma directamente al total
      return valorMonto || 0;

    case 'por_unidad':
      // Precio por unidad se multiplica por la cantidad
      return valorMonto ? valorMonto * cantidad : 0;

    case 'porcentual':
      // Porcentaje sobre el precio base TOTAL
      return valorPorcentaje ? (precioBaseTotal * valorPorcentaje) / 100 : 0;

    case 'por_mt2':
      // Precio por metro cuadrado multiplicado por los mt2 y por la cantidad
      return valorMonto && mt2 ? valorMonto * mt2 * cantidad : 0;

    case 'por_metro_lineal':
      // Precio por metro lineal multiplicado por los metros lineales y por la cantidad
      return valorMonto && metrosLineales ? valorMonto * metrosLineales * cantidad : 0;

    case 'fijo_porcentual':
      // Precio fijo + porcentaje del precio base total
      const fijo = valorMonto || 0;
      const porcentual = valorPorcentaje ? (precioBaseTotal * valorPorcentaje) / 100 : 0;
      return fijo + porcentual;

    case 'fijo_metro_cuadrado':
    case 'fijo_mt2':
    case 'fijo_m2':
      // Precio fijo + precio por mt2 multiplicado por cantidad
      const fijoMt2 = valorMonto || 0;
      const porMt2 = valorPorcentaje && mt2 ? valorPorcentaje * mt2 * cantidad : 0;
      return fijoMt2 + porMt2;

    case 'fijo_metro_lineal':
    case 'fijo_mt_lineal':
      // Precio fijo + precio por metro lineal multiplicado por cantidad
      const fijoMl = valorMonto || 0;
      const porMl = valorPorcentaje && metrosLineales ? valorPorcentaje * metrosLineales * cantidad : 0;
      return fijoMl + porMl;

    case 'por_minuto':
      // Precio por minuto * minutos (Costo TOTAL por la línea, no por unidad)
      // NO se multiplica por cantidad global porque es un servicio de tiempo único
      return valorMonto ? valorMonto * cantidadServicio : 0;

    case 'fijo_minuto':
    case 'fijo_por_minuto':
      // (Precio Fijo + (Precio Minuto * minutos)) (Costo TOTAL por la línea)
      // Asumimos: valorMonto = Fijo, valorPorcentaje = Precio Minuto
      const fijoMin = valorMonto || 0;
      const varMin = valorPorcentaje ? valorPorcentaje * cantidadServicio : 0;
      return fijoMin + varMin;

    case 'sin_impacto':
    default:
      return 0;
  }
}

// ===============================================
// FUNCIÓN PARA DETERMINAR PRECIO POR UNIDAD SEGÚN RANGO
// ===============================================

/**
 * Determina el precio por unidad (MT2 o metro lineal) basado en el total acumulado
 * de todas las líneas. Esto asegura que se use el rango de precio correcto cuando
 * hay múltiples líneas que suman un volumen mayor.
 *
 * @param productId - ID del producto
 * @param categoria - Categoría del producto
 * @param totalMT2 - Total acumulado de MT2 de todas las líneas
 * @param totalMetrosLineales - Total acumulado de metros lineales de todas las líneas
 * @param baseConfig - Configuración base (material, tecnología, tinta, etc.)
 * @param tipoVentaReal - Tipo de venta real del producto
 * @returns Precio por unidad del rango correcto, o null si no se encuentra
 */
export async function determinarPrecioPorUnidadRango(
  productId: string,
  categoria: ProductCategory,
  totalMT2: number,
  totalMetrosLineales: number,
  baseConfig: Omit<SelectedConfiguration, 'lineas_medidas'>,
  tipoVentaReal?: 'mt2' | 'mt_lineal' | 'unidad' | 'cantidades_fijas'
): Promise<number | null> {
  try {
    let rangos: any[] = [];
    let valorParaRango = 0;

    switch (categoria) {
      case 'Impresion Gran Formato': {
        if (!baseConfig.tinta) return null;

        const { data, error } = await supabase
          .from('productos_gran_formato_precios')
          .select('precio, rango_precio_min, rango_precio_max')
          .eq('producto_gran_formato_id', productId)
          .eq('tinta', baseConfig.tinta);

        if (error || !data || data.length === 0) return null;

        rangos = data;
        valorParaRango = tipoVentaReal === 'mt2' ? totalMT2 : totalMetrosLineales;
        break;
      }

      case 'Materiales Rigidos': {
        if (!baseConfig.material_id || !baseConfig.espesor) return null;

        const { data, error } = await supabase
          .from('productos_materiales_rigidos_precios')
          .select('precio_mt2')
          .eq('producto_materiales_rigidos_id', productId)
          .eq('material_id', baseConfig.material_id)
          .eq('variante_nombre', baseConfig.variante_nombre)
          .eq('espesor', baseConfig.espesor)
          .single();

        if (error || !data) return null;

        // MR NO usa rangos, tiene precio único por combinación
        // Retornar directamente el precio_mt2
        return data.precio_mt2;
      }

      case 'Plotter de Corte': {
        if (!baseConfig.medida_ancho) return null;

        const { data, error } = await supabase
          .from('productos_plotter_corte_precios')
          .select('precio, cantidad_desde, cantidad_hasta')
          .eq('producto_id', productId)
          .eq('ancho', baseConfig.medida_ancho);

        if (error || !data || data.length === 0) return null;

        rangos = data;
        valorParaRango = totalMetrosLineales;
        break;
      }

      default:
        // Para otras categorías, no aplicamos lógica de rangos acumulados
        return null;
    }

    // Buscar el rango que contiene el valor acumulado
    // Nota: Los nombres de campos varían según la categoría
    let rangoAplicable;

    if (categoria === 'Plotter de Corte') {
      // Plotter usa cantidad_desde y cantidad_hasta
      rangoAplicable = rangos.find(r =>
        valorParaRango >= r.cantidad_desde &&
        (r.cantidad_hasta === null || valorParaRango <= r.cantidad_hasta)
      );
    } else if (categoria === 'Impresion Gran Formato') {
      // Gran Formato usa rango_precio_min y rango_precio_max
      rangoAplicable = rangos.find(r =>
        valorParaRango >= r.rango_precio_min &&
        (r.rango_precio_max === null || valorParaRango <= r.rango_precio_max)
      );
    }

    if (!rangoAplicable) {
      console.warn(`No se encontró rango para valor: ${valorParaRango} en categoría: ${categoria}`);
      return null;
    }

    // Console.log también específico según categoría
    const rangoStr = categoria === 'Plotter de Corte'
      ? `${rangoAplicable.cantidad_desde}-${rangoAplicable.cantidad_hasta || '∞'}`
      : `${rangoAplicable.rango_precio_min}-${rangoAplicable.rango_precio_max || '∞'}`;

    console.log(`✅ Rango determinado para ${categoria}:`, {
      valorParaRango,
      rango: rangoStr,
      precioPorUnidad: rangoAplicable.precio
    });

    return rangoAplicable.precio;
  } catch (error) {
    console.error('Error determinando precio por unidad del rango:', error);
    return null;
  }
}

// ===============================================
// FUNCIÓN PARA CALCULAR PRECIO DE UNA LÍNEA INDIVIDUAL
// ===============================================

/**
 * Calcula el precio de una línea individual de medida/cantidad
 * @param productId - ID del producto
 * @param categoria - Categoría del producto
 * @param line - Línea con medidas, cantidad, servicios y acabados
 * @param baseConfig - Configuración base (material, tecnología, etc.)
 * @param allServicios - Todos los servicios disponibles
 * @param allAcabados - Todos los acabados disponibles
 * @param tipoVentaReal - Tipo de venta real del producto
 * @param precioPorUnidadRango - Precio por unidad determinado por el rango total (opcional)
 * @returns Precio calculado para la línea
 */
export async function calculateLinePrice(
  productId: string,
  categoria: ProductCategory,
  line: MeasurementLine,
  baseConfig: Omit<SelectedConfiguration, 'lineas_medidas'>,
  allServicios: SelectedService[],
  allAcabados: SelectedFinishing[],
  tipoVentaReal?: 'mt2' | 'mt_lineal' | 'unidad' | 'cantidades_fijas',
  precioPorUnidadRango?: number,
  factorAjuste?: number  // Factor de ajuste para aplicar cantidad_minima al total (1 = sin ajuste, > 1 = con mínimo)
): Promise<{
  precio_base_unitario: number;
  precio_servicios_unitario: number;
  precio_acabados_unitario: number;
  precio_unitario_final: number;
  precio_total_linea: number;
} | null> {
  try {
    // Crear configuración temporal para esta línea
    const lineConfig: SelectedConfiguration = {
      ...baseConfig,
      lineas_medidas: [],
      cantidad: line.cantidad,
      medida_ancho: line.ancho || line.ancho_seleccionado || null,
      medida_alto: line.alto || null,
      medida_mt2: line.mt2_calculado || null
    };

    // Calcular precio base según categoría
    let precioBaseUnitario: number | null = null;

    switch (categoria) {
      case 'Impresion Gran Formato':
        precioBaseUnitario = await getPrecioGranFormatoLine(productId, lineConfig, line, tipoVentaReal, precioPorUnidadRango, factorAjuste);
        break;
      case 'Materiales Rigidos':
        precioBaseUnitario = await getPrecioMaterialesRigidosLine(productId, lineConfig, line, precioPorUnidadRango, factorAjuste);
        break;
      case 'Plotter de Corte':
        precioBaseUnitario = await getPrecioPlotterCorteLine(productId, lineConfig, line, precioPorUnidadRango, factorAjuste);
        break;
      default:
        // Para otras categorías, usar el método tradicional
        switch (categoria) {
          case 'Impresion Laser':
            precioBaseUnitario = await getPrecioImpresionLaser(productId, lineConfig);
            break;
          case 'Portabanners':
            precioBaseUnitario = await getPrecioPortabanners(productId, lineConfig);
            break;
          case 'Sellos':
            precioBaseUnitario = await getPrecioSellos(productId, lineConfig);
            break;
          case 'Talonarios':
            precioBaseUnitario = await getPrecioTalonarios(productId, lineConfig);
            break;
        }
    }

    if (precioBaseUnitario === null) {
      return null;
    }

    const precioBaseTotal = precioBaseUnitario * line.cantidad;

    // Calcular MT2 y metros lineales para esta línea
    const mt2 = line.mt2_calculado || 0;
    const metrosLineales = line.metros_lineales || 0;

    // Usar servicios y acabados directamente de la línea
    const serviciosLinea = line.servicios || [];
    const acabadosLinea = line.acabados || [];

    // Calcular impacto de servicios
    let precioServiciosTotal = 0;
    for (const servicio of serviciosLinea) {
      const impacto = calcularImpacto(
        servicio.tipo_impacto,
        servicio.valor_monto ?? servicio.valor_impacto ?? 0,
        servicio.valor_porcentaje ?? servicio.valor_impacto_secundario ?? 0,
        precioBaseTotal,
        mt2,
        metrosLineales,
        line.cantidad,
        servicio.cantidad // Cantidad específica del servicio (ej. minutos)
      );
      precioServiciosTotal += impacto;
    }

    // Calcular impacto de acabados
    let precioAcabadosTotal = 0;
    for (const acabado of acabadosLinea) {
      const impacto = calcularImpacto(
        acabado.tipo_impacto,
        acabado.valor_monto ?? acabado.valor_impacto ?? 0,
        acabado.valor_porcentaje ?? acabado.valor_impacto_secundario ?? 0,
        precioBaseTotal,
        mt2,
        metrosLineales,
        line.cantidad,
        acabado.cantidad // Cantidad específica del acabado
      );
      precioAcabadosTotal += impacto;
    }

    // Calcular precios unitarios y totales
    const precioServiciosUnitario = precioServiciosTotal / line.cantidad;
    const precioAcabadosUnitario = precioAcabadosTotal / line.cantidad;
    const precioUnitarioFinal = precioBaseUnitario + precioServiciosUnitario + precioAcabadosUnitario;
    const precioTotalLinea = precioBaseTotal + precioServiciosTotal + precioAcabadosTotal;

    return {
      precio_base_unitario: precioBaseUnitario,
      precio_servicios_unitario: precioServiciosUnitario,
      precio_acabados_unitario: precioAcabadosUnitario,
      precio_unitario_final: precioUnitarioFinal,
      precio_total_linea: precioTotalLinea
    };
  } catch (error) {
    console.error('Error calculando precio de línea:', error);
    return null;
  }
}

// Funciones auxiliares para calcular precio base por línea

async function getPrecioGranFormatoLine(
  productId: string,
  config: SelectedConfiguration,
  line: MeasurementLine,
  tipoVentaReal?: string,
  precioPorUnidadRango?: number,
  factorAjuste?: number
): Promise<number | null> {
  if (!config.tinta) return null;

  // Si se proporciona precio del rango correcto (calculado con totales acumulados), usarlo
  if (precioPorUnidadRango !== undefined && precioPorUnidadRango !== null) {
    if (tipoVentaReal === 'mt2') {
      const mt2Real = line.mt2_calculado || 0;
      // Aplicar factor de ajuste (si el total acumulado era menor al mínimo)
      const mt2ParaPrecio = factorAjuste ? mt2Real * factorAjuste : mt2Real;
      return precioPorUnidadRango * mt2ParaPrecio;
    } else {
      const metrosReales = line.metros_lineales || 0;
      // Aplicar factor de ajuste
      const metrosParaPrecio = factorAjuste ? metrosReales * factorAjuste : metrosReales;
      return precioPorUnidadRango * metrosParaPrecio;
    }
  }

  // Fallback: lógica original (para compatibilidad con código que no usa múltiples líneas)
  const { data, error } = await supabase
    .from('productos_gran_formato_precios')
    .select('precio, rango_precio_min, rango_precio_max')
    .eq('producto_gran_formato_id', productId)
    .eq('tinta', config.tinta);

  if (error || !data || data.length === 0) return null;

  // Buscar precio en rango según cantidad de la línea
  const precioRango = data.find(p =>
    line.cantidad >= p.rango_precio_min &&
    (p.rango_precio_max === null || line.cantidad <= p.rango_precio_max)
  );

  if (!precioRango) return null;

  // Determinar si es MT2 o Metro Lineal
  if (tipoVentaReal === 'mt2') {
    const mt2Real = line.mt2_calculado || 0;
    // Aplicar factor de ajuste
    const mt2ParaPrecio = factorAjuste ? mt2Real * factorAjuste : mt2Real;
    return precioRango.precio * mt2ParaPrecio;
  } else {
    const metrosReales = line.metros_lineales || 0;
    // Aplicar factor de ajuste
    const metrosParaPrecio = factorAjuste ? metrosReales * factorAjuste : metrosReales;
    return precioRango.precio * metrosParaPrecio;
  }
}

async function getPrecioMaterialesRigidosLine(
  productId: string,
  config: SelectedConfiguration,
  line: MeasurementLine,
  precioPorUnidadRango?: number,
  factorAjuste?: number
): Promise<number | null> {
  if (!config.material_id || !config.espesor) return null;

  // Si se proporciona precio del rango correcto (calculado con totales acumulados), usarlo
  if (precioPorUnidadRango !== undefined && precioPorUnidadRango !== null) {
    const mt2Real = line.mt2_calculado || 0;
    // Aplicar factor de ajuste
    const mt2ParaPrecio = factorAjuste ? mt2Real * factorAjuste : mt2Real;
    return precioPorUnidadRango * mt2ParaPrecio;
  }

  // Fallback: lógica original (para compatibilidad con código que no usa múltiples líneas)
  const { data, error } = await supabase
    .from('productos_materiales_rigidos_precios')
    .select('precio_mt2')
    .eq('producto_materiales_rigidos_id', productId)
    .eq('material_id', config.material_id)
    .eq('variante_nombre', config.variante_nombre)
    .eq('espesor', config.espesor)
    .single();

  if (error || !data) return null;

  // MR tiene precio único, no rangos
  // Precio es por MT2
  const mt2Real = line.mt2_calculado || 0;
  // Aplicar factor de ajuste
  const mt2ParaPrecio = factorAjuste ? mt2Real * factorAjuste : mt2Real;
  return data.precio_mt2 * mt2ParaPrecio;
}

async function getPrecioPlotterCorteLine(
  productId: string,
  config: SelectedConfiguration,
  line: MeasurementLine,
  precioPorUnidadRango?: number,
  factorAjuste?: number
): Promise<number | null> {
  if (!config.medida_ancho) return null;

  // Si se proporciona precio del rango correcto (calculado con totales acumulados), usarlo
  if (precioPorUnidadRango !== undefined && precioPorUnidadRango !== null) {
    const metrosReales = line.metros_lineales || 0;
    // Aplicar factor de ajuste
    const metrosParaPrecio = factorAjuste ? metrosReales * factorAjuste : metrosReales;
    return precioPorUnidadRango * metrosParaPrecio;
  }

  // Fallback: lógica original (para compatibilidad con código que no usa múltiples líneas)
  const { data, error } = await supabase
    .from('productos_plotter_corte_precios')
    .select('precio, cantidad_desde, cantidad_hasta')
    .eq('producto_id', productId)
    .eq('ancho', config.medida_ancho);

  if (error || !data || data.length === 0) return null;

  // Buscar precio en rango según cantidad de la línea
  const precioRango = data.find(p =>
    line.cantidad >= p.cantidad_desde &&
    (p.cantidad_hasta === null || line.cantidad <= p.cantidad_hasta)
  );

  if (!precioRango) return null;

  // Precio es por metro lineal
  const metrosReales = line.metros_lineales || 0;
  // Aplicar factor de ajuste
  const metrosParaPrecio = factorAjuste ? metrosReales * factorAjuste : metrosReales;
  return precioRango.precio * metrosParaPrecio;
}
