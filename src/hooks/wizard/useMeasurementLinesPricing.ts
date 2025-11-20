import { useEffect } from 'react';
import { calculateLinePrice, determinarPrecioPorUnidadRango } from './useUniversalPricing';
import type { ProductCategory } from './useUniversalProductSearch';
import type { MeasurementLine, SelectedConfiguration } from '../../components/wizard/steps/ConfigurationStep';
import type { SelectedService, SelectedFinishing } from '../../components/wizard/steps/ServicesAndFinishingsStep';

/**
 * Hook para calcular y actualizar precios de líneas de medidas
 */
export function useMeasurementLinesPricing(
  productId: string | null,
  categoria: ProductCategory | null,
  lines: MeasurementLine[],
  baseConfig: Omit<SelectedConfiguration, 'lineas_medidas'>,
  allServicios: SelectedService[],
  allAcabados: SelectedFinishing[],
  tipoVentaReal?: 'mt2' | 'mt_lineal' | 'unidad' | 'cantidades_fijas',
  onLinesUpdate?: (updatedLines: MeasurementLine[]) => void
) {
  useEffect(() => {
    if (!productId || !categoria || lines.length === 0) return;

    const calculateAllLinesPrices = async () => {
      const updatedLines: MeasurementLine[] = [];

      // PASO 1: Calcular totales acumulados de todas las líneas
      // Esto es necesario para determinar el rango de precio correcto
      const totalMT2Acumulado = lines.reduce((sum, line) =>
        sum + (line.mt2_calculado || 0) * line.cantidad, 0
      );

      const totalMetrosLinealesAcumulado = lines.reduce((sum, line) =>
        sum + (line.metros_lineales || 0) * line.cantidad, 0
      );

      console.log('📊 Totales acumulados:', {
        totalMT2: totalMT2Acumulado.toFixed(2),
        totalMetrosLineales: totalMetrosLinealesAcumulado.toFixed(2),
        cantidadLineas: lines.length
      });

      // PASO 2: Determinar precio por unidad del rango correcto basado en totales
      // Solo para categorías que usan rangos de precio (Gran Formato, Materiales Rígidos, Plotter)
      let precioPorUnidadRango: number | null = null;

      if (['Impresion Gran Formato', 'Materiales Rigidos', 'Plotter de Corte'].includes(categoria)) {
        precioPorUnidadRango = await determinarPrecioPorUnidadRango(
          productId,
          categoria,
          totalMT2Acumulado,
          totalMetrosLinealesAcumulado,
          baseConfig,
          tipoVentaReal
        );

        if (precioPorUnidadRango) {
          console.log(`💰 Precio por unidad del rango: $${precioPorUnidadRango.toFixed(2)}`);
        }
      }

      // PASO 3: Calcular precio de cada línea usando el precio del rango correcto
      for (const line of lines) {
        const precio = await calculateLinePrice(
          productId,
          categoria,
          line,
          baseConfig,
          allServicios,
          allAcabados,
          tipoVentaReal,
          precioPorUnidadRango || undefined  // Pasar el precio del rango
        );

        if (precio) {
          updatedLines.push({
            ...line,
            precio_base_unitario: precio.precio_base_unitario,
            precio_servicios_unitario: precio.precio_servicios_unitario,
            precio_acabados_unitario: precio.precio_acabados_unitario,
            precio_unitario_final: precio.precio_unitario_final,
            precio_total_linea: precio.precio_total_linea
          });
        } else {
          // Si no se pudo calcular precio, mantener la línea sin precios
          updatedLines.push({
            ...line,
            precio_base_unitario: undefined,
            precio_servicios_unitario: undefined,
            precio_acabados_unitario: undefined,
            precio_unitario_final: undefined,
            precio_total_linea: undefined
          });
        }
      }

      // Notificar líneas actualizadas
      if (onLinesUpdate && updatedLines.length > 0) {
        onLinesUpdate(updatedLines);
      }
    };

    calculateAllLinesPrices();
  }, [
    productId,
    categoria,
    lines.length,
    JSON.stringify(lines.map(l => ({
      id: l.id,
      cantidad: l.cantidad,
      ancho: l.ancho,
      alto: l.alto,
      ancho_seleccionado: l.ancho_seleccionado,
      metros_lineales: l.metros_lineales,
      servicios_ids: l.servicios_ids,
      acabados_ids: l.acabados_ids
    }))),
    baseConfig.material_id,
    baseConfig.tecnologia_id,
    baseConfig.tinta,
    baseConfig.espesor,
    baseConfig.color,
    allServicios.length,
    allAcabados.length,
    tipoVentaReal
  ]);
}
