import { useCallback, useEffect, useState } from 'react';
import { useAuth } from './useAuth';
import { supabase } from '../lib/supabase';
import type { BICajaData, BIHookResult, BIMeta } from '../types/business-intelligence';
import type { BIQueryParams } from './biShared';
import { resolveBIMeta, toNumber } from './biShared';

export function useBICaja(params: BIQueryParams): BIHookResult<BICajaData> {
  const { company } = useAuth();
  const { preset, fechaInicio, fechaFin } = params;
  const [data, setData] = useState<BICajaData | null>(null);
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

      const [resumenRes, dsoCategoriaRes] = await Promise.all([
        supabase.rpc('fn_bi_caja_resumen_v2', {
          p_company_id: company.id,
          p_fecha_inicio: resolvedMeta.fecha_inicio,
          p_fecha_fin: resolvedMeta.fecha_fin,
        }),
        supabase.rpc('fn_bi_dso_por_categoria_v2', {
          p_company_id: company.id,
          p_fecha_inicio: resolvedMeta.fecha_inicio,
          p_fecha_fin: resolvedMeta.fecha_fin,
        }),
      ]);
      if (resumenRes.error) throw resumenRes.error;
      if (dsoCategoriaRes.error) throw dsoCategoriaRes.error;

      const row = (resumenRes.data?.[0] || null) as Record<string, unknown> | null;
      const dsoRows = Array.isArray(dsoCategoriaRes.data) ? dsoCategoriaRes.data : [];
      if (!row) {
        setData({
          ingresos_movimientos: 0,
          egresos_movimientos: 0,
          balance_movimientos: 0,
          cobrado_periodo: 0,
          pendiente_0_30: 0,
          pendiente_31_60: 0,
          pendiente_61_mas: 0,
          dso_estimado: 0,
          dso_por_categoria: [],
        });
        return;
      }

      setData({
        ingresos_movimientos: toNumber(row.ingresos_movimientos),
        egresos_movimientos: toNumber(row.egresos_movimientos),
        balance_movimientos: toNumber(row.balance_movimientos),
        cobrado_periodo: toNumber(row.cobrado_periodo),
        pendiente_0_30: toNumber(row.pendiente_0_30),
        pendiente_31_60: toNumber(row.pendiente_31_60),
        pendiente_61_mas: toNumber(row.pendiente_61_mas),
        dso_estimado: toNumber(row.dso_estimado),
        dso_por_categoria: dsoRows.map((r) => ({
          categoria_nombre: String(r.categoria_nombre || 'Sin categoría'),
          total_ordenes_cobradas: toNumber(r.total_ordenes_cobradas),
          dso_promedio_dias: toNumber(r.dso_promedio_dias),
          dso_mediana_dias: toNumber(r.dso_mediana_dias),
        })),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar BI Caja');
    } finally {
      setLoading(false);
    }
  }, [company?.id, preset, fechaInicio, fechaFin]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, meta, loading, error, refetch: fetchData };
}
