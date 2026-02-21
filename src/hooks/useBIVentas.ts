import { useCallback, useEffect, useState } from 'react';
import { useAuth } from './useAuth';
import { supabase } from '../lib/supabase';
import type { BIHookResult, BIVentasData, BIGranularidad, BIMeta } from '../types/business-intelligence';
import type { BIQueryParams } from './biShared';
import { resolveBIMeta, toNumber } from './biShared';

interface UseBIVentasParams extends BIQueryParams {
  granularidad?: BIGranularidad;
}

export function useBIVentas(params: UseBIVentasParams): BIHookResult<BIVentasData> {
  const { company } = useAuth();
  const { preset, fechaInicio, fechaFin } = params;
  const granularidadParam = params.granularidad || 'dia';
  const [data, setData] = useState<BIVentasData | null>(null);
  const [meta, setMeta] = useState<BIMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const toRow = (input: unknown): Record<string, unknown>[] =>
    Array.isArray(input) ? (input as Record<string, unknown>[]) : [];

  const fetchData = useCallback(async () => {
    if (!company?.id) return;
    try {
      setLoading(true);
      setError(null);
      const resolvedMeta = await resolveBIMeta({ preset, fechaInicio, fechaFin });
      setMeta(resolvedMeta);

      const [timelineRes, canalRes, categoriaRes, topRes, heatRes] = await Promise.all([
        supabase.rpc('fn_bi_ventas_timeline_v2', {
          p_company_id: company.id,
          p_fecha_inicio: resolvedMeta.fecha_inicio,
          p_fecha_fin: resolvedMeta.fecha_fin,
          p_granularidad: granularidadParam,
        }),
        supabase.rpc('fn_bi_ventas_canal_v2', {
          p_company_id: company.id,
          p_fecha_inicio: resolvedMeta.fecha_inicio,
          p_fecha_fin: resolvedMeta.fecha_fin,
        }),
        supabase.rpc('fn_bi_ventas_categoria_v2', {
          p_company_id: company.id,
          p_fecha_inicio: resolvedMeta.fecha_inicio,
          p_fecha_fin: resolvedMeta.fecha_fin,
        }),
        supabase.rpc('fn_bi_top_productos_v2', {
          p_company_id: company.id,
          p_fecha_inicio: resolvedMeta.fecha_inicio,
          p_fecha_fin: resolvedMeta.fecha_fin,
          p_limit: 10,
        }),
        supabase.rpc('fn_bi_heatmap_horario_v2', {
          p_company_id: company.id,
          p_fecha_inicio: resolvedMeta.fecha_inicio,
          p_fecha_fin: resolvedMeta.fecha_fin,
        }),
      ]);

      if (timelineRes.error) throw timelineRes.error;
      if (canalRes.error) throw canalRes.error;
      if (categoriaRes.error) throw categoriaRes.error;
      if (topRes.error) throw topRes.error;
      if (heatRes.error) throw heatRes.error;

      const timelineRows = toRow(timelineRes.data);
      const canalRows = toRow(canalRes.data);
      const categoriaRows = toRow(categoriaRes.data);
      const topRows = toRow(topRes.data);
      const heatRows = toRow(heatRes.data);

      setData({
        timeline: timelineRows.map((r) => ({
          periodo: String(r.periodo),
          periodo_label: String(r.periodo_label || ''),
          total_ventas: toNumber(r.total_ventas),
          total_ordenes: toNumber(r.total_ordenes),
          ordenes_ot: toNumber(r.ordenes_ot),
          ordenes_oc: toNumber(r.ordenes_oc),
          ticket_promedio: toNumber(r.ticket_promedio),
        })),
        canales: canalRows.map((r) => ({
          canal: String(r.canal || 'Sin canal'),
          total_ventas: toNumber(r.total_ventas),
          total_ordenes: toNumber(r.total_ordenes),
          porcentaje_ventas: toNumber(r.porcentaje_ventas),
          ticket_promedio: toNumber(r.ticket_promedio),
        })),
        categorias: categoriaRows.map((r) => ({
          categoria_nombre: String(r.categoria_nombre || 'Sin categoría'),
          total_ventas: toNumber(r.total_ventas),
          total_ordenes: toNumber(r.total_ordenes),
          porcentaje_ventas: toNumber(r.porcentaje_ventas),
          ticket_promedio: toNumber(r.ticket_promedio),
        })),
        topProductos: topRows.map((r) => ({
          producto_nombre: String(r.producto_nombre || 'Sin nombre'),
          categoria_nombre: String(r.categoria_nombre || 'Sin categoría'),
          total_vendido: toNumber(r.total_vendido),
          unidades_vendidas: toNumber(r.unidades_vendidas),
          porcentaje_ventas: toNumber(r.porcentaje_ventas),
          ticket_promedio: toNumber(r.ticket_promedio),
        })),
        heatmap: heatRows.map((r) => ({
          dia_semana: toNumber(r.dia_semana),
          hora: toNumber(r.hora),
          total_ordenes: toNumber(r.total_ordenes),
        })),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar BI Ventas');
    } finally {
      setLoading(false);
    }
  }, [company?.id, preset, fechaInicio, fechaFin, granularidadParam]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, meta, loading, error, refetch: fetchData };
}
