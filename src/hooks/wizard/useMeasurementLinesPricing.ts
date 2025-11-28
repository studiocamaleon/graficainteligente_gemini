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
  cantidadMinima?: number,
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

      // PASO 1.5: Determinar si se debe aplicar cantidad_minima y calcular factor de ajuste
      // El mínimo se aplica al TOTAL ACUMULADO, no a cada línea individual
      let factorAjusteMT2 = 1;
      let factorAjusteMetrosLineales = 1;

      if (cantidadMinima) {
        if (tipoVentaReal === 'mt2' && totalMT2Acumulado > 0 && totalMT2Acumulado < cantidadMinima) {
          // Total acumulado es menor al mínimo → Aplicar ajuste proporcional
          factorAjusteMT2 = cantidadMinima / totalMT2Acumulado;
          console.log(`📊 Cantidad mínima aplicada al total: ${totalMT2Acumulado.toFixed(2)} MT2 → ${cantidadMinima} MT2 (factor: ${factorAjusteMT2.toFixed(4)})`);
        } else if (tipoVentaReal === 'mt_lineal' && totalMetrosLinealesAcumulado > 0 && totalMetrosLinealesAcumulado < cantidadMinima) {
          // Total acumulado es menor al mínimo → Aplicar ajuste proporcional
          factorAjusteMetrosLineales = cantidadMinima / totalMetrosLinealesAcumulado;
          console.log(`📊 Cantidad mínima aplicada al total: ${totalMetrosLinealesAcumulado.toFixed(2)} ML → ${cantidadMinima} ML (factor: ${factorAjusteMetrosLineales.toFixed(4)})`);
        } else {
          console.log(`✅ Total acumulado (${tipoVentaReal === 'mt2' ? totalMT2Acumulado.toFixed(2) + ' MT2' : totalMetrosLinealesAcumulado.toFixed(2) + ' ML'}) supera el mínimo de ${cantidadMinima}. No se aplica ajuste.`);
        }
      }

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
          line.servicios || [],  // Servicios de la línea
          line.acabados || [],   // Acabados de la línea
          tipoVentaReal,
          precioPorUnidadRango || undefined,  // Pasar el precio del rango
          tipoVentaReal === 'mt2' ? factorAjusteMT2 : factorAjusteMetrosLineales  // Factor de ajuste (aplica mínimo al total)
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
      servicios: l.servicios,
      acabados: l.acabados
    }))),
    baseConfig.material_id,
    baseConfig.tecnologia_id,
    baseConfig.tinta,
    baseConfig.espesor,
    baseConfig.color,
    tipoVentaReal
  ]);
}
