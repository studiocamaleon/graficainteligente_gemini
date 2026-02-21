import { useCallback, useEffect, useState } from 'react';
import { useAuth } from './useAuth';
import { supabase } from '../lib/supabase';
import type { BIExecutiveData, BIHookResult, BIMeta } from '../types/business-intelligence';
import type { BIQueryParams } from './biShared';
import { resolveBIMeta, toNumber } from './biShared';

export function useBIExecutive(params: BIQueryParams): BIHookResult<BIExecutiveData> {
  const { company } = useAuth();
  const { preset, fechaInicio, fechaFin } = params;
  const [data, setData] = useState<BIExecutiveData | null>(null);
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

      const { data: rpcData, error: rpcError } = await supabase.rpc('fn_bi_kpis_executive_v2', {
        p_company_id: company.id,
        p_fecha_inicio: resolvedMeta.fecha_inicio,
        p_fecha_fin: resolvedMeta.fecha_fin,
      });

      if (rpcError) throw rpcError;
      const row = (rpcData?.[0] || null) as Record<string, unknown> | null;
      if (!row) {
        setData({
          revenue_total: 0,
          revenue_growth_pct: 0,
          total_orders: 0,
          ticket_promedio: 0,
          cash_margin_pct: 0,
          brecha_cobranza: 0,
          canal_dominante: 'Sin datos',
          canal_concentracion_pct: 0,
        });
        return;
      }

      setData({
        revenue_total: toNumber(row.revenue_total),
        revenue_growth_pct: toNumber(row.revenue_growth_pct),
        total_orders: toNumber(row.total_orders),
        ticket_promedio: toNumber(row.ticket_promedio),
        cash_margin_pct: toNumber(row.cash_margin_pct),
        brecha_cobranza: toNumber(row.brecha_cobranza),
        canal_dominante: String(row.canal_dominante || 'Sin datos'),
        canal_concentracion_pct: toNumber(row.canal_concentracion_pct),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar BI Executive');
    } finally {
      setLoading(false);
    }
  }, [company?.id, preset, fechaInicio, fechaFin]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, meta, loading, error, refetch: fetchData };
}
