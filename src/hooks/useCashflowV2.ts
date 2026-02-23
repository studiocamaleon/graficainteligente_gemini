import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import type { CashflowV2AssumptionsDelta, CashflowV2Basis, CashflowV2Meta, CashflowV2Point } from '../types/finanzas-cashflow-v2';
import { DEFAULT_CASHFLOW_V2_ASSUMPTIONS } from '../types/finanzas-cashflow-v2';

interface CashflowV2RpcRow {
  fecha: string;
  ingreso_cheques: number | null;
  ingreso_liquidaciones: number | null;
  ingreso_wip_futuro: number | null;
  ingreso_wip_vencido: number | null;
  ingreso_otros_vencidos: number | null;
  egreso_cheques: number | null;
  egreso_tarjetas: number | null;
  egreso_recurrentes: number | null;
  egreso_compras: number | null;
  total_ingreso_vencido: number | null;
  total_egreso_vencido: number | null;
  total_ingresos: number | null;
  total_egresos: number | null;
  saldo_diario: number | null;
  saldo_acumulado: number | null;
}

export function useCashflowV2(
  daysToProject: number,
  basis: CashflowV2Basis,
  assumptions: Partial<CashflowV2AssumptionsDelta>
) {
  const { company } = useAuth();
  const [data, setData] = useState<CashflowV2Point[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mergedAssumptions = useMemo<CashflowV2AssumptionsDelta>(
    () => ({ ...DEFAULT_CASHFLOW_V2_ASSUMPTIONS, ...assumptions }),
    [assumptions]
  );

  const rpcAssumptions = useMemo(
    () => ({
      pct_wip_overdue_collectable: 100 + mergedAssumptions.delta_wip_overdue_collectable,
      pct_wip_future_completion: 100 + mergedAssumptions.delta_wip_future_completion,
      pct_ingresos: 100 + mergedAssumptions.delta_ingresos,
      pct_egresos: 100 + mergedAssumptions.delta_egresos,
      include_overdue: mergedAssumptions.include_overdue,
    }),
    [mergedAssumptions]
  );

  const meta = useMemo<CashflowV2Meta>(
    () => ({
      basis,
      assumptions: mergedAssumptions,
      days_to_project: daysToProject,
      version: 'v3',
    }),
    [basis, daysToProject, mergedAssumptions]
  );

  const fetchCashflow = useCallback(async () => {
    if (!company?.id) return;

    try {
      const isInitialLoad = data.length === 0;
      if (isInitialLoad) setLoading(true);
      else setSyncing(true);
      setError(null);

      const { data: rpcData, error: rpcError } = await supabase.rpc('fn_get_cashflow_projection_v3', {
        p_company_id: company.id,
        p_days_to_project: daysToProject,
        p_basis: basis,
        p_params: rpcAssumptions,
        p_timezone: 'America/Argentina/Buenos_Aires',
      });

      if (rpcError) throw rpcError;

      const rows = (Array.isArray(rpcData) ? rpcData : []) as CashflowV2RpcRow[];

      const mapped = rows.map((r) => ({
        fecha: r.fecha,
        ingreso_cheques: Number(r.ingreso_cheques || 0),
        ingreso_liquidaciones: Number(r.ingreso_liquidaciones || 0),
        ingreso_wip_futuro: Number(r.ingreso_wip_futuro || 0),
        ingreso_wip_vencido: Number(r.ingreso_wip_vencido || 0),
        ingreso_otros_vencidos: Number(r.ingreso_otros_vencidos || 0),
        egreso_cheques: Number(r.egreso_cheques || 0),
        egreso_tarjetas: Number(r.egreso_tarjetas || 0),
        egreso_recurrentes: Number(r.egreso_recurrentes || 0),
        egreso_compras: Number(r.egreso_compras || 0),
        total_ingreso_vencido: Number(r.total_ingreso_vencido || 0),
        total_egreso_vencido: Number(r.total_egreso_vencido || 0),
        total_ingresos: Number(r.total_ingresos || 0),
        total_egresos: Number(r.total_egresos || 0),
        saldo_diario: Number(r.saldo_diario || 0),
        saldo_acumulado: Number(r.saldo_acumulado || 0),
      })) satisfies CashflowV2Point[];

      setData(mapped);
    } catch (err) {
      console.error('Error fetching cashflow v2:', err);
      if (data.length === 0) {
        setData([]);
      }
      setError(err instanceof Error ? err.message : 'No se pudo cargar Cashflow V2');
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  }, [company?.id, data.length, daysToProject, basis, rpcAssumptions]);

  useEffect(() => {
    fetchCashflow();
  }, [fetchCashflow]);

  return { data, meta, loading, syncing, error, refresh: fetchCashflow };
}
