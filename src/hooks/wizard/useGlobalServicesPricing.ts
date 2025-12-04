import { useMemo } from 'react';
import type { ServicioGlobalSeleccionado, AcabadoGlobalSeleccionado, PreciosGlobalesLinea } from '../../types/wizard';

interface LineaParaCalcular {
  cantidad: number;
  precio_base_unitario: number;
  mt2_calculado?: number;
  metros_lineales?: number;
}

export function useGlobalServicesPricing(
  lineas: LineaParaCalcular[],
  serviciosGrupo: ServicioGlobalSeleccionado[],
  acabadosGrupo: AcabadoGlobalSeleccionado[]
) {
  const preciosGlobalesPorLinea = useMemo(() => {
    if (lineas.length === 0) return [];

    // Calcular totales para toda la colección de líneas
    const subtotal_total = lineas.reduce((sum, l) => sum + (l.precio_base_unitario * l.cantidad), 0);
    const mt2_total = lineas.reduce((sum, l) => sum + (l.mt2_calculado || 0), 0);
    const mt_lineal_total = lineas.reduce((sum, l) => sum + (l.metros_lineales || 0), 0);

    // Calcular precios de servicios globales
    const serviciosCalculados = serviciosGrupo.map(servicio => {
      let precio_total = 0;

      switch (servicio.tipo_impacto) {
        case 'precio_fijo':
          precio_total = servicio.valor_monto || 0;
          break;

        case 'porcentual':
          precio_total = subtotal_total * ((servicio.valor_monto_secundario || 0) / 100);
          break;

        case 'fijo_porcentual':
          const fijo = servicio.valor_monto || 0;
          const porcentual = subtotal_total * ((servicio.valor_monto_secundario || 0) / 100);
          precio_total = fijo + porcentual;
          break;

        case 'fijo_mt2':
          const fijo_mt2 = servicio.valor_monto || 0;
          const variable_mt2 = mt2_total * (servicio.valor_monto_secundario || 0);
          precio_total = fijo_mt2 + variable_mt2;
          break;

        case 'fijo_mt_lineal':
          const fijo_ml = servicio.valor_monto || 0;
          const variable_ml = mt_lineal_total * (servicio.valor_monto_secundario || 0);
          precio_total = fijo_ml + variable_ml;
          break;

        case 'por_mt2':
          precio_total = mt2_total * (servicio.valor_monto || 0);
          break;

        case 'por_mt_lineal':
          precio_total = mt_lineal_total * (servicio.valor_monto || 0);
          break;
      }

      return {
        servicio_nombre: servicio.servicio_nombre,
        precio_calculado_total: precio_total
      };
    });

    // Calcular precios de acabados globales (misma lógica)
    const acabadosCalculados = acabadosGrupo.map(acabado => {
      let precio_total = 0;

      switch (acabado.tipo_impacto) {
        case 'precio_fijo':
          precio_total = acabado.valor_monto || 0;
          break;

        case 'porcentual':
          precio_total = subtotal_total * ((acabado.valor_monto_secundario || 0) / 100);
          break;

        case 'fijo_porcentual':
          const fijo = acabado.valor_monto || 0;
          const porcentual = subtotal_total * ((acabado.valor_monto_secundario || 0) / 100);
          precio_total = fijo + porcentual;
          break;

        case 'fijo_mt2':
          const fijo_mt2 = acabado.valor_monto || 0;
          const variable_mt2 = mt2_total * (acabado.valor_monto_secundario || 0);
          precio_total = fijo_mt2 + variable_mt2;
          break;

        case 'fijo_mt_lineal':
          const fijo_ml = acabado.valor_monto || 0;
          const variable_ml = mt_lineal_total * (acabado.valor_monto_secundario || 0);
          precio_total = fijo_ml + variable_ml;
          break;

        case 'por_mt2':
          precio_total = mt2_total * (acabado.valor_monto || 0);
          break;

        case 'por_mt_lineal':
          precio_total = mt_lineal_total * (acabado.valor_monto || 0);
          break;
      }

      return {
        acabado_nombre: acabado.acabado_nombre,
        precio_calculado_total: precio_total
      };
    });

    // Calcular totales
    const total_servicios_globales = serviciosCalculados.reduce((sum, s) => sum + s.precio_calculado_total, 0);
    const total_acabados_globales = acabadosCalculados.reduce((sum, a) => sum + a.precio_calculado_total, 0);

    // Distribuir proporcionalmente entre las líneas según su precio base
    return lineas.map(linea => {
      const peso_linea = (linea.precio_base_unitario * linea.cantidad) / subtotal_total;

      return {
        precio_servicios_globales: total_servicios_globales * peso_linea,
        precio_acabados_globales: total_acabados_globales * peso_linea,
        servicios_detalle: serviciosCalculados.map(s => ({
          ...s,
          precio_asignado_linea: s.precio_calculado_total * peso_linea
        })),
        acabados_detalle: acabadosCalculados.map(a => ({
          ...a,
          precio_asignado_linea: a.precio_calculado_total * peso_linea
        }))
      } as PreciosGlobalesLinea;
    });

  }, [lineas, serviciosGrupo, acabadosGrupo]);

  return preciosGlobalesPorLinea;
}
