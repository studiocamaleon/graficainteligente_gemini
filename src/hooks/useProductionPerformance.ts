import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';

export type PerformancePeriod = '7d' | '30d' | '90d';

export interface PerformanceOption {
  id: string;
  label: string;
}

export interface PerformanceFilters {
  period: PerformancePeriod;
  estacionId: string | null;
  userId: string | null;
}

export interface PerformanceKpis {
  tareasTerminadas: number;
  ordenesCompletas: number;
  cicloPromedioHoras: number;
  cicloPromedioDias: number;
  cumplimientoPct: number;
}

export interface CompletedByUserPoint {
  responsableId: string | null;
  responsableNombre: string;
  tareasTerminadas: number;
  horasTotales: number;
  minutosPromedio: number;
}

export interface CompletedByStationPoint {
  estacionId: string | null;
  estacionNombre: string;
  tareasTerminadas: number;
  minutosPromedio: number;
  horasTotales: number;
}

export interface CycleTrendPoint {
  dia: string;
  label: string;
  cicloPromedioHoras: number;
  ordenesCompletas: number;
}

export type WorktableUrgency = 'vencida' | 'hoy' | 'manana' | 'futura' | 'sin_fecha';

export interface WorktableTask {
  userId: string | null;
  userName: string;
  rutaId: string;
  numeroOrden: string;
  clienteNombre: string;
  pasoNombre: string;
  estacionNombre: string;
  fechaEstimadaEntrega: string | null;
  urgencia: WorktableUrgency;
  assignedAt: string | null;
}

export interface WorktableGroup {
  userId: string;
  userName: string;
  tasks: WorktableTask[];
}

interface UseProductionPerformanceResult {
  loading: boolean;
  error: string | null;
  filters: PerformanceFilters;
  estaciones: PerformanceOption[];
  usuarios: PerformanceOption[];
  kpis: PerformanceKpis;
  seriesByUser: CompletedByUserPoint[];
  seriesByStation: CompletedByStationPoint[];
  cycleTrend: CycleTrendPoint[];
  worktablesByUser: WorktableGroup[];
  lastUpdated: Date | null;
  isRealtimeConnected: boolean;
  setPeriod: (period: PerformancePeriod) => void;
  setEstacionId: (estacionId: string | null) => void;
  setUserId: (userId: string | null) => void;
  refresh: () => void;
}

const EMPTY_KPIS: PerformanceKpis = {
  tareasTerminadas: 0,
  ordenesCompletas: 0,
  cicloPromedioHoras: 0,
  cicloPromedioDias: 0,
  cumplimientoPct: 0,
};

const DEFAULT_FILTERS: PerformanceFilters = {
  period: '30d',
  estacionId: null,
  userId: null,
};

const toNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const toNullableString = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
};

function getPeriodBounds(period: PerformancePeriod): { from: string; to: string } {
  const now = new Date();
  const to = now.toISOString();

  const start = new Date(now);
  start.setHours(0, 0, 0, 0);

  const days = period === '90d' ? 90 : period === '7d' ? 7 : 30;
  start.setDate(start.getDate() - (days - 1));

  return {
    from: start.toISOString(),
    to,
  };
}

export function useProductionPerformance(): UseProductionPerformanceResult {
  const { profile, company } = useAuth();
  const companyId = profile?.company_id || company?.id || null;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<PerformanceFilters>(DEFAULT_FILTERS);

  const [estaciones, setEstaciones] = useState<PerformanceOption[]>([]);
  const [usuarios, setUsuarios] = useState<PerformanceOption[]>([]);

  const [kpis, setKpis] = useState<PerformanceKpis>(EMPTY_KPIS);
  const [seriesByUser, setSeriesByUser] = useState<CompletedByUserPoint[]>([]);
  const [seriesByStation, setSeriesByStation] = useState<CompletedByStationPoint[]>([]);
  const [cycleTrend, setCycleTrend] = useState<CycleTrendPoint[]>([]);
  const [worktablesByUser, setWorktablesByUser] = useState<WorktableGroup[]>([]);

  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);

  const inFlightRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setPeriod = useCallback((period: PerformancePeriod) => {
    setFilters((prev) => ({ ...prev, period }));
  }, []);

  const setEstacionId = useCallback((estacionId: string | null) => {
    setFilters((prev) => ({ ...prev, estacionId }));
  }, []);

  const setUserId = useCallback((userId: string | null) => {
    setFilters((prev) => ({ ...prev, userId }));
  }, []);

  const loadOptions = useCallback(async () => {
    if (!companyId) return;

    const [estacionesRes, usuariosRes] = await Promise.all([
      supabase
        .from('estaciones_trabajo')
        .select('id, nombre')
        .eq('company_id', companyId)
        .eq('is_active', true)
        .order('nombre', { ascending: true }),
      supabase
        .from('profiles')
        .select('id, full_name')
        .eq('company_id', companyId)
        .eq('is_active', true)
        .order('full_name', { ascending: true }),
    ]);

    if (!estacionesRes.error) {
      setEstaciones(
        (estacionesRes.data || []).map((row: any) => ({
          id: row.id,
          label: row.nombre || 'Estación sin nombre',
        }))
      );
    }

    if (!usuariosRes.error) {
      setUsuarios(
        (usuariosRes.data || []).map((row: any) => ({
          id: row.id,
          label: row.full_name || 'Usuario sin nombre',
        }))
      );
    }
  }, [companyId]);

  const loadPerformance = useCallback(async () => {
    if (!companyId || inFlightRef.current) return;

    const { from, to } = getPeriodBounds(filters.period);

    inFlightRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const [kpiRes, byUserRes, byStationRes, cycleRes, mesaRes] = await Promise.all([
        supabase.rpc('fn_production_performance_kpis', {
          p_company_id: companyId,
          p_from: from,
          p_to: to,
          p_estacion_id: filters.estacionId,
          p_user_id: filters.userId,
          p_tz: 'America/Argentina/Buenos_Aires',
        }),
        supabase.rpc('fn_production_completed_by_user', {
          p_company_id: companyId,
          p_from: from,
          p_to: to,
          p_estacion_id: filters.estacionId,
          p_user_id: filters.userId,
        }),
        supabase.rpc('fn_production_completed_by_station', {
          p_company_id: companyId,
          p_from: from,
          p_to: to,
          p_estacion_id: filters.estacionId,
          p_user_id: filters.userId,
        }),
        supabase.rpc('fn_production_cycle_trend', {
          p_company_id: companyId,
          p_from: from,
          p_to: to,
          p_estacion_id: filters.estacionId,
          p_user_id: filters.userId,
          p_tz: 'America/Argentina/Buenos_Aires',
        }),
        supabase.rpc('fn_production_worktables_snapshot', {
          p_company_id: companyId,
          p_estacion_id: filters.estacionId,
          p_tz: 'America/Argentina/Buenos_Aires',
        }),
      ]);

      if (kpiRes.error) throw kpiRes.error;
      if (byUserRes.error) throw byUserRes.error;
      if (byStationRes.error) throw byStationRes.error;
      if (cycleRes.error) throw cycleRes.error;
      if (mesaRes.error) throw mesaRes.error;

      const kpiRow = Array.isArray(kpiRes.data) && kpiRes.data.length > 0 ? kpiRes.data[0] : null;

      setKpis({
        tareasTerminadas: toNumber(kpiRow?.tareas_terminadas),
        ordenesCompletas: toNumber(kpiRow?.ordenes_completas),
        cicloPromedioHoras: toNumber(kpiRow?.ciclo_promedio_horas),
        cicloPromedioDias: toNumber(kpiRow?.ciclo_promedio_dias),
        cumplimientoPct: toNumber(kpiRow?.cumplimiento_pct),
      });

      setSeriesByUser(
        (byUserRes.data || []).map((row: any) => ({
          responsableId: toNullableString(row.responsable_id),
          responsableNombre: toNullableString(row.responsable_nombre) || 'Sin asignar',
          tareasTerminadas: toNumber(row.tareas_terminadas),
          horasTotales: toNumber(row.horas_totales),
          minutosPromedio: toNumber(row.minutos_promedio),
        }))
      );

      setSeriesByStation(
        (byStationRes.data || []).map((row: any) => ({
          estacionId: toNullableString(row.estacion_id),
          estacionNombre: toNullableString(row.estacion_nombre) || 'Sin estación',
          tareasTerminadas: toNumber(row.tareas_terminadas),
          minutosPromedio: toNumber(row.minutos_promedio),
          horasTotales: toNumber(row.horas_totales),
        }))
      );

      setCycleTrend(
        (cycleRes.data || []).map((row: any) => ({
          dia: toNullableString(row.dia) || '',
          label: toNullableString(row.label) || '--',
          cicloPromedioHoras: toNumber(row.ciclo_promedio_horas),
          ordenesCompletas: toNumber(row.ordenes_completas),
        }))
      );

      const tasks: WorktableTask[] = (mesaRes.data || []).map((row: any) => ({
        userId: toNullableString(row.user_id),
        userName: toNullableString(row.user_name) || 'Usuario desconocido',
        rutaId: toNullableString(row.ruta_id) || '',
        numeroOrden: toNullableString(row.numero_orden) || 'Sin número',
        clienteNombre: toNullableString(row.cliente_nombre) || 'Cliente',
        pasoNombre: toNullableString(row.paso_nombre) || 'Paso',
        estacionNombre: toNullableString(row.estacion_nombre) || 'Sin estación',
        fechaEstimadaEntrega: toNullableString(row.fecha_estimada_entrega),
        urgencia: (toNullableString(row.urgencia) as WorktableUrgency) || 'sin_fecha',
        assignedAt: toNullableString(row.assigned_at),
      }));

      const grouped = new Map<string, WorktableGroup>();

      tasks.forEach((task) => {
        const key = task.userId || '__unknown__';
        if (!grouped.has(key)) {
          grouped.set(key, {
            userId: key,
            userName: task.userName,
            tasks: [],
          });
        }
        grouped.get(key)?.tasks.push(task);
      });

      const orderedGroups = Array.from(grouped.values())
        .map((group) => ({
          ...group,
          tasks: [...group.tasks].sort((a, b) => {
            const timeA = a.fechaEstimadaEntrega ? new Date(a.fechaEstimadaEntrega).getTime() : Number.POSITIVE_INFINITY;
            const timeB = b.fechaEstimadaEntrega ? new Date(b.fechaEstimadaEntrega).getTime() : Number.POSITIVE_INFINITY;
            return timeA - timeB;
          }),
        }))
        .sort((a, b) => a.userName.localeCompare(b.userName));

      setWorktablesByUser(orderedGroups);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Error loading production performance:', err);
      setError('No se pudieron cargar las métricas de rendimiento.');
    } finally {
      inFlightRef.current = false;
      setLoading(false);
    }
  }, [companyId, filters.estacionId, filters.period, filters.userId]);

  const debouncedRefresh = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void loadPerformance();
    }, 700);
  }, [loadPerformance]);

  useEffect(() => {
    void loadOptions();
  }, [loadOptions]);

  useEffect(() => {
    void loadPerformance();
  }, [loadPerformance]);

  useEffect(() => {
    if (!companyId) return;

    const channel = supabase
      .channel(`production-performance-${companyId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'ordenes_items_mesa_trabajo' },
        () => debouncedRefresh()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'ordenes_trabajo_items_rutas' },
        () => debouncedRefresh()
      )
      .subscribe((status) => {
        setIsRealtimeConnected(status === 'SUBSCRIBED');
      });

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      void supabase.removeChannel(channel);
      setIsRealtimeConnected(false);
    };
  }, [companyId, debouncedRefresh]);

  const refresh = useCallback(() => {
    void loadPerformance();
  }, [loadPerformance]);

  return useMemo(
    () => ({
      loading,
      error,
      filters,
      estaciones,
      usuarios,
      kpis,
      seriesByUser,
      seriesByStation,
      cycleTrend,
      worktablesByUser,
      lastUpdated,
      isRealtimeConnected,
      setPeriod,
      setEstacionId,
      setUserId,
      refresh,
    }),
    [
      loading,
      error,
      filters,
      estaciones,
      usuarios,
      kpis,
      seriesByUser,
      seriesByStation,
      cycleTrend,
      worktablesByUser,
      lastUpdated,
      isRealtimeConnected,
      setPeriod,
      setEstacionId,
      setUserId,
      refresh,
    ]
  );
}
