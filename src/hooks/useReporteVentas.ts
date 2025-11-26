import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';

type PeriodoPreset = 'hoy' | 'esta_semana' | 'este_mes' | 'mes_pasado' | 'ultimos_3_meses' | 'ultimos_6_meses' | 'este_anio' | 'anio_pasado' | 'personalizado';

interface KPIData {
  total_ventas: number;
  total_ordenes: number;
  ticket_promedio: number;
  total_cobrado: number;
  saldo_pendiente: number;
  tasa_cobro: number;
  variacion_ventas: number;
  variacion_ordenes: number;
}

interface TimelineData {
  fecha: string;
  total_ventas: number;
  total_ordenes: number;
  ticket_promedio: number;
}

interface CanalData {
  canal: string;
  total_ventas: number;
  total_ordenes: number;
  porcentaje: number;
  ticket_promedio: number;
}

interface ProductoData {
  producto_nombre: string;
  categoria_nombre: string;
  total_vendido: number;
  unidades_vendidas: number;
  porcentaje: number;
  ticket_promedio: number;
}

interface ReporteVentasData {
  kpis: KPIData | null;
  timeline: TimelineData[];
  porCanal: CanalData[];
  topProductos: ProductoData[];
}

export function useReporteVentas(
  periodoPreset: PeriodoPreset,
  fechaInicio?: string,
  fechaFin?: string
) {
  const { company } = useAuth();
  const [data, setData] = useState<ReporteVentasData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReporteData = useCallback(async () => {
    if (!company?.id) return;

    try {
      setLoading(true);
      setError(null);

      // Calcular rango de fechas
      const { data: rangoFechas, error: rangoError } = await supabase
        .rpc('fn_calcular_rango_fechas', {
          p_preset: periodoPreset,
          p_fecha_inicio: fechaInicio || null,
          p_fecha_fin: fechaFin || null,
        });

      if (rangoError) throw rangoError;

      const fechaInicioCalc = rangoFechas[0].fecha_inicio;
      const fechaFinCalc = rangoFechas[0].fecha_fin;

      // Cargar KPIs
      const { data: kpisData, error: kpisError } = await supabase
        .rpc('fn_reporte_ventas_kpis', {
          p_company_id: company.id,
          p_fecha_inicio: fechaInicioCalc,
          p_fecha_fin: fechaFinCalc,
        });

      if (kpisError) throw kpisError;

      // Cargar Timeline
      const { data: timelineData, error: timelineError } = await supabase
        .rpc('fn_reporte_ventas_timeline', {
          p_company_id: company.id,
          p_fecha_inicio: fechaInicioCalc,
          p_fecha_fin: fechaFinCalc,
          p_granularidad: 'dia',
        });

      if (timelineError) throw timelineError;

      // Cargar Ventas por Canal
      const { data: canalData, error: canalError } = await supabase
        .rpc('fn_reporte_ventas_por_canal', {
          p_company_id: company.id,
          p_fecha_inicio: fechaInicioCalc,
          p_fecha_fin: fechaFinCalc,
        });

      if (canalError) throw canalError;

      // Cargar Top Productos
      const { data: productosData, error: productosError } = await supabase
        .rpc('fn_reporte_top_productos', {
          p_company_id: company.id,
          p_fecha_inicio: fechaInicioCalc,
          p_fecha_fin: fechaFinCalc,
          p_limit: 10,
        });

      if (productosError) throw productosError;

      setData({
        kpis: kpisData && kpisData.length > 0 ? kpisData[0] : null,
        timeline: timelineData || [],
        porCanal: canalData || [],
        topProductos: productosData || [],
      });
    } catch (err) {
      console.error('Error fetching reporte ventas:', err);
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
