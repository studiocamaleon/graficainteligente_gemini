import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';

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
  tipo_etapa: string;
  total_ejecuciones: number;
  minutos_promedio: number;
  minutos_minimo: number;
  minutos_maximo: number;
  desviacion_estandar: number;
  total_minutos: number;
}

export interface MetricaCategoria {
  categoria_id: string;
  categoria_nombre: string;
  total_ordenes: number;
  total_items: number;
  minutos_promedio_por_item: number;
  minutos_minimo: number;
  minutos_maximo: number;
  desviacion_estandar: number;
}

export interface MetricaEtapa {
  tipo_etapa: string;
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
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // KPIs generales
  const [kpisGenerales, setKpisGenerales] = useState<KpiGenerales | null>(null);

  // Métricas detalladas
  const [metricasPorPaso, setMetricasPorPaso] = useState<MetricaPaso[]>([]);
  const [metricasPorCategoria, setMetricasPorCategoria] = useState<MetricaCategoria[]>([]);
  const [metricasPorEtapa, setMetricasPorEtapa] = useState<MetricaEtapa[]>([]);
  const [metricasPorOperario, setMetricasPorOperario] = useState<MetricaOperario[]>([]);

  // Análisis adicionales
  const [ordenesCompletadas, setOrdenesCompletadas] = useState<OrdenCompletada[]>([]);
  const [cuellosBottella, setCuellosBottella] = useState<CuelloBottella[]>([]);
  const [tendencias, setTendencias] = useState<TendenciaTemporal[]>([]);

  useEffect(() => {
    if (user?.companyId) {
      loadAllMetrics();
    }
  }, [user?.companyId, dateRange]);

  const loadAllMetrics = async () => {
    if (!user?.companyId) {
      console.log('[Productivity] No company ID, skipping metrics load');
      return;
    }

    console.log('[Productivity] Starting metrics load...');
    setLoading(true);
    setError(null);

    try {
      const fechaDesde = dateRange?.desde?.toISOString() || null;
      const fechaHasta = dateRange?.hasta?.toISOString() || null;

      console.log('[Productivity] Loading metrics with date range:', { fechaDesde, fechaHasta, companyId: user?.companyId });

      // Cargar cada métrica individualmente y manejar errores por separado
      const results = await Promise.allSettled([
        loadKpisGenerales(fechaDesde, fechaHasta),
        loadMetricasPorPaso(fechaDesde, fechaHasta),
        loadMetricasPorCategoria(fechaDesde, fechaHasta),
        loadMetricasPorEtapa(fechaDesde, fechaHasta),
        loadMetricasPorOperario(fechaDesde, fechaHasta),
        loadOrdenesCompletadas(fechaDesde, fechaHasta),
        loadCuellosBottella(fechaDesde, fechaHasta),
        loadTendencias(fechaDesde, fechaHasta),
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
  };

  const loadKpisGenerales = async (fechaDesde: string | null, fechaHasta: string | null) => {
    try {
      console.log('[Productivity] Loading KPIs generales...');
      const { data, error } = await supabase.rpc('fn_kpis_generales', {
        p_company_id: user?.companyId,
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
        p_company_id: user?.companyId,
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

  const loadMetricasPorCategoria = async (fechaDesde: string | null, fechaHasta: string | null) => {
    try {
      console.log('[Productivity] Loading metricas por categoria...');
      const { data, error } = await supabase.rpc('fn_metricas_por_categoria', {
        p_company_id: user?.companyId,
        p_fecha_desde: fechaDesde,
        p_fecha_hasta: fechaHasta,
      });

      if (error) {
        console.error('[Productivity] Error loading metricas por categoria:', error);
        return;
      }
      console.log('[Productivity] Metricas por categoria loaded:', data?.length || 0, 'items');
      setMetricasPorCategoria(data || []);
    } catch (err) {
      console.error('[Productivity] Unexpected error in loadMetricasPorCategoria:', err);
    }
  };

  const loadMetricasPorEtapa = async (fechaDesde: string | null, fechaHasta: string | null) => {
    try {
      console.log('[Productivity] Loading metricas por etapa...');
      const { data, error } = await supabase.rpc('fn_metricas_por_etapa', {
        p_company_id: user?.companyId,
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
        p_company_id: user?.companyId,
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
        p_company_id: user?.companyId,
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

  const loadCuellosBottella = async (fechaDesde: string | null, fechaHasta: string | null) => {
    try {
      console.log('[Productivity] Loading cuellos de botella...');
      const { data, error } = await supabase.rpc('fn_cuellos_botella', {
        p_company_id: user?.companyId,
        p_fecha_desde: fechaDesde,
        p_fecha_hasta: fechaHasta,
      });

      if (error) {
        console.error('[Productivity] Error loading cuellos de botella:', error);
        return;
      }
      console.log('[Productivity] Cuellos de botella loaded:', data?.length || 0, 'items');
      setCuellosBottella(data || []);
    } catch (err) {
      console.error('[Productivity] Unexpected error in loadCuellosBottella:', err);
    }
  };

  const loadTendencias = async (fechaDesde: string | null, fechaHasta: string | null) => {
    try {
      console.log('[Productivity] Loading tendencias temporales...');
      // Si no hay rango de fechas, usar últimos 30 días
      const desde = fechaDesde || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const hasta = fechaHasta || new Date().toISOString();

      const { data, error } = await supabase.rpc('fn_tendencias_temporales', {
        p_company_id: user?.companyId,
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

  const refresh = () => {
    loadAllMetrics();
  };

  return {
    loading,
    error,
    kpisGenerales,
    metricasPorPaso,
    metricasPorCategoria,
    metricasPorEtapa,
    metricasPorOperario,
    ordenesCompletadas,
    cuellosBottella,
    tendencias,
    refresh,
  };
}
