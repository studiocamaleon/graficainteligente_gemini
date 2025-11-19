import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
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
      const { data: precioData, error: precioError } = await supabase
        .from('productos_impresion_laser_precios')
        .select(`
          precio_base,
          rango_precio_id,
          rangos_precio!inner(
            id,
            nombre,
            rangos_precio_valores(
              cantidad_desde,
              cantidad_hasta
            )
          )
        `)
        .eq('producto_laser_id', params.producto_laser_id)
        .eq('medida_ancho', params.medida_ancho)
        .eq('medida_alto', params.medida_alto)
        .eq('tinta_id', params.tinta_id)
        .eq('cara_impresa', params.cara_impresa)
        .maybeSingle();

      if (precioError) throw precioError;

      if (!precioData) {
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

      const rangos = Array.isArray(precioData.rangos_precio)
        ? precioData.rangos_precio[0]
        : precioData.rangos_precio;

      const valores = rangos?.rangos_precio_valores || [];

      const rangoValido = valores.find((v: any) => {
        const desde = v.cantidad_desde || 0;
        const hasta = v.cantidad_hasta || 999999;
        return params.cantidad >= desde && params.cantidad <= hasta;
      });

      if (!rangoValido) {
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

      const precioBase = precioData.precio_base;

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
