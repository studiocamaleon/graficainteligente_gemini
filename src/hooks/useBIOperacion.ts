import { useCallback, useEffect, useState } from 'react';
import { useAuth } from './useAuth';
import { supabase } from '../lib/supabase';
import type { BIHookResult, BIOperacionData, BIMeta } from '../types/business-intelligence';
import type { BIQueryParams } from './biShared';
import { resolveBIMeta, toNumber } from './biShared';

export function useBIOperacion(params: BIQueryParams): BIHookResult<BIOperacionData> {
  const { company } = useAuth();
  const { preset, fechaInicio, fechaFin } = params;
  const [data, setData] = useState<BIOperacionData | null>(null);
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

      const [kpisRes, categoriaRes] = await Promise.all([
        supabase.rpc('fn_bi_operacion_kpis_v2', {
          p_company_id: company.id,
          p_fecha_inicio: resolvedMeta.fecha_inicio,
          p_fecha_fin: resolvedMeta.fecha_fin,
        }),
        supabase.rpc('fn_bi_operacion_tiempos_categoria_v2', {
          p_company_id: company.id,
          p_fecha_inicio: resolvedMeta.fecha_inicio,
          p_fecha_fin: resolvedMeta.fecha_fin,
        }),
      ]);
      if (kpisRes.error) throw kpisRes.error;
      if (categoriaRes.error) throw categoriaRes.error;

      const row = (kpisRes.data?.[0] || null) as Record<string, unknown> | null;
      const catRows = Array.isArray(categoriaRes.data) ? categoriaRes.data : [];
      if (!row) {
        setData({
          lead_time_dias_habiles_prom: 0,
          on_time_pct: 0,
          backlog_activo: 0,
          entregadas_periodo: 0,
          ciclo_mediano_dias_habiles: 0,
          tiempos_por_categoria: [],
        });
        return;
      }

      setData({
        lead_time_dias_habiles_prom: toNumber(row.lead_time_dias_habiles_prom),
        on_time_pct: toNumber(row.on_time_pct),
        backlog_activo: toNumber(row.backlog_activo),
        entregadas_periodo: toNumber(row.entregadas_periodo),
        ciclo_mediano_dias_habiles: toNumber(row.ciclo_mediano_dias_habiles),
        tiempos_por_categoria: catRows.map((r) => ({
          categoria_nombre: String(r.categoria_nombre || 'Sin categoría'),
          total_entregadas: toNumber(r.total_entregadas),
          lead_time_dias_habiles_prom: toNumber(r.lead_time_dias_habiles_prom),
        })),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar BI Operación');
    } finally {
      setLoading(false);
    }
  }, [company?.id, preset, fechaInicio, fechaFin]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, meta, loading, error, refetch: fetchData };
}
