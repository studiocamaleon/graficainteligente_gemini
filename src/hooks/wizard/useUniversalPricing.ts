import { useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import type { ProductCategory } from './useUniversalProductSearch';
import type { SelectedConfiguration, MeasurementLine } from '../../components/wizard/steps/ConfigurationStep';
import type { SelectedService, SelectedFinishing } from '../../components/wizard/steps/ServicesAndFinishingsStep';

export interface PriceCalculationResult {
  precio_base: number | null;
  precio_servicios: number;
  precio_acabados: number;
  precio_total: number | null;
  tiene_precio: boolean;
}

export function useUniversalPricing() {
  const [isCalculating, setIsCalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const calculatePrice = useCallback(async (
    productId: string,
    categoria: ProductCategory,
    config: SelectedConfiguration,
    servicios: SelectedService[],
    acabados: SelectedFinishing[],
    cantidadesFijas?: number[]
  ): Promise<PriceCalculationResult> => {
    setIsCalculating(true);
    setError(null);

    try {
      let precioBase: number | null = null;

      // Buscar precio base según la categoría
      switch (categoria) {
        case 'Impresion Laser':
          precioBase = await getPrecioImpresionLaser(productId, config);
          break;
        case 'Impresion Gran Formato':
          precioBase = await getPrecioGranFormato(productId, config);
          break;
        case 'Materiales Rigidos':
          precioBase = await getPrecioMaterialesRigidos(productId, config);
          break;
        case 'Plotter de Corte':
          precioBase = await getPrecioPlotterCorte(productId, config);
          break;
        case 'Portabanners':
          precioBase = await getPrecioPortabanners(productId, config);
          break;
        case 'Sellos':
          precioBase = await getPrecioSellos(productId, config);
          break;
      }

      if (precioBase === null) {
        return {
          precio_base: null,
          precio_servicios: 0,
          precio_acabados: 0,
          precio_total: null,
          tiene_precio: false
        };
      }

      // Para productos con cantidades fijas, el precio base es para toda la cantidad
      // Para productos con cantidades variables, el precio base ya es unitario
      const esCantidadFija = cantidadesFijas && cantidadesFijas.length > 0;
      const precioBaseTotal = esCantidadFija ? precioBase : precioBase * config.cantidad;
      const precioBaseUnitario = esCantidadFija ? precioBase / config.cantidad : precioBase;

      // Calcular metros cuadrados y lineales si es necesario
      const mt2 = config.medida_ancho && config.medida_alto
        ? (config.medida_ancho / 100) * (config.medida_alto / 100)
        : 0;
      const metrosLineales = config.medida_alto ? config.medida_alto / 100 : 0;

      // Calcular impacto de servicios según su tipo de impacto
      // Los impactos se calculan sobre el PRECIO BASE TOTAL y luego se dividen por cantidad
      let precioServiciosTotal = 0;
      for (const servicio of servicios) {
        console.log('🔍 Calculando servicio:', {
          nombre: servicio.servicio_nombre,
          tipo_impacto: servicio.tipo_impacto,
          valor_monto: servicio.valor_monto,
          valor_porcentaje: servicio.valor_porcentaje,
          precioBaseTotal,
          precioBaseUnitario,
          mt2,
          metrosLineales,
          cantidad: config.cantidad
        });

        const impacto = calcularImpacto(
          servicio.tipo_impacto,
          servicio.valor_monto,
          servicio.valor_porcentaje,
          precioBaseTotal,
          mt2,
          metrosLineales,
          config.cantidad
        );

        console.log('💰 Impacto total calculado:', impacto, '| Unitario:', impacto / config.cantidad);
        precioServiciosTotal += impacto;
      }

      // Calcular impacto de acabados según su tipo de impacto
      let precioAcabadosTotal = 0;
      for (const acabado of acabados) {
        const impacto = calcularImpacto(
          acabado.tipo_impacto,
          acabado.valor_monto,
          acabado.valor_porcentaje,
          precioBaseTotal,
          mt2,
          metrosLineales,
          config.cantidad
        );
        precioAcabadosTotal += impacto;
      }

      // Convertir a precios unitarios
      const precioServiciosUnitario = precioServiciosTotal / config.cantidad;
      const precioAcabadosUnitario = precioAcabadosTotal / config.cantidad;
      const precioTotalUnitario = precioBaseUnitario + precioServiciosUnitario + precioAcabadosUnitario;

      console.log('📊 Resultado final:', {
        precio_base_unitario: precioBaseUnitario,
        precio_servicios_unitario: precioServiciosUnitario,
        precio_acabados_unitario: precioAcabadosUnitario,
        precio_total_unitario: precioTotalUnitario,
        precio_total_completo: precioTotalUnitario * config.cantidad
      });

      // Devolvemos los precios unitarios
      return {
        precio_base: precioBaseUnitario,
        precio_servicios: precioServiciosUnitario,
        precio_acabados: precioAcabadosUnitario,
        precio_total: precioTotalUnitario,
        tiene_precio: true
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

  const { data, error } = await supabase
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
    console.error('Error buscando precio laser:', error);
    return null;
  }

  return data?.precio || null;
}

async function getPrecioGranFormato(
  productId: string,
  config: SelectedConfiguration
): Promise<number | null> {
  if (!config.tinta) {
    return null;
  }

  // Para gran formato, buscar en rangos de precio
  const { data, error } = await supabase
    .from('productos_gran_formato_precios')
    .select('precio, rango_precio_min, rango_precio_max')
    .eq('producto_gran_formato_id', productId)
    .eq('tinta', config.tinta);

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
  const precioEnRango = data.find(p => {
    if (p.rango_precio_max === null) {
      return config.cantidad >= p.rango_precio_min;
    }
    return config.cantidad >= p.rango_precio_min && config.cantidad <= p.rango_precio_max;
  });

  return precioEnRango ? precioEnRango.precio * mt2 : null;
}

async function getPrecioMaterialesRigidos(
  productId: string,
  config: SelectedConfiguration
): Promise<number | null> {
  if (!config.material_id || !config.espesor) {
    return null;
  }

  const { data, error } = await supabase
    .from('productos_materiales_rigidos_precios')
    .select('precio_mt2')
    .eq('producto_materiales_rigidos_id', productId)
    .eq('material_id', config.material_id)
    .eq('variante_nombre', config.variante_nombre)
    .eq('espesor', config.espesor)
    .single();

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
  return data.precio_mt2 * mt2;
}

async function getPrecioPlotterCorte(
  productId: string,
  config: SelectedConfiguration
): Promise<number | null> {
  if (!config.medida_ancho) {
    return null;
  }

  const { data, error } = await supabase
    .from('productos_plotter_corte_precios')
    .select('precio, cantidad_desde, cantidad_hasta')
    .eq('producto_id', productId)
    .eq('ancho', config.medida_ancho);

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
  const metrosLineales = config.medida_alto || 1;
  return precioEnRango.precio * metrosLineales;
}

async function getPrecioPortabanners(
  productId: string,
  config: SelectedConfiguration
): Promise<number | null> {
  if (!config.tecnologia_id) {
    return null;
  }

  const { data, error } = await supabase
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
  const { data, error } = await supabase
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
function calcularImpacto(
  tipoImpacto: string,
  valorMonto: number | null,
  valorPorcentaje: number | null,
  precioBaseTotal: number,
  mt2: number,
  metrosLineales: number,
  cantidad: number
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
      // Precio fijo + precio por mt2 multiplicado por cantidad
      const fijoMt2 = valorMonto || 0;
      const porMt2 = valorPorcentaje && mt2 ? valorPorcentaje * mt2 * cantidad : 0;
      return fijoMt2 + porMt2;

    case 'fijo_metro_lineal':
      // Precio fijo + precio por metro lineal multiplicado por cantidad
      const fijoMl = valorMonto || 0;
      const porMl = valorPorcentaje && metrosLineales ? valorPorcentaje * metrosLineales * cantidad : 0;
      return fijoMl + porMl;

    case 'por_minuto':
    case 'fijo_por_minuto':
      // Por ahora retornamos 0, se implementará más adelante
      console.warn(`Tipo de impacto "${tipoImpacto}" no implementado aún`);
      return 0;

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
  precioPorUnidadRango?: number
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
        precioBaseUnitario = await getPrecioGranFormatoLine(productId, lineConfig, line, tipoVentaReal, precioPorUnidadRango);
        break;
      case 'Materiales Rigidos':
        precioBaseUnitario = await getPrecioMaterialesRigidosLine(productId, lineConfig, line, precioPorUnidadRango);
        break;
      case 'Plotter de Corte':
        precioBaseUnitario = await getPrecioPlotterCorteLine(productId, lineConfig, line, precioPorUnidadRango);
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
        servicio.valor_monto,
        servicio.valor_porcentaje,
        precioBaseTotal,
        mt2,
        metrosLineales,
        line.cantidad
      );
      precioServiciosTotal += impacto;
    }

    // Calcular impacto de acabados
    let precioAcabadosTotal = 0;
    for (const acabado of acabadosLinea) {
      const impacto = calcularImpacto(
        acabado.tipo_impacto,
        acabado.valor_monto,
        acabado.valor_porcentaje,
        precioBaseTotal,
        mt2,
        metrosLineales,
        line.cantidad
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
  precioPorUnidadRango?: number
): Promise<number | null> {
  if (!config.tinta) return null;

  // Si se proporciona precio del rango correcto (calculado con totales acumulados), usarlo
  if (precioPorUnidadRango !== undefined && precioPorUnidadRango !== null) {
    if (tipoVentaReal === 'mt2') {
      return precioPorUnidadRango * (line.mt2_calculado || 0);
    } else {
      return precioPorUnidadRango * (line.metros_lineales || 0);
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
    // Precio por MT2 * MT2 de la línea
    return precioRango.precio * (line.mt2_calculado || 0);
  } else {
    // Precio por metro lineal * metros lineales de la línea
    return precioRango.precio * (line.metros_lineales || 0);
  }
}

async function getPrecioMaterialesRigidosLine(
  productId: string,
  config: SelectedConfiguration,
  line: MeasurementLine,
  precioPorUnidadRango?: number
): Promise<number | null> {
  if (!config.material_id || !config.espesor) return null;

  // Si se proporciona precio del rango correcto (calculado con totales acumulados), usarlo
  if (precioPorUnidadRango !== undefined && precioPorUnidadRango !== null) {
    return precioPorUnidadRango * (line.mt2_calculado || 0);
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
  return data.precio_mt2 * (line.mt2_calculado || 0);
}

async function getPrecioPlotterCorteLine(
  productId: string,
  config: SelectedConfiguration,
  line: MeasurementLine,
  precioPorUnidadRango?: number
): Promise<number | null> {
  if (!config.medida_ancho) return null;

  // Si se proporciona precio del rango correcto (calculado con totales acumulados), usarlo
  if (precioPorUnidadRango !== undefined && precioPorUnidadRango !== null) {
    return precioPorUnidadRango * (line.metros_lineales || 0);
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
  return precioRango.precio * (line.metros_lineales || 0);
}
