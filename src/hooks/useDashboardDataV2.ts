import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import type {
  DashboardActividadV2,
  DashboardKpiValue,
  DashboardKpisV2,
  DashboardOperativoV2,
  DashboardPeriod,
  DashboardScope,
  DashboardSeriesPoint,
  DashboardSeriesV2,
} from '../types/dashboard';

interface UseDashboardDataV2Options {
  initialScope?: DashboardScope;
  initialPeriod?: DashboardPeriod;
  tz?: string;
}

const DEFAULT_SCOPE: DashboardScope = 'ot';
const DEFAULT_PERIOD: DashboardPeriod = '7d';
const DEFAULT_TZ = 'America/Argentina/Buenos_Aires';

const EMPTY_KPI: DashboardKpiValue = {
  value: 0,
  prev: 0,
  deltaAbs: 0,
  deltaPct: 0,
  trend: 'flat',
};

const EMPTY_KPIS: DashboardKpisV2 = {
  pendientes: { ...EMPTY_KPI },
  enProceso: { ...EMPTY_KPI },
  vencidas: { ...EMPTY_KPI },
  finalizadasPeriodo: { ...EMPTY_KPI },
  cumplimiento: { ...EMPTY_KPI },
  updatedAt: null,
};

const EMPTY_SERIES: DashboardSeriesV2 = {
  creadas: [],
  finalizadas: [],
  cumplimiento: [],
  backlogAging: [],
};

const EMPTY_OPERATIVO: DashboardOperativoV2 = {
  proximasEntregas: [],
  actividadReciente: [],
};

const toNumber = (value: unknown): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const toArray = <T,>(value: unknown): T[] => {
  return Array.isArray(value) ? (value as T[]) : [];
};

const buildKpi = (value: number, prev: number): DashboardKpiValue => {
  const deltaAbs = value - prev;
  const deltaPct = prev === 0 ? (value === 0 ? 0 : 100) : (deltaAbs / prev) * 100;
  const trend: DashboardKpiValue['trend'] = deltaAbs > 0 ? 'up' : deltaAbs < 0 ? 'down' : 'flat';

  return {
    value,
    prev,
    deltaAbs,
    deltaPct,
    trend,
  };
};

export function useDashboardDataV2({
  initialScope = DEFAULT_SCOPE,
  initialPeriod = DEFAULT_PERIOD,
  tz = DEFAULT_TZ,
}: UseDashboardDataV2Options = {}) {
  const { company, profile } = useAuth();
  const companyId = profile?.company_id || company?.id || null;

  const [scope, setScope] = useState<DashboardScope>(initialScope);
  const [period, setPeriod] = useState<DashboardPeriod>(initialPeriod);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [kpis, setKpis] = useState<DashboardKpisV2>(EMPTY_KPIS);
  const [series, setSeries] = useState<DashboardSeriesV2>(EMPTY_SERIES);
  const [operativo, setOperativo] = useState<DashboardOperativoV2>(EMPTY_OPERATIVO);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);

  const refreshDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshInFlightRef = useRef(false);

  const loadAll = useCallback(async () => {
    if (!companyId || refreshInFlightRef.current) return;

    refreshInFlightRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const [kpiRes, seriesRes, operativoRes] = await Promise.all([
        supabase.rpc('fn_dashboard_kpis_v2', {
          p_company_id: companyId,
          p_scope: scope,
          p_period: period,
          p_tz: tz,
        }),
        supabase.rpc('fn_dashboard_series_v2', {
          p_company_id: companyId,
          p_scope: scope,
          p_period: period,
          p_tz: tz,
        }),
        supabase.rpc('fn_dashboard_operativo_v2', {
          p_company_id: companyId,
          p_scope: scope,
          p_period: period,
          p_limit_entregas: 10,
          p_limit_actividad: 15,
          p_tz: tz,
        }),
      ]);

      if (kpiRes.error) throw kpiRes.error;
      if (seriesRes.error) throw seriesRes.error;
      if (operativoRes.error) throw operativoRes.error;

      const k = (kpiRes.data as any[])?.[0] || {};
      const s = (seriesRes.data as any[])?.[0] || {};
      const o = (operativoRes.data as any[])?.[0] || {};

      setKpis({
        pendientes: buildKpi(toNumber(k.pendientes_count), toNumber(k.pendientes_prev)),
        enProceso: buildKpi(toNumber(k.en_proceso_count), toNumber(k.en_proceso_prev)),
        vencidas: buildKpi(toNumber(k.vencidas_count), toNumber(k.vencidas_prev)),
        finalizadasPeriodo: buildKpi(
          toNumber(k.finalizadas_periodo_count),
          toNumber(k.finalizadas_periodo_prev)
        ),
        cumplimiento: buildKpi(toNumber(k.cumplimiento_pct), toNumber(k.cumplimiento_prev)),
        updatedAt: k.updated_at || null,
      });

      setSeries({
        creadas: toArray<DashboardSeriesPoint>(s.series_creadas).map((x) => ({
          date: String(x.date || ''),
          label: String(x.label || ''),
          value: x.value === null || x.value === undefined ? null : toNumber(x.value),
        })),
        finalizadas: toArray<DashboardSeriesPoint>(s.series_finalizadas).map((x) => ({
          date: String(x.date || ''),
          label: String(x.label || ''),
          value: x.value === null || x.value === undefined ? null : toNumber(x.value),
        })),
        cumplimiento: toArray<DashboardSeriesPoint>(s.series_cumplimiento).map((x) => ({
          date: String(x.date || ''),
          label: String(x.label || ''),
          value: x.value === null || x.value === undefined ? null : toNumber(x.value),
        })),
        backlogAging: toArray<{ bucket: string; value: number }>(s.backlog_aging).map((x) => ({
          bucket: String(x.bucket || ''),
          value: toNumber(x.value),
        })),
      });

      setOperativo({
        proximasEntregas: toArray<any>(o.proximas_entregas).map((x) => ({
          ...x,
          progreso_porcentaje:
            x?.progreso_porcentaje === null || x?.progreso_porcentaje === undefined
              ? null
              : toNumber(x.progreso_porcentaje),
        })),
        actividadReciente: toArray<DashboardActividadV2>(o.actividad_reciente),
      });

      setLastUpdated(new Date());
    } catch (err) {
      console.error('Error loading dashboard v2:', err);
      setError('No se pudo cargar el dashboard. Reintentá en unos segundos.');
    } finally {
      refreshInFlightRef.current = false;
      setLoading(false);
    }
  }, [companyId, period, scope, tz]);

  const debouncedRefresh = useCallback(() => {
    if (refreshDebounceRef.current) {
      clearTimeout(refreshDebounceRef.current);
    }
    refreshDebounceRef.current = setTimeout(() => {
      void loadAll();
    }, 650);
  }, [loadAll]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (!companyId) return;

    const channel = supabase
      .channel(`dashboard-v2-${companyId}-${scope}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'ordenes_trabajo' },
        () => debouncedRefresh()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'centro_copiado_ordenes' },
        () => debouncedRefresh()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'ordenes_trabajo_items_rutas' },
        () => debouncedRefresh()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'ordenes_trabajo_historial' },
        () => debouncedRefresh()
      )
      .subscribe((status) => {
        setIsRealtimeConnected(status === 'SUBSCRIBED');
      });

    return () => {
      if (refreshDebounceRef.current) {
        clearTimeout(refreshDebounceRef.current);
      }
      void supabase.removeChannel(channel);
      setIsRealtimeConnected(false);
    };
  }, [companyId, debouncedRefresh, scope]);

  const refresh = useCallback(() => {
    void loadAll();
  }, [loadAll]);

  return useMemo(
    () => ({
      loading,
      error,
      scope,
      period,
      kpis,
      series,
      operativo,
      lastUpdated,
      isRealtimeConnected,
      setScope,
      setPeriod,
      refresh,
    }),
    [
      error,
      isRealtimeConnected,
      kpis,
      lastUpdated,
      loading,
      operativo,
      period,
      refresh,
      scope,
      series,
    ]
  );
}
