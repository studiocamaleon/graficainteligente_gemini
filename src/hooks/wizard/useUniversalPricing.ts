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
      // Necesitamos calcular el precio unitario para aplicar servicios y acabados correctamente
      const esCantidadFija = cantidadesFijas && cantidadesFijas.length > 0;
      const precioBaseUnitario = esCantidadFija ? precioBase / config.cantidad : precioBase;

      // Calcular impacto de servicios sobre el precio base UNITARIO
      let precioServiciosUnitario = 0;
      for (const servicio of servicios) {
        if (servicio.valor_porcentaje) {
          precioServiciosUnitario += precioBaseUnitario * (servicio.valor_porcentaje / 100);
        }
        if (servicio.valor_monto) {
          precioServiciosUnitario += servicio.valor_monto;
        }
      }

      // Calcular impacto de acabados sobre el precio base UNITARIO
      let precioAcabadosUnitario = 0;
      for (const acabado of acabados) {
        if (acabado.valor_porcentaje) {
          precioAcabadosUnitario += precioBaseUnitario * (acabado.valor_porcentaje / 100);
        }
        if (acabado.valor_monto) {
          precioAcabadosUnitario += acabado.valor_monto;
        }
      }

      // Precio total es el precio unitario (con servicios y acabados)
      const precioTotalUnitario = precioBaseUnitario + precioServiciosUnitario + precioAcabadosUnitario;

      // Para cantidades fijas, devolvemos los precios unitarios
      // Para cantidades variables, el precio base ya era unitario
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
