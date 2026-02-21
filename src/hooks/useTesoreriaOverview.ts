import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';

type TesoreriaPeriodo = '7d' | '30d' | '90d';

export interface TesoreriaOverview {
  ingresos_total: number;
  egresos_total: number;
  saldo_neto: number;
  por_cobrar_total: number;
  por_pagar_total: number;
  cheques_emitidos_pendientes: number;
  cheques_recibidos_pendientes: number;
  cajas_activas_count: number;
  updated_at: string;
}

const periodToDays: Record<TesoreriaPeriodo, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
};

function toIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function useTesoreriaOverview(period: TesoreriaPeriodo = '30d') {
  const { profile } = useAuth();
  const [overview, setOverview] = useState<TesoreriaOverview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const range = useMemo(() => {
    const days = periodToDays[period];
    const to = new Date();
    const from = new Date();
    from.setDate(to.getDate() - days + 1);
    return { from: toIsoDate(from), to: toIsoDate(to) };
  }, [period]);

  const fetchOverview = useCallback(async () => {
    if (!profile?.company_id) return;

    try {
      setLoading(true);
      setError(null);

      const { data, error: rpcError } = await supabase.rpc('fn_tesoreria_overview_v1', {
        p_company_id: profile.company_id,
        p_from: range.from,
        p_to: range.to,
      });

      if (rpcError) throw rpcError;

      const row = Array.isArray(data) ? data[0] : null;
      if (!row) {
        setOverview(null);
        return;
      }

      setOverview({
        ingresos_total: Number(row.ingresos_total || 0),
        egresos_total: Number(row.egresos_total || 0),
        saldo_neto: Number(row.saldo_neto || 0),
        por_cobrar_total: Number(row.por_cobrar_total || 0),
        por_pagar_total: Number(row.por_pagar_total || 0),
        cheques_emitidos_pendientes: Number(row.cheques_emitidos_pendientes || 0),
        cheques_recibidos_pendientes: Number(row.cheques_recibidos_pendientes || 0),
        cajas_activas_count: Number(row.cajas_activas_count || 0),
        updated_at: row.updated_at || new Date().toISOString(),
      });
    } catch (err) {
      console.error('Error fetching tesoreria overview:', err);
      setError(err instanceof Error ? err.message : 'Error al cargar métricas de tesorería');
    } finally {
      setLoading(false);
    }
  }, [profile?.company_id, range.from, range.to]);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  return {
    overview,
    loading,
    error,
    range,
    refetch: fetchOverview,
  };
}
