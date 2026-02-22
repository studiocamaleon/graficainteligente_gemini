import { useCallback, useEffect, useState } from 'react';
import { useAuth } from './useAuth';
import { supabase } from '../lib/supabase';
import type { BIHookResult, BIMeta, BIProductosData } from '../types/business-intelligence';
import type { BIQueryParams } from './biShared';
import { resolveBIMeta, toNumber } from './biShared';

interface UseBIProductosParams extends BIQueryParams {
  categoria?: string;
  tecnologiaGranFormato?: string | null;
}

export function useBIProductos(params: UseBIProductosParams): BIHookResult<BIProductosData> {
  const { company } = useAuth();
  const { preset, fechaInicio, fechaFin } = params;
  const categoria = params.categoria || 'Impresion Laser';
  const tecnologiaGranFormato = params.tecnologiaGranFormato || null;

  const [data, setData] = useState<BIProductosData | null>(null);
  const [meta, setMeta] = useState<BIMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const toRows = (input: unknown): Record<string, unknown>[] =>
    Array.isArray(input) ? (input as Record<string, unknown>[]) : [];

  const firstRow = (input: unknown): Record<string, unknown> | null =>
    Array.isArray(input) && input.length > 0 ? (input[0] as Record<string, unknown>) : null;

  const fetchData = useCallback(async () => {
    if (!company?.id) return;

    try {
      setLoading(true);
      setError(null);

      const resolvedMeta = await resolveBIMeta({ preset, fechaInicio, fechaFin });
      setMeta(resolvedMeta);

      const baseCalls = [
        supabase.rpc('fn_bi_productos_categorias_v2', {
          p_company_id: company.id,
          p_fecha_inicio: resolvedMeta.fecha_inicio,
          p_fecha_fin: resolvedMeta.fecha_fin,
        }),
        supabase.rpc('fn_bi_productos_resumen_v2', {
          p_company_id: company.id,
          p_fecha_inicio: resolvedMeta.fecha_inicio,
          p_fecha_fin: resolvedMeta.fecha_fin,
          p_categoria: categoria,
        }),
        supabase.rpc('fn_bi_productos_top_v2', {
          p_company_id: company.id,
          p_fecha_inicio: resolvedMeta.fecha_inicio,
          p_fecha_fin: resolvedMeta.fecha_fin,
          p_categoria: categoria,
          p_limit: 10,
        }),
        supabase.rpc('fn_bi_productos_categoria_actividad_v2', {
          p_company_id: company.id,
          p_categoria: categoria,
        }),
      ];

      const laserCalls = categoria === 'Impresion Laser'
        ? [
            supabase.rpc('fn_bi_productos_laser_medidas_v2', {
              p_company_id: company.id,
              p_fecha_inicio: resolvedMeta.fecha_inicio,
              p_fecha_fin: resolvedMeta.fecha_fin,
              p_limit: 10,
            }),
            supabase.rpc('fn_bi_productos_laser_tintas_v2', {
              p_company_id: company.id,
              p_fecha_inicio: resolvedMeta.fecha_inicio,
              p_fecha_fin: resolvedMeta.fecha_fin,
            }),
            supabase.rpc('fn_bi_productos_laser_caras_v2', {
              p_company_id: company.id,
              p_fecha_inicio: resolvedMeta.fecha_inicio,
              p_fecha_fin: resolvedMeta.fecha_fin,
            }),
          ]
        : [];

      const granFormatoCalls = categoria === 'Impresion Gran Formato'
        ? [
            supabase.rpc('fn_bi_productos_gran_formato_resumen_v2', {
              p_company_id: company.id,
              p_fecha_inicio: resolvedMeta.fecha_inicio,
              p_fecha_fin: resolvedMeta.fecha_fin,
              p_tecnologia: tecnologiaGranFormato,
            }),
            supabase.rpc('fn_bi_productos_gran_formato_mix_tipo_venta_v2', {
              p_company_id: company.id,
              p_fecha_inicio: resolvedMeta.fecha_inicio,
              p_fecha_fin: resolvedMeta.fecha_fin,
              p_tecnologia: tecnologiaGranFormato,
            }),
            supabase.rpc('fn_bi_productos_gran_formato_top_materiales_v2', {
              p_company_id: company.id,
              p_fecha_inicio: resolvedMeta.fecha_inicio,
              p_fecha_fin: resolvedMeta.fecha_fin,
              p_limit: 10,
              p_tecnologia: tecnologiaGranFormato,
            }),
            supabase.rpc('fn_bi_productos_gran_formato_anchos_v2', {
              p_company_id: company.id,
              p_fecha_inicio: resolvedMeta.fecha_inicio,
              p_fecha_fin: resolvedMeta.fecha_fin,
              p_limit: 12,
              p_tecnologia: tecnologiaGranFormato,
            }),
            supabase.rpc('fn_bi_productos_gran_formato_tecnologia_unidad_v2', {
              p_company_id: company.id,
              p_fecha_inicio: resolvedMeta.fecha_inicio,
              p_fecha_fin: resolvedMeta.fecha_fin,
            }),
            supabase.rpc('fn_bi_productos_gran_formato_tecnologia_unidad_v2', {
              p_company_id: company.id,
              p_fecha_inicio: resolvedMeta.fecha_inicio,
              p_fecha_fin: resolvedMeta.fecha_fin,
              p_tecnologia: tecnologiaGranFormato,
            }),
          ]
        : [];

      const talonariosCalls = categoria === 'Talonarios'
        ? [
            supabase.rpc('fn_bi_productos_talonarios_resumen_v2', {
              p_company_id: company.id,
              p_fecha_inicio: resolvedMeta.fecha_inicio,
              p_fecha_fin: resolvedMeta.fecha_fin,
            }),
            supabase.rpc('fn_bi_productos_talonarios_mix_tipo_copia_v2', {
              p_company_id: company.id,
              p_fecha_inicio: resolvedMeta.fecha_inicio,
              p_fecha_fin: resolvedMeta.fecha_fin,
            }),
            supabase.rpc('fn_bi_productos_talonarios_mix_tintas_v2', {
              p_company_id: company.id,
              p_fecha_inicio: resolvedMeta.fecha_inicio,
              p_fecha_fin: resolvedMeta.fecha_fin,
            }),
            supabase.rpc('fn_bi_productos_talonarios_top_medidas_v2', {
              p_company_id: company.id,
              p_fecha_inicio: resolvedMeta.fecha_inicio,
              p_fecha_fin: resolvedMeta.fecha_fin,
              p_limit: 10,
            }),
            supabase.rpc('fn_bi_productos_talonarios_top_materiales_v2', {
              p_company_id: company.id,
              p_fecha_inicio: resolvedMeta.fecha_inicio,
              p_fecha_fin: resolvedMeta.fecha_fin,
              p_limit: 10,
            }),
          ]
        : [];

      const plotterCalls = categoria === 'Plotter de Corte'
        ? [
            supabase.rpc('fn_bi_productos_plotter_resumen_v2', {
              p_company_id: company.id,
              p_fecha_inicio: resolvedMeta.fecha_inicio,
              p_fecha_fin: resolvedMeta.fecha_fin,
            }),
            supabase.rpc('fn_bi_productos_plotter_mix_anchos_v2', {
              p_company_id: company.id,
              p_fecha_inicio: resolvedMeta.fecha_inicio,
              p_fecha_fin: resolvedMeta.fecha_fin,
            }),
            supabase.rpc('fn_bi_productos_plotter_mix_color_v2', {
              p_company_id: company.id,
              p_fecha_inicio: resolvedMeta.fecha_inicio,
              p_fecha_fin: resolvedMeta.fecha_fin,
            }),
            supabase.rpc('fn_bi_productos_plotter_mix_marca_v2', {
              p_company_id: company.id,
              p_fecha_inicio: resolvedMeta.fecha_inicio,
              p_fecha_fin: resolvedMeta.fecha_fin,
            }),
            supabase.rpc('fn_bi_productos_plotter_top_materiales_v2', {
              p_company_id: company.id,
              p_fecha_inicio: resolvedMeta.fecha_inicio,
              p_fecha_fin: resolvedMeta.fecha_fin,
              p_limit: 10,
            }),
          ]
        : [];

      const rigidosCalls = categoria === 'Materiales Rigidos'
        ? [
            supabase.rpc('fn_bi_productos_rigidos_resumen_v2', {
              p_company_id: company.id,
              p_fecha_inicio: resolvedMeta.fecha_inicio,
              p_fecha_fin: resolvedMeta.fecha_fin,
            }),
            supabase.rpc('fn_bi_productos_rigidos_mix_variante_espesor_v2', {
              p_company_id: company.id,
              p_fecha_inicio: resolvedMeta.fecha_inicio,
              p_fecha_fin: resolvedMeta.fecha_fin,
            }),
            supabase.rpc('fn_bi_productos_rigidos_top_materiales_v2', {
              p_company_id: company.id,
              p_fecha_inicio: resolvedMeta.fecha_inicio,
              p_fecha_fin: resolvedMeta.fecha_fin,
              p_limit: 10,
            }),
            supabase.rpc('fn_bi_productos_rigidos_top_medidas_v2', {
              p_company_id: company.id,
              p_fecha_inicio: resolvedMeta.fecha_inicio,
              p_fecha_fin: resolvedMeta.fecha_fin,
              p_limit: 10,
            }),
          ]
        : [];

      const sellosCalls = categoria === 'Sellos'
        ? [
            supabase.rpc('fn_bi_productos_sellos_resumen_v2', {
              p_company_id: company.id,
              p_fecha_inicio: resolvedMeta.fecha_inicio,
              p_fecha_fin: resolvedMeta.fecha_fin,
            }),
            supabase.rpc('fn_bi_productos_sellos_mix_tipo_producto_v2', {
              p_company_id: company.id,
              p_fecha_inicio: resolvedMeta.fecha_inicio,
              p_fecha_fin: resolvedMeta.fecha_fin,
            }),
            supabase.rpc('fn_bi_productos_sellos_mix_tipo_sello_v2', {
              p_company_id: company.id,
              p_fecha_inicio: resolvedMeta.fecha_inicio,
              p_fecha_fin: resolvedMeta.fecha_fin,
            }),
            supabase.rpc('fn_bi_productos_sellos_mix_marca_v2', {
              p_company_id: company.id,
              p_fecha_inicio: resolvedMeta.fecha_inicio,
              p_fecha_fin: resolvedMeta.fecha_fin,
            }),
            supabase.rpc('fn_bi_productos_sellos_top_medidas_v2', {
              p_company_id: company.id,
              p_fecha_inicio: resolvedMeta.fecha_inicio,
              p_fecha_fin: resolvedMeta.fecha_fin,
              p_limit: 10,
            }),
          ]
        : [];

      const portabannersCalls = categoria === 'Portabanners'
        ? [
            supabase.rpc('fn_bi_productos_portabanners_resumen_v2', {
              p_company_id: company.id,
              p_fecha_inicio: resolvedMeta.fecha_inicio,
              p_fecha_fin: resolvedMeta.fecha_fin,
            }),
            supabase.rpc('fn_bi_productos_portabanners_mix_tecnologia_v2', {
              p_company_id: company.id,
              p_fecha_inicio: resolvedMeta.fecha_inicio,
              p_fecha_fin: resolvedMeta.fecha_fin,
            }),
            supabase.rpc('fn_bi_productos_portabanners_top_medidas_v2', {
              p_company_id: company.id,
              p_fecha_inicio: resolvedMeta.fecha_inicio,
              p_fecha_fin: resolvedMeta.fecha_fin,
              p_limit: 10,
            }),
            supabase.rpc('fn_bi_productos_portabanners_area_resumen_v2', {
              p_company_id: company.id,
              p_fecha_inicio: resolvedMeta.fecha_inicio,
              p_fecha_fin: resolvedMeta.fecha_fin,
            }),
          ]
        : [];

      const responses = await Promise.all([
        ...baseCalls,
        ...laserCalls,
        ...granFormatoCalls,
        ...talonariosCalls,
        ...plotterCalls,
        ...rigidosCalls,
        ...sellosCalls,
        ...portabannersCalls,
      ]);

      responses.forEach((res) => {
        if (res.error) throw res.error;
      });

      const [
        categoriasRes,
        resumenRes,
        topRes,
        actividadCategoriaRes,
        ...rest
      ] = responses;

      let cursor = 0;
      const take = (count: number) => {
        const slice = rest.slice(cursor, cursor + count);
        cursor += count;
        return slice;
      };

      const laserRes = laserCalls.length ? take(3) : [];
      const granFormatoRes = granFormatoCalls.length ? take(6) : [];
      const talonariosRes = talonariosCalls.length ? take(5) : [];
      const plotterRes = plotterCalls.length ? take(5) : [];
      const rigidosRes = rigidosCalls.length ? take(4) : [];
      const sellosRes = sellosCalls.length ? take(5) : [];
      const portabannersRes = portabannersCalls.length ? take(4) : [];

      const categoriasRows = toRows(categoriasRes.data);
      const resumenRow = firstRow(resumenRes.data);
      const topRows = toRows(topRes.data);
      const actividadCategoriaRow = firstRow(actividadCategoriaRes.data);

      const laserMedidasRows = laserRes[0] ? toRows(laserRes[0].data) : [];
      const laserTintasRows = laserRes[1] ? toRows(laserRes[1].data) : [];
      const laserCarasRows = laserRes[2] ? toRows(laserRes[2].data) : [];

      const granFormatoResumenRow = granFormatoRes[0] ? firstRow(granFormatoRes[0].data) : null;
      const granFormatoMixRows = granFormatoRes[1] ? toRows(granFormatoRes[1].data) : [];
      const granFormatoTopMaterialesRows = granFormatoRes[2] ? toRows(granFormatoRes[2].data) : [];
      const granFormatoTopAnchosRows = granFormatoRes[3] ? toRows(granFormatoRes[3].data) : [];
      const granFormatoTecnologiaAllRows = granFormatoRes[4] ? toRows(granFormatoRes[4].data) : [];
      const granFormatoTecnologiaRows = granFormatoRes[5] ? toRows(granFormatoRes[5].data) : [];

      const talonariosResumenRow = talonariosRes[0] ? firstRow(talonariosRes[0].data) : null;
      const talonariosTipoCopiaRows = talonariosRes[1] ? toRows(talonariosRes[1].data) : [];
      const talonariosTintasRows = talonariosRes[2] ? toRows(talonariosRes[2].data) : [];
      const talonariosMedidasRows = talonariosRes[3] ? toRows(talonariosRes[3].data) : [];
      const talonariosMaterialesRows = talonariosRes[4] ? toRows(talonariosRes[4].data) : [];

      const plotterResumenRow = plotterRes[0] ? firstRow(plotterRes[0].data) : null;
      const plotterAnchosRows = plotterRes[1] ? toRows(plotterRes[1].data) : [];
      const plotterColorRows = plotterRes[2] ? toRows(plotterRes[2].data) : [];
      const plotterMarcaRows = plotterRes[3] ? toRows(plotterRes[3].data) : [];
      const plotterMaterialesRows = plotterRes[4] ? toRows(plotterRes[4].data) : [];

      const rigidosResumenRow = rigidosRes[0] ? firstRow(rigidosRes[0].data) : null;
      const rigidosVarianteRows = rigidosRes[1] ? toRows(rigidosRes[1].data) : [];
      const rigidosMaterialesRows = rigidosRes[2] ? toRows(rigidosRes[2].data) : [];
      const rigidosMedidasRows = rigidosRes[3] ? toRows(rigidosRes[3].data) : [];

      const sellosResumenRow = sellosRes[0] ? firstRow(sellosRes[0].data) : null;
      const sellosTipoProductoRows = sellosRes[1] ? toRows(sellosRes[1].data) : [];
      const sellosTipoSelloRows = sellosRes[2] ? toRows(sellosRes[2].data) : [];
      const sellosMarcaRows = sellosRes[3] ? toRows(sellosRes[3].data) : [];
      const sellosMedidasRows = sellosRes[4] ? toRows(sellosRes[4].data) : [];

      const portabannersResumenRow = portabannersRes[0] ? firstRow(portabannersRes[0].data) : null;
      const portabannersTecnologiaRows = portabannersRes[1] ? toRows(portabannersRes[1].data) : [];
      const portabannersMedidasRows = portabannersRes[2] ? toRows(portabannersRes[2].data) : [];
      const portabannersAreaRows = portabannersRes[3] ? toRows(portabannersRes[3].data) : [];

      setData({
        categorias: categoriasRows.map((r) => ({
          categoria_nombre: String(r.categoria_nombre || 'Personalizado'),
          total_ventas: toNumber(r.total_ventas),
          total_unidades: toNumber(r.total_unidades),
          total_ordenes: toNumber(r.total_ordenes),
        })),
        categoriaSeleccionada: categoria,
        resumen: {
          total_ventas: toNumber(resumenRow?.total_ventas),
          total_unidades: toNumber(resumenRow?.total_unidades),
          total_ordenes: toNumber(resumenRow?.total_ordenes),
          ticket_promedio_orden: toNumber(resumenRow?.ticket_promedio_orden),
          precio_promedio_unidad: toNumber(resumenRow?.precio_promedio_unidad),
          productos_unicos: toNumber(resumenRow?.productos_unicos),
        },
        topProductos: topRows.map((r) => ({
          producto_nombre: String(r.producto_nombre || 'Producto personalizado'),
          total_ventas: toNumber(r.total_ventas),
          total_unidades: toNumber(r.total_unidades),
          total_ordenes: toNumber(r.total_ordenes),
          ticket_promedio_orden: toNumber(r.ticket_promedio_orden),
          precio_promedio_unidad: toNumber(r.precio_promedio_unidad),
        })),
        laserMedidas: laserMedidasRows.map((r) => ({
          medida_label: String(r.medida_label || 'Sin medida'),
          total_ventas: toNumber(r.total_ventas),
          total_unidades: toNumber(r.total_unidades),
          total_ordenes: toNumber(r.total_ordenes),
        })),
        laserTintas: laserTintasRows.map((r) => ({
          tinta_label: String(r.tinta_label || 'Sin tinta'),
          total_ventas: toNumber(r.total_ventas),
          total_unidades: toNumber(r.total_unidades),
          total_ordenes: toNumber(r.total_ordenes),
        })),
        laserCaras: laserCarasRows.map((r) => ({
          cara_label: String(r.cara_label || 'Sin dato'),
          total_ventas: toNumber(r.total_ventas),
          total_unidades: toNumber(r.total_unidades),
          total_ordenes: toNumber(r.total_ordenes),
        })),
        granFormatoResumen: {
          total_ventas: toNumber(granFormatoResumenRow?.total_ventas),
          total_ordenes: toNumber(granFormatoResumenRow?.total_ordenes),
          total_items: toNumber(granFormatoResumenRow?.total_items),
          total_lineas: toNumber(granFormatoResumenRow?.total_lineas),
          total_mt2: toNumber(granFormatoResumenRow?.total_mt2),
          total_ml: toNumber(granFormatoResumenRow?.total_ml),
          ticket_promedio_orden: toNumber(granFormatoResumenRow?.ticket_promedio_orden),
          precio_promedio_mt2: toNumber(granFormatoResumenRow?.precio_promedio_mt2),
          precio_promedio_ml: toNumber(granFormatoResumenRow?.precio_promedio_ml),
        },
        granFormatoMixTipoVenta: granFormatoMixRows.map((r) => ({
          tipo_venta: String(r.tipo_venta || 'Sin dato'),
          total_ventas: toNumber(r.total_ventas),
          total_lineas: toNumber(r.total_lineas),
          total_mt2: toNumber(r.total_mt2),
          total_ml: toNumber(r.total_ml),
          porcentaje_ventas: toNumber(r.porcentaje_ventas),
        })),
        granFormatoTopMateriales: granFormatoTopMaterialesRows.map((r) => ({
          material_label: String(r.material_label || 'Sin material'),
          total_ventas: toNumber(r.total_ventas),
          total_lineas: toNumber(r.total_lineas),
          total_mt2: toNumber(r.total_mt2),
          total_ml: toNumber(r.total_ml),
        })),
        granFormatoTopAnchos: granFormatoTopAnchosRows.map((r) => ({
          ancho_label: String(r.ancho_label || 'Sin ancho'),
          ancho_cm: toNumber(r.ancho_cm),
          total_ventas: toNumber(r.total_ventas),
          total_lineas: toNumber(r.total_lineas),
          total_ml: toNumber(r.total_ml),
        })),
        granFormatoTecnologiaUnidades: granFormatoTecnologiaRows.map((r) => ({
          tecnologia_label: String(r.tecnologia_label || 'Sin tecnología'),
          tipo_venta: String(r.tipo_venta || 'Sin dato'),
          total_ventas: toNumber(r.total_ventas),
          total_lineas: toNumber(r.total_lineas),
          total_mt2: toNumber(r.total_mt2),
          total_ml: toNumber(r.total_ml),
          precio_promedio_mt2: toNumber(r.precio_promedio_mt2),
          precio_promedio_ml: toNumber(r.precio_promedio_ml),
        })),
        granFormatoTecnologiasDisponibles: Array.from(
          new Set(
            granFormatoTecnologiaAllRows
              .map((r) => String(r.tecnologia_label || '').trim())
              .filter((v) => v.length > 0)
          )
        ),
        actividadCategoria: {
          categoria_nombre: String(actividadCategoriaRow?.categoria_nombre || categoria),
          total_items_historico: toNumber(actividadCategoriaRow?.total_items_historico),
          primera_venta: (actividadCategoriaRow?.primera_venta as string | null) || null,
          ultima_venta: (actividadCategoriaRow?.ultima_venta as string | null) || null,
        },
        talonarios: {
          resumen: {
            total_ventas: toNumber(talonariosResumenRow?.total_ventas),
            total_ordenes: toNumber(talonariosResumenRow?.total_ordenes),
            total_unidades: toNumber(talonariosResumenRow?.total_unidades),
            ticket_promedio_orden: toNumber(talonariosResumenRow?.ticket_promedio_orden),
            precio_promedio_unidad: toNumber(talonariosResumenRow?.precio_promedio_unidad),
          },
          mixTipoCopia: talonariosTipoCopiaRows.map((r) => ({
            tipo_copia: String(r.tipo_copia || 'Sin tipo copia'),
            total_ventas: toNumber(r.total_ventas),
            total_unidades: toNumber(r.total_unidades),
            total_ordenes: toNumber(r.total_ordenes),
            porcentaje_ventas: toNumber(r.porcentaje_ventas),
          })),
          mixTintas: talonariosTintasRows.map((r) => ({
            tinta_label: String(r.tinta_label || 'Sin tinta'),
            total_ventas: toNumber(r.total_ventas),
            total_unidades: toNumber(r.total_unidades),
            total_ordenes: toNumber(r.total_ordenes),
            porcentaje_ventas: toNumber(r.porcentaje_ventas),
          })),
          topMedidas: talonariosMedidasRows.map((r) => ({
            medida_label: String(r.medida_label || 'Sin medida'),
            total_ventas: toNumber(r.total_ventas),
            total_unidades: toNumber(r.total_unidades),
            total_ordenes: toNumber(r.total_ordenes),
          })),
          topMateriales: talonariosMaterialesRows.map((r) => ({
            material_label: String(r.material_label || 'Sin material'),
            total_ventas: toNumber(r.total_ventas),
            total_unidades: toNumber(r.total_unidades),
            total_ordenes: toNumber(r.total_ordenes),
          })),
        },
        plotter: {
          resumen: {
            total_ventas: toNumber(plotterResumenRow?.total_ventas),
            total_ordenes: toNumber(plotterResumenRow?.total_ordenes),
            total_unidades: toNumber(plotterResumenRow?.total_unidades),
            total_ml: toNumber(plotterResumenRow?.total_ml),
            ticket_promedio_orden: toNumber(plotterResumenRow?.ticket_promedio_orden),
            precio_promedio_ml: toNumber(plotterResumenRow?.precio_promedio_ml),
          },
          mixAnchos: plotterAnchosRows.map((r) => ({
            ancho_label: String(r.ancho_label || 'Sin ancho'),
            total_ventas: toNumber(r.total_ventas),
            total_unidades: toNumber(r.total_unidades),
            total_ml: toNumber(r.total_ml),
            porcentaje_ventas: toNumber(r.porcentaje_ventas),
          })),
          mixColor: plotterColorRows.map((r) => ({
            color_label: String(r.color_label || 'Sin color'),
            total_ventas: toNumber(r.total_ventas),
            total_unidades: toNumber(r.total_unidades),
            total_ml: toNumber(r.total_ml),
            porcentaje_ventas: toNumber(r.porcentaje_ventas),
          })),
          mixMarca: plotterMarcaRows.map((r) => ({
            marca_label: String(r.marca_label || 'Sin marca'),
            total_ventas: toNumber(r.total_ventas),
            total_unidades: toNumber(r.total_unidades),
            total_ml: toNumber(r.total_ml),
            porcentaje_ventas: toNumber(r.porcentaje_ventas),
          })),
          topMateriales: plotterMaterialesRows.map((r) => ({
            material_label: String(r.material_label || 'Sin material'),
            total_ventas: toNumber(r.total_ventas),
            total_unidades: toNumber(r.total_unidades),
            total_ml: toNumber(r.total_ml),
          })),
        },
        rigidos: {
          resumen: {
            total_ventas: toNumber(rigidosResumenRow?.total_ventas),
            total_ordenes: toNumber(rigidosResumenRow?.total_ordenes),
            total_unidades: toNumber(rigidosResumenRow?.total_unidades),
            total_mt2: toNumber(rigidosResumenRow?.total_mt2),
            ticket_promedio_orden: toNumber(rigidosResumenRow?.ticket_promedio_orden),
            precio_promedio_mt2: toNumber(rigidosResumenRow?.precio_promedio_mt2),
          },
          mixVarianteEspesor: rigidosVarianteRows.map((r) => ({
            variante_espesor_label: String(r.variante_espesor_label || 'Sin variante/espesor'),
            total_ventas: toNumber(r.total_ventas),
            total_unidades: toNumber(r.total_unidades),
            total_mt2: toNumber(r.total_mt2),
            porcentaje_ventas: toNumber(r.porcentaje_ventas),
          })),
          topMateriales: rigidosMaterialesRows.map((r) => ({
            material_label: String(r.material_label || 'Sin material'),
            total_ventas: toNumber(r.total_ventas),
            total_unidades: toNumber(r.total_unidades),
            total_mt2: toNumber(r.total_mt2),
          })),
          topMedidas: rigidosMedidasRows.map((r) => ({
            medida_label: String(r.medida_label || 'Sin medida'),
            total_ventas: toNumber(r.total_ventas),
            total_unidades: toNumber(r.total_unidades),
            total_mt2: toNumber(r.total_mt2),
          })),
        },
        sellos: {
          resumen: {
            total_ventas: toNumber(sellosResumenRow?.total_ventas),
            total_ordenes: toNumber(sellosResumenRow?.total_ordenes),
            total_unidades: toNumber(sellosResumenRow?.total_unidades),
            ticket_promedio_orden: toNumber(sellosResumenRow?.ticket_promedio_orden),
            precio_promedio_unidad: toNumber(sellosResumenRow?.precio_promedio_unidad),
          },
          mixTipoProducto: sellosTipoProductoRows.map((r) => ({
            tipo_producto: String(r.tipo_producto || 'Sin tipo'),
            total_ventas: toNumber(r.total_ventas),
            total_unidades: toNumber(r.total_unidades),
            total_ordenes: toNumber(r.total_ordenes),
            porcentaje_ventas: toNumber(r.porcentaje_ventas),
          })),
          mixTipoSello: sellosTipoSelloRows.map((r) => ({
            tipo_sello: String(r.tipo_sello || 'Sin tipo sello'),
            total_ventas: toNumber(r.total_ventas),
            total_unidades: toNumber(r.total_unidades),
            total_ordenes: toNumber(r.total_ordenes),
            porcentaje_ventas: toNumber(r.porcentaje_ventas),
          })),
          mixMarca: sellosMarcaRows.map((r) => ({
            marca_label: String(r.marca_label || 'Sin marca'),
            total_ventas: toNumber(r.total_ventas),
            total_unidades: toNumber(r.total_unidades),
            total_ordenes: toNumber(r.total_ordenes),
            porcentaje_ventas: toNumber(r.porcentaje_ventas),
          })),
          topMedidas: sellosMedidasRows.map((r) => ({
            medida_label: String(r.medida_label || 'Sin medida'),
            total_ventas: toNumber(r.total_ventas),
            total_unidades: toNumber(r.total_unidades),
            total_ordenes: toNumber(r.total_ordenes),
          })),
        },
        portabanners: {
          resumen: {
            total_ventas: toNumber(portabannersResumenRow?.total_ventas),
            total_ordenes: toNumber(portabannersResumenRow?.total_ordenes),
            total_unidades: toNumber(portabannersResumenRow?.total_unidades),
            total_area_mt2: toNumber(portabannersResumenRow?.total_area_mt2),
            ticket_promedio_orden: toNumber(portabannersResumenRow?.ticket_promedio_orden),
            precio_promedio_mt2: toNumber(portabannersResumenRow?.precio_promedio_mt2),
          },
          mixTecnologia: portabannersTecnologiaRows.map((r) => ({
            tecnologia_label: String(r.tecnologia_label || 'Sin tecnología'),
            total_ventas: toNumber(r.total_ventas),
            total_unidades: toNumber(r.total_unidades),
            total_area_mt2: toNumber(r.total_area_mt2),
            porcentaje_ventas: toNumber(r.porcentaje_ventas),
          })),
          topMedidas: portabannersMedidasRows.map((r) => ({
            medida_label: String(r.medida_label || 'Sin medida'),
            total_ventas: toNumber(r.total_ventas),
            total_unidades: toNumber(r.total_unidades),
            total_area_mt2: toNumber(r.total_area_mt2),
          })),
          areaResumen: portabannersAreaRows.map((r) => ({
            rango_label: String(r.rango_label || 'Sin rango'),
            total_ventas: toNumber(r.total_ventas),
            total_unidades: toNumber(r.total_unidades),
            total_area_mt2: toNumber(r.total_area_mt2),
          })),
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar BI Productos');
    } finally {
      setLoading(false);
    }
  }, [company?.id, preset, fechaInicio, fechaFin, categoria, tecnologiaGranFormato]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, meta, loading, error, refetch: fetchData };
}
