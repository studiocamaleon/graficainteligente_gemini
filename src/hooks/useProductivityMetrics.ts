import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import type { TasaCumplimiento, EvolutivoTasaCumplimiento } from '../types/database';

export interface KpiGenerales {
  total_ordenes_completadas: number;
  total_items_completados: number;
  total_pasos_completados: number;
  horas_promedio_por_orden: number;
  minutos_promedio_por_item: number;
  minutos_promedio_por_paso: number;
  total_horas_produccion: number;
  paso_mas_lento: string;
  paso_mas_lento_minutos: number;
  operario_mas_productivo: string;
  operario_pasos_completados: number;
}

export interface MetricaPaso {
  paso_id: string;
  paso_nombre: string;
  etapa_tipo: string;
  total_ejecuciones: number;
  minutos_promedio: number;
  minutos_minimo: number;
  minutos_maximo: number;
  desviacion_estandar: number;
  total_minutos: number;
}


export interface MetricaEtapa {
  etapa_tipo: string;
  total_pasos: number;
  minutos_promedio: number;
  minutos_totales: number;
  porcentaje_tiempo: number;
}

export interface MetricaOperario {
  operario_id: string;
  operario_nombre: string;
  operario_email: string;
  total_pasos_completados: number;
  minutos_promedio_por_paso: number;
  desviacion_estandar: number;
  total_horas: number;
}

export interface OrdenCompletada {
  orden_id: string;
  orden_numero: string;
  cliente_nombre: string;
  categoria_nombre: string;
  fecha_inicio: string;
  fecha_fin: string;
  duracion_horas: number;
  total_items: number;
  total_pasos_completados: number;
  estado: string;
}

export interface CuelloBottella {
  paso_nombre: string;
  tipo_etapa: string;
  total_ejecuciones: number;
  minutos_promedio: number;
  desviacion_estandar: number;
  coeficiente_variacion: number;
  es_cuello_botella: boolean;
  razon: string;
}

export interface TendenciaTemporal {
  periodo: string;
  ordenes_completadas: number;
  items_completados: number;
  pasos_completados: number;
  minutos_promedio_por_item: number;
  total_horas: number;
}

interface DateRange {
  desde: Date | null;
  hasta: Date | null;
}

export function useProductivityMetrics(dateRange?: DateRange) {
  const { profile, company } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // KPIs generales
  const [kpisGenerales, setKpisGenerales] = useState<KpiGenerales | null>(null);

  // Métricas detalladas
  const [metricasPorPaso, setMetricasPorPaso] = useState<MetricaPaso[]>([]);
  const [metricasPorEtapa, setMetricasPorEtapa] = useState<MetricaEtapa[]>([]);
  const [metricasPorOperario, setMetricasPorOperario] = useState<MetricaOperario[]>([]);

  // Análisis adicionales
  const [ordenesCompletadas, setOrdenesCompletadas] = useState<OrdenCompletada[]>([]);
  const [tendencias, setTendencias] = useState<TendenciaTemporal[]>([]);

  // Tasa de cumplimiento
  const [tasaCumplimiento, setTasaCumplimiento] = useState<TasaCumplimiento | null>(null);
  const [evolutivoTasa, setEvolutivoTasa] = useState<EvolutivoTasaCumplimiento[]>([]);

  // Obtener companyId desde profile o company
  const companyId = profile?.company_id || company?.id;

  // Logs de depuración
  console.log('[Productivity Hook] State:', {
    hasProfile: !!profile,
    hasCompany: !!company,
    companyId,
    profileCompanyId: profile?.company_id,
    companyObjectId: company?.id,
    dateRange: dateRange ? {
      desde: dateRange.desde?.toISOString(),
      hasta: dateRange.hasta?.toISOString()
    } : null,
    loading
  });

  const loadAllMetrics = useCallback(async () => {
    if (!companyId) {
      console.log('[Productivity] No company ID, skipping metrics load');
      setLoading(false);
      return;
    }

    console.log('[Productivity] Starting metrics load...');
    setLoading(true);
    setError(null);

    try {
      const fechaDesde = dateRange?.desde?.toISOString() || null;
      const fechaHasta = dateRange?.hasta?.toISOString() || null;

      console.log('[Productivity] Loading metrics with date range:', { fechaDesde, fechaHasta, companyId });

      // Cargar cada métrica individualmente y manejar errores por separado
      const results = await Promise.allSettled([
        loadKpisGenerales(fechaDesde, fechaHasta),
        loadMetricasPorPaso(fechaDesde, fechaHasta),
        loadMetricasPorEtapa(fechaDesde, fechaHasta),
        loadMetricasPorOperario(fechaDesde, fechaHasta),
        loadOrdenesCompletadas(fechaDesde, fechaHasta),
        loadTendencias(fechaDesde, fechaHasta),
        loadTasaCumplimiento(fechaDesde, fechaHasta),
        loadEvolutivoTasa(fechaDesde, fechaHasta),
      ]);

      // Verificar si hubo errores
      const errors = results.filter(r => r.status === 'rejected');
      if (errors.length > 0) {
        console.warn('[Productivity] Some metrics failed to load:', errors);
        // No lanzamos error, solo mostramos advertencia
      }

      console.log('[Productivity] Metrics load completed');
    } catch (err) {
      console.error('[Productivity] Unexpected error loading metrics:', err);
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      setError(`Error al cargar las métricas: ${errorMessage}`);
    } finally {
      console.log('[Productivity] Setting loading to false');
      setLoading(false);
    }
  }, [companyId, dateRange?.desde, dateRange?.hasta]);

  const loadKpisGenerales = async (fechaDesde: string | null, fechaHasta: string | null) => {
    try {
      console.log('[Productivity] Loading KPIs generales...');
      const { data, error } = await supabase.rpc('fn_kpis_generales', {
        p_company_id: companyId,
        p_fecha_desde: fechaDesde,
        p_fecha_hasta: fechaHasta,
      });

      if (error) {
        console.error('[Productivity] Error loading KPIs generales:', error);
        return; // No lanzar error, solo registrar
      }
      console.log('[Productivity] KPIs generales loaded:', data);
      if (data && data.length > 0) {
        setKpisGenerales(data[0]);
      }
    } catch (err) {
      console.error('[Productivity] Unexpected error in loadKpisGenerales:', err);
    }
  };

  const loadMetricasPorPaso = async (fechaDesde: string | null, fechaHasta: string | null) => {
    try {
      console.log('[Productivity] Loading metricas por paso...');
      const { data, error } = await supabase.rpc('fn_metricas_por_paso', {
        p_company_id: companyId,
        p_fecha_desde: fechaDesde,
        p_fecha_hasta: fechaHasta,
      });

      if (error) {
        console.error('[Productivity] Error loading metricas por paso:', error);
        return;
      }
      console.log('[Productivity] Metricas por paso loaded:', data?.length || 0, 'items');
      setMetricasPorPaso(data || []);
    } catch (err) {
      console.error('[Productivity] Unexpected error in loadMetricasPorPaso:', err);
    }
  };


  const loadMetricasPorEtapa = async (fechaDesde: string | null, fechaHasta: string | null) => {
    try {
      console.log('[Productivity] Loading metricas por etapa...');
      const { data, error } = await supabase.rpc('fn_metricas_por_etapa', {
        p_company_id: companyId,
        p_fecha_desde: fechaDesde,
        p_fecha_hasta: fechaHasta,
      });

      if (error) {
        console.error('[Productivity] Error loading metricas por etapa:', error);
        return;
      }
      console.log('[Productivity] Metricas por etapa loaded:', data?.length || 0, 'items');
      setMetricasPorEtapa(data || []);
    } catch (err) {
      console.error('[Productivity] Unexpected error in loadMetricasPorEtapa:', err);
    }
  };

  const loadMetricasPorOperario = async (fechaDesde: string | null, fechaHasta: string | null) => {
    try {
      console.log('[Productivity] Loading metricas por operario...');
      const { data, error } = await supabase.rpc('fn_metricas_por_operario', {
        p_company_id: companyId,
        p_fecha_desde: fechaDesde,
        p_fecha_hasta: fechaHasta,
      });

      if (error) {
        console.error('[Productivity] Error loading metricas por operario:', error);
        return;
      }
      console.log('[Productivity] Metricas por operario loaded:', data?.length || 0, 'items');
      setMetricasPorOperario(data || []);
    } catch (err) {
      console.error('[Productivity] Unexpected error in loadMetricasPorOperario:', err);
    }
  };

  const loadOrdenesCompletadas = async (fechaDesde: string | null, fechaHasta: string | null) => {
    try {
      console.log('[Productivity] Loading ordenes completadas...');
      const { data, error } = await supabase.rpc('fn_ordenes_completadas_detalle', {
        p_company_id: companyId,
        p_fecha_desde: fechaDesde,
        p_fecha_hasta: fechaHasta,
        p_limit: 50,
      });

      if (error) {
        console.error('[Productivity] Error loading ordenes completadas:', error);
        return;
      }
      console.log('[Productivity] Ordenes completadas loaded:', data?.length || 0, 'items');
      setOrdenesCompletadas(data || []);
    } catch (err) {
      console.error('[Productivity] Unexpected error in loadOrdenesCompletadas:', err);
    }
  };


  const loadTendencias = async (fechaDesde: string | null, fechaHasta: string | null) => {
    try {
      console.log('[Productivity] Loading tendencias temporales...');
      // Si no hay rango de fechas, usar últimos 30 días
      const desde = fechaDesde || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const hasta = fechaHasta || new Date().toISOString();

      const { data, error } = await supabase.rpc('fn_tendencias_temporales', {
        p_company_id: companyId,
        p_fecha_desde: desde,
        p_fecha_hasta: hasta,
        p_intervalo: 'day',
      });

      if (error) {
        console.error('[Productivity] Error loading tendencias temporales:', error);
        return;
      }
      console.log('[Productivity] Tendencias temporales loaded:', data?.length || 0, 'items');
      setTendencias(data || []);
    } catch (err) {
      console.error('[Productivity] Unexpected error in loadTendencias:', err);
    }
  };

  const loadTasaCumplimiento = async (fechaDesde: string | null, fechaHasta: string | null) => {
    try {
      console.log('[Productivity] Loading tasa de cumplimiento...');
      const { data, error } = await supabase.rpc('fn_tasa_cumplimiento', {
        p_company_id: companyId,
        p_fecha_desde: fechaDesde,
        p_fecha_hasta: fechaHasta,
      });

      if (error) {
        console.error('[Productivity] Error loading tasa cumplimiento:', error);
        return;
      }
      console.log('[Productivity] Tasa cumplimiento loaded:', data);
      if (data && data.length > 0) {
        setTasaCumplimiento(data[0]);
      }
    } catch (err) {
      console.error('[Productivity] Unexpected error in loadTasaCumplimiento:', err);
    }
  };

  const loadEvolutivoTasa = async (fechaDesde: string | null, fechaHasta: string | null) => {
    try {
      console.log('[Productivity] Loading evolutivo tasa cumplimiento...');
      // Si no hay rango, usar últimos 90 días
      const desde = fechaDesde || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
      const hasta = fechaHasta || new Date().toISOString();

      const { data, error } = await supabase.rpc('fn_evolutivo_tasa_cumplimiento', {
        p_company_id: companyId,
        p_fecha_desde: desde,
        p_fecha_hasta: hasta,
        p_intervalo: 'week',
      });

      if (error) {
        console.error('[Productivity] Error loading evolutivo tasa:', error);
        return;
      }
      console.log('[Productivity] Evolutivo tasa loaded:', data?.length || 0, 'items');
      setEvolutivoTasa(data || []);
    } catch (err) {
      console.error('[Productivity] Unexpected error in loadEvolutivoTasa:', err);
    }
  };

  useEffect(() => {
    console.log('[Productivity] useEffect triggered');
    if (companyId) {
      console.log('[Productivity] Calling loadAllMetrics from useEffect');
      loadAllMetrics();
    } else {
      console.log('[Productivity] No companyId, setting loading to false');
      setLoading(false);
    }
  }, [companyId, loadAllMetrics]);

  const refresh = () => {
    console.log('[Productivity] Manual refresh triggered');
    loadAllMetrics();
  };

  return {
    loading,
    error,
    kpisGenerales,
    metricasPorPaso,
    metricasPorEtapa,
    metricasPorOperario,
    ordenesCompletadas,
    tendencias,
    tasaCumplimiento,
    evolutivoTasa,
    refresh,
  };
}
