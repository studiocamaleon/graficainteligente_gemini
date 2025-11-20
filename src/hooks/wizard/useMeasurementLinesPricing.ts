import { useEffect } from 'react';
import { calculateLinePrice } from './useUniversalPricing';
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

      for (const line of lines) {
        const precio = await calculateLinePrice(
          productId,
          categoria,
          line,
          baseConfig,
          allServicios,
          allAcabados,
          tipoVentaReal
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
