import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import type { Ingreso, CreateIngresoData } from '../types/tesoreria';

interface UseIngresosFilters {
  fecha_desde?: string;
  fecha_hasta?: string;
  caja_id?: string;
  tipo_ingreso_id?: string;
}

export function useIngresos(filters: UseIngresosFilters = {}) {
  const { profile } = useAuth();
  const [ingresos, setIngresos] = useState<Ingreso[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  const fetchIngresos = useCallback(async () => {
    if (!profile?.company_id) return;

    try {
      setLoading(true);

      let query = supabase
        .from('ingresos')
        .select(`
          *,
          caja:cajas!caja_id(nombre, tipo, moneda),
          tipo_ingreso:tipos_ingreso!tipo_ingreso_id(nombre, color, icono),
          medio_cobro:medios_cobro(nombre, categoria),
          created_by_profile:profiles!created_by(full_name)
        `)
        .eq('company_id', profile.company_id)
        .order('fecha', { ascending: false })
        .order('created_at', { ascending: false });

      // Aplicar filtros
      if (filters.fecha_desde) {
        query = query.gte('fecha', filters.fecha_desde);
      }
      if (filters.fecha_hasta) {
        query = query.lte('fecha', filters.fecha_hasta);
      }
      if (filters.caja_id) {
        query = query.eq('caja_id', filters.caja_id);
      }
      if (filters.tipo_ingreso_id) {
        query = query.eq('tipo_ingreso_id', filters.tipo_ingreso_id);
      }

      const { data, error } = await query;

      if (error) throw error;

      setIngresos(data || []);

      // Calcular total
      const totalMonto = (data || []).reduce((sum, ing) => sum + Number(ing.monto), 0);
      setTotal(totalMonto);
    } catch (error) {
      console.error('Error fetching ingresos:', error);
    } finally {
      setLoading(false);
    }
  }, [profile?.company_id, filters.fecha_desde, filters.fecha_hasta, filters.caja_id, filters.tipo_ingreso_id]);

  useEffect(() => {
    fetchIngresos();
  }, [fetchIngresos]);

  const createIngreso = async (data: CreateIngresoData) => {
    if (!profile?.company_id) throw new Error('No company_id');

    const { error } = await supabase
      .from('ingresos')
      .insert({
        ...data,
        company_id: profile.company_id,
        created_by: profile.id,
      });

    if (error) throw error;
    await fetchIngresos();
  };

  const deleteIngreso = async (id: string) => {
    const { error } = await supabase
      .from('ingresos')
      .delete()
      .eq('id', id);

    if (error) throw error;
    await fetchIngresos();
  };

  return {
    ingresos,
    loading,
    total,
    createIngreso,
    deleteIngreso,
    refetch: fetchIngresos,
  };
}
