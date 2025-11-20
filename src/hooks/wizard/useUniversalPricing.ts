import { useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import type { ProductCategory } from './useUniversalProductSearch';
import type { SelectedConfiguration } from '../../components/wizard/steps/ConfigurationStep';
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
    .select('precio, rango_precio_min, rango_precio_max')
    .eq('producto_materiales_rigidos_id', productId)
    .eq('material_id', config.material_id)
    .eq('variante_id', config.variante_id)
    .eq('espesor', config.espesor);

  if (error) {
    console.error('Error buscando precio materiales rígidos:', error);
    return null;
  }

  if (!data || data.length === 0) return null;

  // Buscar en qué rango cae
  const precioEnRango = data.find(p => {
    if (p.rango_precio_max === null) {
      return config.cantidad >= p.rango_precio_min;
    }
    return config.cantidad >= p.rango_precio_min && config.cantidad <= p.rango_precio_max;
  });

  if (!precioEnRango) return null;

  // Calcular por mt2
  const mt2 = config.medida_ancho && config.medida_alto
    ? (config.medida_ancho / 100) * (config.medida_alto / 100)
    : 1;

  return precioEnRango.precio * mt2;
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
    .select('precio, rango_precio_min, rango_precio_max')
    .eq('producto_id', productId)
    .eq('ancho', config.medida_ancho);

  if (error) {
    console.error('Error buscando precio plotter corte:', error);
    return null;
  }

  if (!data || data.length === 0) return null;

  // Buscar en qué rango cae
  const precioEnRango = data.find(p => {
    if (p.rango_precio_max === null) {
      return config.cantidad >= p.rango_precio_min;
    }
    return config.cantidad >= p.rango_precio_min && config.cantidad <= p.rango_precio_max;
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
    .select('precio, rango_precio_min, rango_precio_max')
    .eq('producto_id', productId)
    .eq('tecnologia_id', config.tecnologia_id);

  if (error) {
    console.error('Error buscando precio portabanners:', error);
    return null;
  }

  if (!data || data.length === 0) return null;

  // Buscar en qué rango cae
  const precioEnRango = data.find(p => {
    if (p.rango_precio_max === null) {
      return config.cantidad >= p.rango_precio_min;
    }
    return config.cantidad >= p.rango_precio_min && config.cantidad <= p.rango_precio_max;
  });

  return precioEnRango?.precio || null;
}

async function getPrecioSellos(
  productId: string,
  config: SelectedConfiguration
): Promise<number | null> {
  const { data, error } = await supabase
    .from('productos_sellos_precios')
    .select('precio, rango_precio_min, rango_precio_max')
    .eq('producto_id', productId);

  if (error) {
    console.error('Error buscando precio sellos:', error);
    return null;
  }

  if (!data || data.length === 0) return null;

  // Buscar en qué rango cae
  const precioEnRango = data.find(p => {
    if (p.rango_precio_max === null) {
      return config.cantidad >= p.rango_precio_min;
    }
    return config.cantidad >= p.rango_precio_min && config.cantidad <= p.rango_precio_max;
  });

  return precioEnRango?.precio || null;
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
