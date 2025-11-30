import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { TipoEgreso } from '../types/tesoreria';
import { useAuth } from './useAuth';

export function useTiposEgreso() {
  const { company } = useAuth();
  const [tipos, setTipos] = useState<TipoEgreso[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTipos = async () => {
    if (!company) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('tipos_egreso')
        .select('*')
        .eq('company_id', company.id)
        .eq('is_active', true)
        .order('nombre');

      if (error) throw error;
      setTipos(data || []);
    } catch (error) {
      console.error('Error fetching tipos egreso:', error);
    } finally {
      setLoading(false);
    }
  };

  const createTipo = async (data: Omit<TipoEgreso, 'id' | 'company_id' | 'created_at' | 'updated_at'>) => {
    if (!company) throw new Error('No company');

    const { data: newTipo, error } = await supabase
      .from('tipos_egreso')
      .insert([{ ...data, company_id: company.id }])
      .select()
      .single();

    if (error) throw error;
    await fetchTipos();
    return newTipo;
  };

  const updateTipo = async (id: string, data: Partial<TipoEgreso>) => {
    const { error } = await supabase
      .from('tipos_egreso')
      .update(data)
      .eq('id', id);

    if (error) throw error;
    await fetchTipos();
  };

  const deleteTipo = async (id: string) => {
    const { error } = await supabase
      .from('tipos_egreso')
      .update({ is_active: false })
      .eq('id', id);

    if (error) throw error;
    await fetchTipos();
  };

  const seedDefaultTipos = async () => {
    if (!company) return;

    const { error } = await supabase.rpc('fn_seed_tipos_egreso_default', {
      p_company_id: company.id,
    });

    if (error) throw error;
    await fetchTipos();
  };

  useEffect(() => {
    fetchTipos();
  }, [company?.id]);

  return {
    tipos,
    loading,
    createTipo,
    updateTipo,
    deleteTipo,
    seedDefaultTipos,
    refetch: fetchTipos,
  };
}
