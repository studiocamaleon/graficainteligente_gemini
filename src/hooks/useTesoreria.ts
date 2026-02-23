import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import type { SaldosPendientesCobro, OrdenPorCobrar } from '../types/medios-cobro';
import { getArgentinaDate } from '../utils/dates';

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
        .rpc('fn_finanzas_saldos_comerciales_v2', {
          p_company_id: profile.company_id,
          p_fecha_inicio: null,
          p_fecha_fin: null,
          p_timezone: 'America/Argentina/Buenos_Aires',
        });

      if (error) throw error;

      const rows = (data || []) as any[];
      const totals = rows.reduce(
        (acc, row) => {
          const saldo = Number(row.saldo_pendiente || 0);
          const isCC = Boolean(row.tiene_cuenta_corriente);
          acc.total_pendiente += saldo;
          if (isCC) {
            acc.total_cc += saldo;
            acc.cantidad_ordenes_cc += 1;
          } else {
            acc.total_sin_cc += saldo;
            acc.cantidad_ordenes_sin_cc += 1;
          }
          return acc;
        },
        {
          total_pendiente: 0,
          total_cc: 0,
          total_sin_cc: 0,
          cantidad_ordenes_cc: 0,
          cantidad_ordenes_sin_cc: 0,
        } as SaldosPendientesCobro
      );

      setSaldos(totals);
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
        .rpc('fn_finanzas_saldos_comerciales_v2', {
          p_company_id: profile.company_id,
          p_fecha_inicio: null,
          p_fecha_fin: null,
          p_timezone: 'America/Argentina/Buenos_Aires',
        });

      if (error) throw error;

      const rows = ((data || []) as any[])
        .filter((row) => {
          if (!tipoCliente) return true;
          const isCC = Boolean(row.tiene_cuenta_corriente);
          return tipoCliente === 'cc' ? isCC : !isCC;
        })
        .map((row) => ({
          orden_id: row.orden_id,
          numero_orden: row.numero_orden,
          fecha_creacion: row.fecha_creacion,
          cliente_id: row.cliente_id,
          cliente_nombre: row.cliente_nombre,
          cliente_documento: row.cliente_documento,
          tiene_cuenta_corriente: Boolean(row.tiene_cuenta_corriente),
          total: Number(row.total_calculado || 0),
          pagado: Number(row.pagado || 0),
          saldo_pendiente: Number(row.saldo_pendiente || 0),
          dias_transcurridos: Number(row.dias_transcurridos || 0),
          estado: row.estado,
          tipo_orden: row.tipo_orden === 'orden_trabajo' ? 'trabajo' : 'copiado',
        })) as OrdenPorCobrar[];

      setOrdenes(rows);
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

      // Definir fechas por defecto usando timezone Argentina (últimos 30 días, inclusivo)
      const todayAr = getArgentinaDate();
      const desde = fechaDesde || todayAr.subtract(29, 'day').format('YYYY-MM-DD');
      const hasta = fechaHasta || todayAr.format('YYYY-MM-DD');

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
