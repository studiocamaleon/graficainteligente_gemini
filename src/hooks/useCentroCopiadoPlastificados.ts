import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import type { CentroCopiadoPlastificado, CentroCopiadoPlastificadoFormData } from '../types/database';

export function useCentroCopiadoPlastificados() {
  const { company } = useAuth();
  const [plastificados, setPlastificados] = useState<CentroCopiadoPlastificado[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPlastificados = useCallback(async () => {
    if (!company?.id) return;

    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('centro_copiado_plastificados')
        .select('*')
        .eq('company_id', company.id)
        .eq('is_active', true)
        .order('tipo', { ascending: true })
        .order('unidades_desde', { ascending: true });

      if (fetchError) throw fetchError;
      setPlastificados(data || []);
    } catch (err) {
      console.error('Error fetching plastificados:', err);
      setError(err instanceof Error ? err.message : 'Error al cargar los plastificados');
    } finally {
      setLoading(false);
    }
  }, [company?.id]);

  useEffect(() => {
    fetchPlastificados();
  }, [fetchPlastificados]);

  const createPlastificado = async (data: CentroCopiadoPlastificadoFormData): Promise<CentroCopiadoPlastificado | null> => {
    if (!company?.id) {
      setError('No se encontró la empresa');
      return null;
    }

    try {
      setError(null);

      const { data: newPlastificado, error: insertError } = await supabase
        .from('centro_copiado_plastificados')
        .insert({
          company_id: company.id,
          ...data,
          is_active: true,
        })
        .select()
        .single();

      if (insertError) throw insertError;
      return newPlastificado;
    } catch (err) {
      console.error('Error creating plastificado:', err);
      setError(err instanceof Error ? err.message : 'Error al crear el plastificado');
      return null;
    }
  };

  const updatePlastificado = async (id: string, data: CentroCopiadoPlastificadoFormData): Promise<CentroCopiadoPlastificado | null> => {
    try {
      setError(null);

      const { data: updatedPlastificado, error: updateError } = await supabase
        .from('centro_copiado_plastificados')
        .update({
          ...data,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (updateError) throw updateError;
      return updatedPlastificado;
    } catch (err) {
      console.error('Error updating plastificado:', err);
      setError(err instanceof Error ? err.message : 'Error al actualizar el plastificado');
      return null;
    }
  };

  const deletePlastificado = async (id: string): Promise<boolean> => {
    try {
      setError(null);

      const { error: deleteError } = await supabase
        .from('centro_copiado_plastificados')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (deleteError) throw deleteError;
      return true;
    } catch (err) {
      console.error('Error deleting plastificado:', err);
      setError(err instanceof Error ? err.message : 'Error al eliminar el plastificado');
      return false;
    }
  };

  return {
    plastificados,
    loading,
    error,
    fetchPlastificados,
    createPlastificado,
    updatePlastificado,
    deletePlastificado,
  };
}
