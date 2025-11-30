import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import type {
  ReporteGeneralData,
  PeriodoPreset,
} from '../types/reportes';

export function useReporteGeneral(
  periodoPreset: PeriodoPreset,
  fechaInicio?: string,
  fechaFin?: string
) {
  const { company } = useAuth();
  const [data, setData] = useState<ReporteGeneralData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReporteData = useCallback(async () => {
    if (!company?.id) return;

    try {
      setLoading(true);
      setError(null);

      const { data: rangoFechas, error: rangoError } = await supabase
        .rpc('fn_calcular_rango_fechas', {
          p_preset: periodoPreset,
          p_fecha_inicio: fechaInicio || null,
          p_fecha_fin: fechaFin || null,
        });

      if (rangoError) throw rangoError;

      const fechaInicioCalc = rangoFechas[0].fecha_inicio;
      const fechaFinCalc = rangoFechas[0].fecha_fin;

      // Determinar granularidad según rango de fechas
      const diffDays = Math.ceil((new Date(fechaFinCalc).getTime() - new Date(fechaInicioCalc).getTime()) / (1000 * 60 * 60 * 24));
      let granularidad = 'dia';
      if (diffDays > 90) {
        granularidad = 'mes';
      } else if (diffDays > 30) {
        granularidad = 'semana';
      }

      const [
        kpisResult,
        timelineResult,
        ingresosEgresosResult,
        canalResult,
        categoriaResult,
        productosResult,
        diaSemanaResult,
        horaResult,
        usuarioResult,
        tasaSenaResult,
      ] = await Promise.all([
        supabase.rpc('fn_reporte_ventas_kpis', {
          p_company_id: company.id,
          p_fecha_inicio: fechaInicioCalc,
          p_fecha_fin: fechaFinCalc,
        }),
        supabase.rpc('fn_reporte_ventas_timeline', {
          p_company_id: company.id,
          p_fecha_inicio: fechaInicioCalc,
          p_fecha_fin: fechaFinCalc,
          p_granularidad: 'dia',
        }),
        supabase.rpc('fn_reporte_ingresos_egresos', {
          p_company_id: company.id,
          p_fecha_inicio: fechaInicioCalc,
          p_fecha_fin: fechaFinCalc,
          p_granularidad: granularidad,
        }),
        supabase.rpc('fn_reporte_ventas_por_canal', {
          p_company_id: company.id,
          p_fecha_inicio: fechaInicioCalc,
          p_fecha_fin: fechaFinCalc,
        }),
        supabase.rpc('fn_reporte_ventas_por_categoria', {
          p_company_id: company.id,
          p_fecha_inicio: fechaInicioCalc,
          p_fecha_fin: fechaFinCalc,
        }),
        supabase.rpc('fn_reporte_top_productos', {
          p_company_id: company.id,
          p_fecha_inicio: fechaInicioCalc,
          p_fecha_fin: fechaFinCalc,
          p_limit: 10,
        }),
        supabase.rpc('fn_reporte_ventas_por_dia_semana', {
          p_company_id: company.id,
          p_fecha_inicio: fechaInicioCalc,
          p_fecha_fin: fechaFinCalc,
        }),
        supabase.rpc('fn_reporte_ventas_por_hora', {
          p_company_id: company.id,
          p_fecha_inicio: fechaInicioCalc,
          p_fecha_fin: fechaFinCalc,
        }),
        supabase.rpc('fn_reporte_ventas_por_usuario', {
          p_company_id: company.id,
          p_fecha_inicio: fechaInicioCalc,
          p_fecha_fin: fechaFinCalc,
          p_limit: 10,
        }),
        supabase.rpc('fn_reporte_tasa_sena', {
          p_company_id: company.id,
          p_fecha_inicio: fechaInicioCalc,
          p_fecha_fin: fechaFinCalc,
        }),
      ]);

      if (kpisResult.error) throw kpisResult.error;
      if (timelineResult.error) throw timelineResult.error;
      if (ingresosEgresosResult.error) throw ingresosEgresosResult.error;
      if (canalResult.error) throw canalResult.error;
      if (categoriaResult.error) throw categoriaResult.error;
      if (productosResult.error) throw productosResult.error;
      if (diaSemanaResult.error) throw diaSemanaResult.error;
      if (horaResult.error) throw horaResult.error;
      if (usuarioResult.error) throw usuarioResult.error;
      if (tasaSenaResult.error) throw tasaSenaResult.error;

      setData({
        kpis: kpisResult.data && kpisResult.data.length > 0 ? kpisResult.data[0] : null,
        timeline: timelineResult.data || [],
        ingresosEgresos: ingresosEgresosResult.data || [],
        porCanal: canalResult.data || [],
        porCategoria: categoriaResult.data || [],
        topProductos: productosResult.data || [],
        porDiaSemana: diaSemanaResult.data || [],
        porHora: horaResult.data || [],
        porUsuario: usuarioResult.data || [],
        tasaSena: tasaSenaResult.data && tasaSenaResult.data.length > 0 ? tasaSenaResult.data[0] : null,
      });
    } catch (err) {
      console.error('Error fetching reporte general:', err);
      setError(err instanceof Error ? err.message : 'Error al cargar el reporte');
    } finally {
      setLoading(false);
    }
  }, [company?.id, periodoPreset, fechaInicio, fechaFin]);

  useEffect(() => {
    fetchReporteData();
  }, [fetchReporteData]);

  return {
    data,
    loading,
    error,
    refetch: fetchReporteData,
  };
}
