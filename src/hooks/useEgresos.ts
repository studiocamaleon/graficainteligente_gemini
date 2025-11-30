import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Egreso, CreateEgresoData, UpdateEgresoData } from '../types/tesoreria';
import { useAuth } from './useAuth';

interface FetchEgresosFilters {
  fecha_desde?: string;
  fecha_hasta?: string;
  caja_id?: string;
  tipo_egreso_id?: string;
}

export function useEgresos(filters?: FetchEgresosFilters) {
  const { company, user } = useAuth();
  const [egresos, setEgresos] = useState<Egreso[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  const fetchEgresos = async () => {
    if (!company) return;

    try {
      setLoading(true);
      let query = supabase
        .from('egresos')
        .select(`
          *,
          caja:cajas(nombre, moneda, tipo),
          tipo_egreso:tipos_egreso(nombre, color, icono),
          created_by_profile:profiles!egresos_created_by_fkey(full_name)
        `)
        .eq('company_id', company.id)
        .order('fecha', { ascending: false })
        .order('created_at', { ascending: false });

      if (filters?.fecha_desde) {
        query = query.gte('fecha', filters.fecha_desde);
      }
      if (filters?.fecha_hasta) {
        query = query.lte('fecha', filters.fecha_hasta);
      }
      if (filters?.caja_id) {
        query = query.eq('caja_id', filters.caja_id);
      }
      if (filters?.tipo_egreso_id) {
        query = query.eq('tipo_egreso_id', filters.tipo_egreso_id);
      }

      const { data, error } = await query;

      if (error) throw error;

      const egresosData = (data || []) as Egreso[];
      setEgresos(egresosData);
      setTotal(egresosData.reduce((sum, e) => sum + Number(e.monto), 0));
    } catch (error) {
      console.error('Error fetching egresos:', error);
    } finally {
      setLoading(false);
    }
  };

  const createEgreso = async (data: CreateEgresoData) => {
    if (!company || !user) throw new Error('No company or user');

    const { data: newEgreso, error } = await supabase
      .from('egresos')
      .insert([{
        ...data,
        company_id: company.id,
        created_by: user.id,
      }])
      .select(`
        *,
        caja:cajas(nombre, moneda, tipo),
        tipo_egreso:tipos_egreso(nombre, color, icono)
      `)
      .single();

    if (error) throw error;
    await fetchEgresos();
    return newEgreso;
  };

  const updateEgreso = async (id: string, data: UpdateEgresoData) => {
    const { error } = await supabase
      .from('egresos')
      .update(data)
      .eq('id', id);

    if (error) throw error;
    await fetchEgresos();
  };

  const deleteEgreso = async (id: string) => {
    const { error } = await supabase
      .from('egresos')
      .delete()
      .eq('id', id);

    if (error) throw error;
    await fetchEgresos();
  };

  useEffect(() => {
    fetchEgresos();
  }, [company?.id, filters?.fecha_desde, filters?.fecha_hasta, filters?.caja_id, filters?.tipo_egreso_id]);

  return {
    egresos,
    loading,
    total,
    createEgreso,
    updateEgreso,
    deleteEgreso,
    refetch: fetchEgresos,
  };
}
