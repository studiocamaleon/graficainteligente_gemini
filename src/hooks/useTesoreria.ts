import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import type { SaldosPendientesCobro, OrdenPorCobrar } from '../types/medios-cobro';

export function useSaldosPendientes() {
  const { profile } = useAuth();
  const [saldos, setSaldos] = useState<SaldosPendientesCobro>({
    total_pendiente: 0,
    total_cc: 0,
    total_sin_cc: 0,
    cantidad_ordenes_cc: 0,
    cantidad_ordenes_sin_cc: 0,
  });
  const [loading, setLoading] = useState(true);

  const fetchSaldos = useCallback(async () => {
    if (!profile?.company_id) return;

    try {
      setLoading(true);

      const { data, error } = await supabase
        .rpc('fn_calcular_saldos_pendientes_cobro', {
          p_company_id: profile.company_id,
        });

      if (error) throw error;

      if (data && data.length > 0) {
        setSaldos(data[0]);
      }
    } catch (error) {
      console.error('Error fetching saldos pendientes:', error);
    } finally {
      setLoading(false);
    }
  }, [profile?.company_id]);

  useEffect(() => {
    fetchSaldos();
  }, [fetchSaldos]);

  return {
    saldos,
    loading,
    refetch: fetchSaldos,
  };
}

export function useOrdenesPorCobrar(tipoCliente?: 'cc' | 'sin_cc') {
  const { profile } = useAuth();
  const [ordenes, setOrdenes] = useState<OrdenPorCobrar[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchOrdenes = useCallback(async () => {
    if (!profile?.company_id) return;

    try {
      setLoading(true);

      const { data, error } = await supabase
        .rpc('fn_obtener_detalle_por_cobrar', {
          p_company_id: profile.company_id,
          p_tipo_cliente: tipoCliente || null,
        });

      if (error) throw error;

      setOrdenes(data || []);
    } catch (error) {
      console.error('Error fetching ordenes por cobrar:', error);
    } finally {
      setLoading(false);
    }
  }, [profile?.company_id, tipoCliente]);

  useEffect(() => {
    fetchOrdenes();
  }, [fetchOrdenes]);

  return {
    ordenes,
    loading,
    refetch: fetchOrdenes,
  };
}

export function useIngresosPeriodo(fechaDesde?: string, fechaHasta?: string) {
  const { profile } = useAuth();
  const [ingresos, setIngresos] = useState<any[]>([]);
  const [totalIngresos, setTotalIngresos] = useState(0);
  const [totalComisiones, setTotalComisiones] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchIngresos = useCallback(async () => {
    if (!profile?.company_id) return;

    try {
      setLoading(true);

      // Definir fechas por defecto (últimos 30 días)
      const desde = fechaDesde || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const hasta = fechaHasta || new Date().toISOString().split('T')[0];

      // Primero obtener IDs de cajas de la empresa
      const { data: cajasData, error: cajasError } = await supabase
        .from('cajas')
        .select('id')
        .eq('company_id', profile.company_id);

      if (cajasError) throw cajasError;

      const cajaIds = (cajasData || []).map(c => c.id);

      if (cajaIds.length === 0) {
        setIngresos([]);
        setTotalIngresos(0);
        setLoading(false);
        return;
      }

      // Obtener movimientos de tipo ingreso de esas cajas
      const { data, error } = await supabase
        .from('cajas_movimientos')
        .select(`
          *,
          caja:cajas!caja_id(nombre, tipo, moneda),
          medio_cobro:medios_cobro(nombre, categoria)
        `)
        .in('caja_id', cajaIds)
        .eq('tipo_movimiento', 'ingreso')
        .gte('fecha', desde)
        .lte('fecha', hasta)
        .order('fecha', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;

      setIngresos(data || []);

      // Calcular totales
      const total = (data || []).reduce((sum, ing) => sum + Number(ing.monto), 0);
      const comisiones = (data || []).reduce((sum, ing) => sum + Number(ing.comision_aplicada || 0), 0);

      setTotalIngresos(total);
      setTotalComisiones(comisiones);
    } catch (error) {
      console.error('Error fetching ingresos:', error);
    } finally {
      setLoading(false);
    }
  }, [profile?.company_id, fechaDesde, fechaHasta]);

  useEffect(() => {
    fetchIngresos();
  }, [fetchIngresos]);

  return {
    ingresos,
    totalIngresos,
    totalComisiones,
    loading,
    refetch: fetchIngresos,
  };
}
