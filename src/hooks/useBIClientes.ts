import { useCallback, useEffect, useState } from 'react';
import { useAuth } from './useAuth';
import { supabase } from '../lib/supabase';
import type { BIClientesData, BIHookResult, BIMeta } from '../types/business-intelligence';
import type { BIQueryParams } from './biShared';
import { resolveBIMeta, toNumber } from './biShared';

export function useBIClientes(params: BIQueryParams): BIHookResult<BIClientesData> {
  const { company } = useAuth();
  const { preset, fechaInicio, fechaFin } = params;
  const [data, setData] = useState<BIClientesData | null>(null);
  const [meta, setMeta] = useState<BIMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!company?.id) return;
    try {
      setLoading(true);
      setError(null);
      const resolvedMeta = await resolveBIMeta({ preset, fechaInicio, fechaFin });
      setMeta(resolvedMeta);

      const [kpisRes, ltvResumenRes, topLtvRes] = await Promise.all([
        supabase.rpc('fn_bi_clientes_kpis_v2', {
          p_company_id: company.id,
          p_fecha_inicio: resolvedMeta.fecha_inicio,
          p_fecha_fin: resolvedMeta.fecha_fin,
        }),
        supabase.rpc('fn_bi_clientes_ltv_resumen_v2', {
          p_company_id: company.id,
        }),
        supabase.rpc('fn_bi_clientes_top_ltv_v2', {
          p_company_id: company.id,
          p_limit: 10,
        }),
      ]);
      if (kpisRes.error) throw kpisRes.error;
      if (ltvResumenRes.error) throw ltvResumenRes.error;
      if (topLtvRes.error) throw topLtvRes.error;

      const row = (kpisRes.data?.[0] || null) as Record<string, unknown> | null;
      const ltvResumen = (ltvResumenRes.data?.[0] || null) as Record<string, unknown> | null;
      const topRows = Array.isArray(topLtvRes.data) ? (topLtvRes.data as Record<string, unknown>[]) : [];
      if (!row) {
        setData({
          clientes_nuevos: 0,
          clientes_activos: 0,
          clientes_recurrentes: 0,
          frecuencia_compra: 0,
          recencia_media_dias: 0,
          concentracion_top10_pct: 0,
          ticket_promedio_cliente: 0,
          ltv_promedio: 0,
          ltv_mediano: 0,
          clientes_con_compras_historicas: 0,
          top_ltv_clientes: [],
        });
        return;
      }

      setData({
        clientes_nuevos: toNumber(row.clientes_nuevos),
        clientes_activos: toNumber(row.clientes_activos),
        clientes_recurrentes: toNumber(row.clientes_recurrentes),
        frecuencia_compra: toNumber(row.frecuencia_compra),
        recencia_media_dias: toNumber(row.recencia_media_dias),
        concentracion_top10_pct: toNumber(row.concentracion_top10_pct),
        ticket_promedio_cliente: toNumber(row.ticket_promedio_cliente),
        ltv_promedio: toNumber(ltvResumen?.ltv_promedio),
        ltv_mediano: toNumber(ltvResumen?.ltv_mediano),
        clientes_con_compras_historicas: toNumber(ltvResumen?.clientes_con_compras),
        top_ltv_clientes: topRows.map((r) => ({
          cliente_id: String(r.cliente_id || ''),
          cliente_nombre: String(r.cliente_nombre || 'Cliente sin nombre'),
          ltv_total: toNumber(r.ltv_total),
          total_ordenes: toNumber(r.total_ordenes),
          ticket_promedio: toNumber(r.ticket_promedio),
        })),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar BI Clientes');
    } finally {
      setLoading(false);
    }
  }, [company?.id, preset, fechaInicio, fechaFin]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, meta, loading, error, refetch: fetchData };
}
