import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import type { Caja, CajaConMediosCobro, ResumenCajaPorTipo } from '../types/medios-cobro';

interface CajaDashboardStat {
  id: string;
  ingresos_hoy: number;
  egresos_hoy: number;
  movimientos_hoy: number;
}

export interface CajaMovimientoListItem {
  id: string;
  fecha: string;
  tipo_movimiento: string;
  monto: number;
  concepto: string;
  notas: string | null;
  referencia_tipo: string | null;
  usuario_nombre: string | null;
  otro_caja_nombre: string | null;
}

export function useCajas() {
  const { profile } = useAuth();
  const [cajas, setCajas] = useState<CajaConMediosCobro[]>([]);
  const [resumenPorTipo, setResumenPorTipo] = useState<ResumenCajaPorTipo[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalSaldo, setTotalSaldo] = useState(0);

  const fetchCajas = useCallback(async () => {
    if (!profile?.company_id) return;

    try {
      setLoading(true);

      const [cajasResponse, statsResponse] = await Promise.all([
        supabase
          .from('cajas')
          .select('*, medios_cobro(*)')
          .eq('company_id', profile.company_id)
          .eq('is_active', true)
          .order('es_principal', { ascending: false })
          .order('tipo')
          .order('nombre'),
        supabase
          .rpc('fn_get_cajas_dashboard', {
            p_company_id: profile.company_id,
            p_date: new Date().toISOString().split('T')[0]
          })
      ]);

      if (cajasResponse.error) throw cajasResponse.error;
      if (statsResponse.error) throw statsResponse.error;

      const statsRows = (statsResponse.data || []) as CajaDashboardStat[];
      const statsMap = new Map(statsRows.map((s) => [s.id, s]));

      const cajasCompletas = (cajasResponse.data || []).map(c => {
        const stat = statsMap.get(c.id) || { ingresos_hoy: 0, egresos_hoy: 0, movimientos_hoy: 0 };
        return {
          ...c,
          ingresos_hoy: stat.ingresos_hoy,
          egresos_hoy: stat.egresos_hoy,
          movimientos_hoy: stat.movimientos_hoy
        };
      }).filter(c => {
        // Filtro de Seguridad Client-Side (Fallback de RLS)
        if (profile.role === 'operador_diseno') {
          return c.tipo === 'efectivo' && !c.es_principal;
        }
        return true;
      });

      setCajas(cajasCompletas);
      setTotalSaldo(cajasCompletas.reduce((sum, c) => sum + Number(c.saldo_actual), 0));

      // Calcular Resumen por Tipo
      const sumPorTipo = cajasCompletas.reduce((acc, caja) => {
        const tipo = caja.tipo;
        if (!acc[tipo]) {
          acc[tipo] = {
            tipo,
            total_saldo: 0,
            cantidad_cajas: 0,
            cajas: []
          };
        }
        acc[tipo].total_saldo += Number(caja.saldo_actual);
        acc[tipo].cantidad_cajas += 1;
        acc[tipo].cajas.push(caja);
        return acc;
      }, {} as Record<string, ResumenCajaPorTipo>);

      const resumen = Object.values(sumPorTipo).sort((a, b) => {
        // Orden fijo: Efectivo, Banco, Pasarela (Virtual)
        const order = { efectivo: 1, banco: 2, pasarela: 3 };
        return (order[a.tipo] || 99) - (order[b.tipo] || 99);
      });

      setResumenPorTipo(resumen);

    } catch (err) {
      console.error('Error fetching cajas:', err);
    } finally {
      setLoading(false);
    }
  }, [profile?.company_id, profile?.role]);

  useEffect(() => {
    fetchCajas();
  }, [fetchCajas]);

  return {
    cajas,
    resumenPorTipo,
    totalSaldo,
    loading,
    refetch: fetchCajas,
  };
}

export function useCajaMovimientos(cajaId: string | null, isOpen: boolean) {
  const [movimientos, setMovimientos] = useState<CajaMovimientoListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const PAGE_SIZE = 20;

  const fetchMovimientos = useCallback(async (reset = false) => {
    if (!cajaId) return;

    const currentPage = reset ? 0 : page;

    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('fn_get_movimientos_caja', {
        p_caja_id: cajaId,
        p_limit: PAGE_SIZE,
        p_offset: currentPage * PAGE_SIZE
      });

      if (error) throw error;
      const rows = (data || []) as CajaMovimientoListItem[];

      if (reset) {
        setMovimientos(rows);
        setPage(1);
      } else {
        setMovimientos(prev => [...prev, ...rows]);
        setPage(prev => prev + 1);
      }

      setHasMore(rows.length === PAGE_SIZE);
      setError(null);
    } catch (err) {
      console.error('Error fetching movimientos:', err);
      setError(err instanceof Error ? err.message : 'Error al cargar movimientos');
    } finally {
      setLoading(false);
    }
  }, [cajaId, page]);

  useEffect(() => {
    if (isOpen && cajaId) {
      fetchMovimientos(true);
    } else {
      setMovimientos([]);
      setPage(0);
      setHasMore(true);
      setError(null);
    }
  }, [cajaId, isOpen, fetchMovimientos]);

  return {
    movimientos,
    loading,
    error,
    refetch: () => fetchMovimientos(true),
    loadMore: () => fetchMovimientos(false),
    hasMore
  };
}

export function useCajaMutations() {
  const { profile } = useAuth();

  const crearCaja = async (data: Omit<Caja, 'id' | 'company_id' | 'created_at' | 'updated_at' | 'saldo_actual'> & { saldo_inicial?: number }) => {
    if (!profile?.company_id || !profile?.id) throw new Error('No company/user ID');

    const { saldo_inicial, ...rest } = data;

    // 1. Crear caja con saldo 0
    const { data: caja, error } = await supabase
      .from('cajas')
      .insert({
        ...rest,
        saldo_actual: 0,
        company_id: profile.company_id,
      })
      .select()
      .single();

    if (error) throw error;

    // 2. Si hay saldo inicial, crear movimiento de apertura
    if (saldo_inicial && saldo_inicial > 0) {
      const { error: movError } = await supabase
        .from('cajas_movimientos')
        .insert({
          caja_id: caja.id,
          tipo_movimiento: 'ingreso', // Tratamos el saldo inicial como un ingreso
          monto: saldo_inicial,
          concepto: 'Saldo Inicial (Apertura de Caja)',
          fecha: new Date().toISOString().split('T')[0],
          referencia_tipo: 'ajuste', // Usamos 'ajuste' como referencia interna
          notas: 'Movimiento automático por creación de caja',
          created_by: profile.id
        });

      if (movError) {
        // Si falla el movimiento, advertimos pero no fallamos toda la operación (o podríamos revertir)
        console.error('Error creando movimiento inicial:', movError);
      }
    }

    return caja;
  };

  const actualizarCaja = async (id: string, data: Partial<Caja>) => {
    const { data: caja, error } = await supabase
      .from('cajas')
      .update(data)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return caja;
  };

  const verificarDependenciasCaja = async (cajaId: string) => {
    // Contar medios de cobro activos asociados
    const { count: mediosCobro, error: errorMedios } = await supabase
      .from('medios_cobro')
      .select('id', { count: 'exact', head: true })
      .eq('caja_id', cajaId)
      .eq('is_active', true);

    if (errorMedios) throw errorMedios;

    // Contar movimientos asociados
    const { count: movimientos, error: errorMovs } = await supabase
      .from('cajas_movimientos')
      .select('id', { count: 'exact', head: true })
      .eq('caja_id', cajaId);

    if (errorMovs) throw errorMovs;

    return {
      puedeEliminar: (mediosCobro || 0) === 0,
      mediosCobro: mediosCobro || 0,
      movimientos: movimientos || 0,
    };
  };

  const eliminarCaja = async (id: string) => {
    const { error } = await supabase
      .from('cajas')
      .delete()
      .eq('id', id);

    if (error) throw error;
  };

  const transferirEntreCajas = async (
    cajaOrigenId: string,
    cajaDestinoId: string,
    monto: number,
    concepto: string,
    notas?: string
  ) => {
    if (!profile?.id) throw new Error('No user ID');

    const { error } = await supabase.rpc('fn_realizar_transferencia_caja', {
      p_caja_origen_id: cajaOrigenId,
      p_caja_destino_id: cajaDestinoId,
      p_monto: monto,
      p_concepto: concepto,
      p_notas: notas || null
    });

    if (error) throw error;
  };

  const registrarAjuste = async (
    cajaId: string,
    monto: number,
    concepto: string,
    notas: string
  ) => {
    if (!profile?.id) throw new Error('No user ID');

    const { data, error } = await supabase
      .from('cajas_movimientos')
      .insert({
        caja_id: cajaId,
        tipo_movimiento: 'ajuste',
        monto,
        concepto,
        fecha: new Date().toISOString().split('T')[0],
        referencia_tipo: 'ajuste',
        notas,
        created_by: profile.id,
      })
      .select()
      .single();

    if (error) throw error;

    return data;
  };

  return {
    crearCaja,
    actualizarCaja,
    eliminarCaja,
    verificarDependenciasCaja,
    transferirEntreCajas,
    registrarAjuste,
  };
}

export function useCajaDestinations() {
  const { profile } = useAuth();
  const [destinations, setDestinations] = useState<{ id: string; nombre: string; tipo: string; es_principal: boolean }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDestinations = async () => {
      if (!profile?.company_id) return;
      try {
        const { data, error } = await supabase.rpc('fn_get_cajas_options', {
          p_company_id: profile.company_id
        });
        if (error) throw error;
        setDestinations(data || []);
      } catch (err) {
        console.error('Error fetching destinations:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchDestinations();
  }, [profile?.company_id]);

  return { destinations, loading };
}
