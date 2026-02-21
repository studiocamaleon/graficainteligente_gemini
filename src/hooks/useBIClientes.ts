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

      const { data: rpcData, error: rpcError } = await supabase.rpc('fn_bi_clientes_kpis_v2', {
        p_company_id: company.id,
        p_fecha_inicio: resolvedMeta.fecha_inicio,
        p_fecha_fin: resolvedMeta.fecha_fin,
      });
      if (rpcError) throw rpcError;

      const row = (rpcData?.[0] || null) as Record<string, unknown> | null;
      if (!row) {
        setData({
          clientes_nuevos: 0,
          clientes_activos: 0,
          clientes_recurrentes: 0,
          frecuencia_compra: 0,
          recencia_media_dias: 0,
          concentracion_top10_pct: 0,
          ticket_promedio_cliente: 0,
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
