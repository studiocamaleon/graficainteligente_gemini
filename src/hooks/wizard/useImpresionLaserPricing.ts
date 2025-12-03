import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { findRangoForQuantity, type RangoDetalle } from '../../utils/rangoUtils';
import type { PriceQueryParams, PriceResult, ServicioSeleccionado, AcabadoSeleccionado } from '../../types/wizard';

export function useImpresionLaserPricing() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const calculatePrice = useCallback(async (
    params: PriceQueryParams,
    servicios: ServicioSeleccionado[] = [],
    acabados: AcabadoSeleccionado[] = []
  ): Promise<PriceResult> => {
    setIsLoading(true);
    setError(null);

    try {
      const { data: productoData, error: productoError } = await supabase
        .from('productos_impresion_laser')
        .select(`
          id,
          tipo_venta,
          rango_precio_id,
          rango_precio:rangos_precio(id, rangos)
        `)
        .eq('id', params.producto_laser_id)
        .maybeSingle();

      if (productoError) throw productoError;
      if (!productoData) throw new Error('Producto no encontrado');

      let precioData: any = null;

      if (productoData.tipo_venta === 'unidades' && productoData.rango_precio_id && productoData.rango_precio) {
        const rangosDelProducto = productoData.rango_precio.rangos as RangoDetalle[];
        const rangoAplicable = findRangoForQuantity(params.cantidad, rangosDelProducto);

        if (!rangoAplicable) {
          return {
            precio_base: 0,
            tiene_configuracion: false,
            desglose: {
              base: 0,
              servicios: 0,
              acabados: 0,
              total: 0,
            },
          };
        }

        let query = supabase
          .from('productos_impresion_laser_precios')
          .select('precio')
          .eq('producto_laser_id', params.producto_laser_id)
          .eq('medida_ancho', params.medida_ancho)
          .eq('medida_alto', params.medida_alto)
          .eq('tinta', params.tinta)
          .eq('cara_impresa', params.cara_impresa)
          .eq('rango_precio_min', rangoAplicable.min);

        if (rangoAplicable.max === null) {
          query = query.is('rango_precio_max', null);
        } else {
          query = query.eq('rango_precio_max', rangoAplicable.max);
        }

        const { data, error: rangoError } = await query.maybeSingle();
        if (rangoError) throw rangoError;
        precioData = data;
      } else {
        const { data, error: cantidadError } = await supabase
          .from('productos_impresion_laser_precios')
          .select('precio')
          .eq('producto_laser_id', params.producto_laser_id)
          .eq('medida_ancho', params.medida_ancho)
          .eq('medida_alto', params.medida_alto)
          .eq('tinta', params.tinta)
          .eq('cantidad', params.cantidad)
          .eq('cara_impresa', params.cara_impresa)
          .maybeSingle();

        if (cantidadError) throw cantidadError;
        precioData = data;
      }

      if (!precioData || !precioData.precio) {
        return {
          precio_base: 0,
          tiene_configuracion: false,
          desglose: {
            base: 0,
            servicios: 0,
            acabados: 0,
            total: 0,
          },
        };
      }

      const precioBase = precioData.precio;

      let totalServicios = 0;
      for (const servicio of servicios) {
        let impacto = 0;
        if (servicio.tipo_impacto === 'porcentaje' && servicio.valor_porcentaje !== null) {
          impacto = precioBase * (servicio.valor_porcentaje / 100);
        } else if (servicio.tipo_impacto === 'monto_fijo' && servicio.valor_monto !== null) {
          impacto = servicio.valor_monto;
        } else if (servicio.tipo_impacto === 'ambos') {
          const impactoPorcentaje = servicio.valor_porcentaje !== null
            ? precioBase * (servicio.valor_porcentaje / 100)
            : 0;
          const impactoMonto = servicio.valor_monto || 0;
          impacto = impactoPorcentaje + impactoMonto;
        }
        totalServicios += impacto;
      }

      let totalAcabados = 0;
      for (const acabado of acabados) {
        let impacto = 0;
        if (acabado.tipo_impacto === 'porcentaje' && acabado.valor_porcentaje !== null) {
          impacto = precioBase * (acabado.valor_porcentaje / 100);
        } else if (acabado.tipo_impacto === 'monto_fijo' && acabado.valor_monto !== null) {
          impacto = acabado.valor_monto;
        } else if (acabado.tipo_impacto === 'ambos') {
          const impactoPorcentaje = acabado.valor_porcentaje !== null
            ? precioBase * (acabado.valor_porcentaje / 100)
            : 0;
          const impactoMonto = acabado.valor_monto || 0;
          impacto = impactoPorcentaje + impactoMonto;
        }
        totalAcabados += impacto;
      }

      const total = precioBase + totalServicios + totalAcabados;

      return {
        precio_base: precioBase,
        tiene_configuracion: true,
        desglose: {
          base: precioBase,
          servicios: totalServicios,
          acabados: totalAcabados,
          total,
        },
      };
    } catch (err) {
      console.error('Error calculating price:', err);
      const errorMsg = err instanceof Error ? err.message : 'Error al calcular precio';
      setError(errorMsg);

      return {
        precio_base: 0,
        tiene_configuracion: false,
        desglose: {
          base: 0,
          servicios: 0,
          acabados: 0,
          total: 0,
        },
      };
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { calculatePrice, isLoading, error };
}
