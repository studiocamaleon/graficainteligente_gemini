import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import type { MetricasRendimientoOperador, ResumenActividadEquipo } from '../types/database';

interface UseRendimientoOperadoresParams {
  fecha_desde?: Date | null;
  fecha_hasta?: Date | null;
}

export function useRendimientoOperadores(params?: UseRendimientoOperadoresParams) {
  const { profile } = useAuth();
  const [metricas, setMetricas] = useState<MetricasRendimientoOperador[]>([]);
  const [resumenEquipo, setResumenEquipo] = useState<ResumenActividadEquipo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRendimiento = useCallback(async () => {
    if (!profile?.company_id) return;

    try {
      setLoading(true);
      setError(null);

      const fechaDesde = params?.fecha_desde?.toISOString() || null;
      const fechaHasta = params?.fecha_hasta?.toISOString() || null;

      const { data: metricasData, error: metricasError } = await supabase.rpc(
        'fn_metricas_rendimiento_operadores',
        {
          p_company_id: profile.company_id,
          p_fecha_desde: fechaDesde,
          p_fecha_hasta: fechaHasta,
        }
      );

      if (metricasError) throw metricasError;

      const { data: resumenData, error: resumenError } = await supabase.rpc(
        'fn_resumen_actividad_equipo',
        {
          p_company_id: profile.company_id,
          p_fecha_desde: fechaDesde,
          p_fecha_hasta: fechaHasta,
        }
      );

      if (resumenError) throw resumenError;

      setMetricas(metricasData || []);
      setResumenEquipo(resumenData && resumenData.length > 0 ? resumenData[0] : null);
    } catch (err) {
      console.error('Error fetching rendimiento operadores:', err);
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  }, [profile?.company_id, params?.fecha_desde, params?.fecha_hasta]);

  useEffect(() => {
    fetchRendimiento();
  }, [fetchRendimiento]);

  const refresh = useCallback(() => {
    fetchRendimiento();
  }, [fetchRendimiento]);

  return {
    metricas,
    resumenEquipo,
    loading,
    error,
    refresh,
  };
}
