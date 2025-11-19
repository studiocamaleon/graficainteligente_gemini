import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import type { CentroCopiadoRangoAnillado, CentroCopiadoRangoAnilladoFormData } from '../types/database';

export function useCentroCopiadoRangosAnillado() {
  const { company } = useAuth();
  const [rangos, setRangos] = useState<CentroCopiadoRangoAnillado[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRangos = useCallback(async () => {
    if (!company?.id) return;

    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('centro_copiado_rangos_anillado')
        .select('*')
        .eq('company_id', company.id)
        .eq('is_active', true)
        .order('hojas_desde', { ascending: true });

      if (fetchError) throw fetchError;
      setRangos(data || []);
    } catch (err) {
      console.error('Error fetching rangos anillado:', err);
      setError(err instanceof Error ? err.message : 'Error al cargar los rangos de anillado');
    } finally {
      setLoading(false);
    }
  }, [company?.id]);

  useEffect(() => {
    fetchRangos();
  }, [fetchRangos]);

  const createRango = async (data: CentroCopiadoRangoAnilladoFormData): Promise<CentroCopiadoRangoAnillado | null> => {
    if (!company?.id) {
      setError('No se encontró la empresa');
      return null;
    }

    try {
      setError(null);

      const { data: newRango, error: insertError } = await supabase
        .from('centro_copiado_rangos_anillado')
        .insert({
          company_id: company.id,
          ...data,
          is_active: true,
        })
        .select()
        .single();

      if (insertError) throw insertError;
      return newRango;
    } catch (err) {
      console.error('Error creating rango:', err);
      setError(err instanceof Error ? err.message : 'Error al crear el rango de anillado');
      return null;
    }
  };

  const updateRango = async (id: string, data: CentroCopiadoRangoAnilladoFormData): Promise<CentroCopiadoRangoAnillado | null> => {
    try {
      setError(null);

      const { data: updatedRango, error: updateError } = await supabase
        .from('centro_copiado_rangos_anillado')
        .update({
          ...data,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (updateError) throw updateError;
      return updatedRango;
    } catch (err) {
      console.error('Error updating rango:', err);
      setError(err instanceof Error ? err.message : 'Error al actualizar el rango de anillado');
      return null;
    }
  };

  const deleteRango = async (id: string): Promise<boolean> => {
    try {
      setError(null);

      const { error: deleteError } = await supabase
        .from('centro_copiado_rangos_anillado')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (deleteError) throw deleteError;
      return true;
    } catch (err) {
      console.error('Error deleting rango:', err);
      setError(err instanceof Error ? err.message : 'Error al eliminar el rango de anillado');
      return false;
    }
  };

  return {
    rangos,
    loading,
    error,
    fetchRangos,
    createRango,
    updateRango,
    deleteRango,
  };
}
