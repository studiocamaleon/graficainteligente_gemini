import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import type { TipoIngreso } from '../types/tesoreria';

export function useTiposIngreso() {
  const { profile } = useAuth();
  const [tipos, setTipos] = useState<TipoIngreso[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTipos = useCallback(async () => {
    if (!profile?.company_id) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('tipos_ingreso')
        .select('*')
        .eq('company_id', profile.company_id)
        .eq('is_active', true)
        .order('nombre');

      if (error) throw error;
      setTipos(data || []);
    } catch (error) {
      console.error('Error fetching tipos de ingreso:', error);
    } finally {
      setLoading(false);
    }
  }, [profile?.company_id]);

  useEffect(() => {
    fetchTipos();
  }, [fetchTipos]);

  const createTipo = async (data: Omit<TipoIngreso, 'id' | 'company_id' | 'created_at' | 'updated_at'>) => {
    if (!profile?.company_id) throw new Error('No company_id');

    const { error } = await supabase
      .from('tipos_ingreso')
      .insert({
        ...data,
        company_id: profile.company_id,
      });

    if (error) throw error;
    await fetchTipos();
  };

  const updateTipo = async (id: string, data: Partial<TipoIngreso>) => {
    const { error } = await supabase
      .from('tipos_ingreso')
      .update(data)
      .eq('id', id);

    if (error) throw error;
    await fetchTipos();
  };

  const deleteTipo = async (id: string) => {
    const { error } = await supabase
      .from('tipos_ingreso')
      .delete()
      .eq('id', id);

    if (error) throw error;
    await fetchTipos();
  };

  return {
    tipos,
    loading,
    createTipo,
    updateTipo,
    deleteTipo,
    refetch: fetchTipos,
  };
}
