import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import type { Caja, CajaConMediosCobro, ResumenCajaPorTipo } from '../types/medios-cobro';

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

      // Obtener cajas con sus medios de cobro
      const { data: cajasData, error: cajasError } = await supabase
        .from('cajas')
        .select(`
          *,
          medios_cobro:medios_cobro(*)
        `)
        .eq('company_id', profile.company_id)
        .eq('is_active', true)
        .order('es_principal', { ascending: false })
        .order('tipo')
        .order('nombre');

      if (cajasError) throw cajasError;

      // Calcular movimientos del día para cada caja
      const hoy = new Date().toISOString().split('T')[0];
      const cajasConMovimientos = await Promise.all(
        (cajasData || []).map(async (caja) => {
          const { data: movimientos } = await supabase
            .from('cajas_movimientos')
            .select('tipo_movimiento, monto')
            .eq('caja_id', caja.id)
            .eq('fecha', hoy);

          const ingresos = movimientos?.filter(m => m.tipo_movimiento === 'ingreso').reduce((sum, m) => sum + Number(m.monto), 0) || 0;
          const egresos = movimientos?.filter(m => m.tipo_movimiento === 'egreso').reduce((sum, m) => sum + Number(m.monto), 0) || 0;

          return {
            ...caja,
            movimientos_hoy: movimientos?.length || 0,
            ingresos_hoy: ingresos,
            egresos_hoy: egresos,
          };
        })
      );

      setCajas(cajasConMovimientos);

      // Calcular total
      const total = cajasConMovimientos.reduce((sum, caja) => sum + Number(caja.saldo_actual), 0);
      setTotalSaldo(total);

      // Agrupar por tipo
      const porTipo = cajasConMovimientos.reduce((acc, caja) => {
        const existing = acc.find(r => r.tipo === caja.tipo);
        if (existing) {
          existing.cantidad_cajas += 1;
          existing.total_saldo += Number(caja.saldo_actual);
          existing.cajas.push(caja);
        } else {
          acc.push({
            tipo: caja.tipo,
            total_saldo: Number(caja.saldo_actual),
            cantidad_cajas: 1,
            cajas: [caja],
          });
        }
        return acc;
      }, [] as ResumenCajaPorTipo[]);

      setResumenPorTipo(porTipo);
    } catch (error) {
      console.error('Error fetching cajas:', error);
    } finally {
      setLoading(false);
    }
  }, [profile?.company_id]);

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

export function useCajaMovimientos(cajaId: string | null, fechaDesde?: string, fechaHasta?: string) {
  const [movimientos, setMovimientos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMovimientos = useCallback(async () => {
    if (!cajaId) {
      setMovimientos([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      let query = supabase
        .from('cajas_movimientos')
        .select(`
          *,
          caja:cajas(nombre, tipo),
          medio_cobro:medios_cobro(nombre),
          caja_destino:cajas!cajas_movimientos_caja_destino_id_fkey(nombre)
        `)
        .eq('caja_id', cajaId)
        .order('fecha', { ascending: false })
        .order('created_at', { ascending: false });

      if (fechaDesde) {
        query = query.gte('fecha', fechaDesde);
      }

      if (fechaHasta) {
        query = query.lte('fecha', fechaHasta);
      }

      const { data, error } = await query;

      if (error) throw error;

      setMovimientos(data || []);
    } catch (error) {
      console.error('Error fetching movimientos:', error);
    } finally {
      setLoading(false);
    }
  }, [cajaId, fechaDesde, fechaHasta]);

  useEffect(() => {
    fetchMovimientos();
  }, [fetchMovimientos]);

  return {
    movimientos,
    loading,
    refetch: fetchMovimientos,
  };
}

export function useCajaMutations() {
  const { profile } = useAuth();

  const crearCaja = async (data: Omit<Caja, 'id' | 'company_id' | 'created_at' | 'updated_at' | 'saldo_actual'>) => {
    if (!profile?.company_id) throw new Error('No company ID');

    const { data: caja, error } = await supabase
      .from('cajas')
      .insert({
        ...data,
        company_id: profile.company_id,
      })
      .select()
      .single();

    if (error) throw error;

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

    const { data, error } = await supabase
      .from('cajas_movimientos')
      .insert({
        caja_id: cajaOrigenId,
        tipo_movimiento: 'transferencia',
        monto,
        concepto,
        fecha: new Date().toISOString().split('T')[0],
        referencia_tipo: 'transferencia',
        caja_destino_id: cajaDestinoId,
        notas,
        created_by: profile.id,
      })
      .select()
      .single();

    if (error) throw error;

    return data;
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
