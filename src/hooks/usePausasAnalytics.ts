import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export interface PausasKPIs {
  total_pausas: number;
  pausas_activas: number;
  pausas_cerradas: number;
  tiempo_total_pausado_horas: number;
  tiempo_promedio_pausa_horas: number;
  pausa_mas_larga_horas: number;
  ordenes_afectadas: number;
  pasos_pausados_unicos: number;
}

export interface PausaCategoria {
  categoria: string;
  cantidad: number;
  porcentaje: number;
  tiempo_total_horas: number;
  tiempo_promedio_horas: number;
}

export interface PausaEvolucion {
  periodo: string;
  fecha: string;
  cantidad_pausas: number;
  tiempo_total_horas: number;
}

export interface PausaProlongada {
  pausa_id: string;
  orden_numero: string;
  paso_nombre: string;
  categoria: string;
  motivo_nombre: string;
  descripcion: string | null;
  duracion_horas: number;
  fecha_inicio: string;
  fecha_fin: string | null;
  esta_activa: boolean;
}

export interface PasoMasPausado {
  paso_nombre: string;
  tipo_etapa: string;
  cantidad_pausas: number;
  tiempo_total_horas: number;
  tiempo_promedio_horas: number;
  categoria_principal: string;
}

interface UsePausasAnalyticsParams {
  fechaDesde?: Date;
  fechaHasta?: Date;
  agrupacion?: 'dia' | 'semana' | 'mes';
  autoLoad?: boolean;
}

export function usePausasAnalytics({
  fechaDesde = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
  fechaHasta = new Date(),
  agrupacion = 'dia',
  autoLoad = true,
}: UsePausasAnalyticsParams = {}) {
  const [kpis, setKpis] = useState<PausasKPIs | null>(null);
  const [categorias, setCategorias] = useState<PausaCategoria[]>([]);
  const [evolucion, setEvolucion] = useState<PausaEvolucion[]>([]);
  const [pausasProlongadas, setPausasProlongadas] = useState<PausaProlongada[]>([]);
  const [pasosMasPausados, setPasosMasPausados] = useState<PasoMasPausado[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargarKPIs = useCallback(async () => {
    try {
      const { data, error: errorKPIs } = await supabase.rpc('fn_pausas_kpis_generales', {
        p_fecha_desde: fechaDesde.toISOString(),
        p_fecha_hasta: fechaHasta.toISOString(),
      });

      if (errorKPIs) throw errorKPIs;

      setKpis(data?.[0] || null);
    } catch (err) {
      console.error('Error cargando KPIs:', err);
      throw err;
    }
  }, [fechaDesde, fechaHasta]);

  const cargarCategorias = useCallback(async () => {
    try {
      const { data, error: errorCat } = await supabase.rpc('fn_pausas_por_categoria', {
        p_fecha_desde: fechaDesde.toISOString(),
        p_fecha_hasta: fechaHasta.toISOString(),
      });

      if (errorCat) throw errorCat;

      setCategorias(data || []);
    } catch (err) {
      console.error('Error cargando categorías:', err);
      throw err;
    }
  }, [fechaDesde, fechaHasta]);

  const cargarEvolucion = useCallback(async () => {
    try {
      const { data, error: errorEvol } = await supabase.rpc('fn_pausas_evolucion_temporal', {
        p_fecha_desde: fechaDesde.toISOString(),
        p_fecha_hasta: fechaHasta.toISOString(),
        p_agrupacion: agrupacion,
      });

      if (errorEvol) throw errorEvol;

      setEvolucion(data || []);
    } catch (err) {
      console.error('Error cargando evolución:', err);
      throw err;
    }
  }, [fechaDesde, fechaHasta, agrupacion]);

  const cargarPausasProlongadas = useCallback(async (limit = 10) => {
    try {
      const { data, error: errorProl } = await supabase.rpc('fn_pausas_mas_prolongadas', {
        p_fecha_desde: fechaDesde.toISOString(),
        p_fecha_hasta: fechaHasta.toISOString(),
        p_limit: limit,
      });

      if (errorProl) throw errorProl;

      setPausasProlongadas(data || []);
    } catch (err) {
      console.error('Error cargando pausas prolongadas:', err);
      throw err;
    }
  }, [fechaDesde, fechaHasta]);

  const cargarPasosMasPausados = useCallback(async (limit = 10) => {
    try {
      const { data, error: errorPasos } = await supabase.rpc('fn_pasos_mas_pausados', {
        p_fecha_desde: fechaDesde.toISOString(),
        p_fecha_hasta: fechaHasta.toISOString(),
        p_limit: limit,
      });

      if (errorPasos) throw errorPasos;

      setPasosMasPausados(data || []);
    } catch (err) {
      console.error('Error cargando pasos más pausados:', err);
      throw err;
    }
  }, [fechaDesde, fechaHasta]);

  const cargarTodo = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      await Promise.all([
        cargarKPIs(),
        cargarCategorias(),
        cargarEvolucion(),
        cargarPausasProlongadas(),
        cargarPasosMasPausados(),
      ]);
    } catch (err) {
      console.error('Error cargando analíticas:', err);
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  }, [cargarKPIs, cargarCategorias, cargarEvolucion, cargarPausasProlongadas, cargarPasosMasPausados]);

  useEffect(() => {
    if (autoLoad) {
      cargarTodo();
    }
  }, [autoLoad, cargarTodo]);

  return {
    kpis,
    categorias,
    evolucion,
    pausasProlongadas,
    pasosMasPausados,
    loading,
    error,
    recargar: cargarTodo,
    cargarKPIs,
    cargarCategorias,
    cargarEvolucion,
    cargarPausasProlongadas,
    cargarPasosMasPausados,
  };
}
