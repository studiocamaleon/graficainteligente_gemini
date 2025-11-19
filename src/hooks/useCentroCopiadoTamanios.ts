import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import type { CentroCopiadoTamanioPapel, CentroCopiadoTamanioPapelFormData } from '../types/database';

export function useCentroCopiadoTamanios() {
  const { company } = useAuth();
  const [tamanios, setTamanios] = useState<CentroCopiadoTamanioPapel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTamanios = useCallback(async () => {
    if (!company?.id) return;

    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('centro_copiado_tamanios_papel')
        .select('*')
        .eq('company_id', company.id)
        .eq('is_active', true)
        .order('nombre', { ascending: true });

      if (fetchError) throw fetchError;
      setTamanios(data || []);
    } catch (err) {
      console.error('Error fetching tamaños:', err);
      setError(err instanceof Error ? err.message : 'Error al cargar los tamaños de papel');
    } finally {
      setLoading(false);
    }
  }, [company?.id]);

  useEffect(() => {
    fetchTamanios();
  }, [fetchTamanios]);

  const createTamanio = async (data: CentroCopiadoTamanioPapelFormData): Promise<CentroCopiadoTamanioPapel | null> => {
    if (!company?.id) {
      setError('No se encontró la empresa');
      return null;
    }

    try {
      setError(null);

      const { data: newTamanio, error: insertError } = await supabase
        .from('centro_copiado_tamanios_papel')
        .insert({
          company_id: company.id,
          nombre: data.nombre,
          ancho_mm: data.ancho_mm,
          alto_mm: data.alto_mm,
          is_active: true,
        })
        .select()
        .single();

      if (insertError) throw insertError;
      return newTamanio;
    } catch (err) {
      console.error('Error creating tamaño:', err);
      setError(err instanceof Error ? err.message : 'Error al crear el tamaño de papel');
      return null;
    }
  };

  const updateTamanio = async (id: string, data: CentroCopiadoTamanioPapelFormData): Promise<CentroCopiadoTamanioPapel | null> => {
    try {
      setError(null);

      const { data: updatedTamanio, error: updateError } = await supabase
        .from('centro_copiado_tamanios_papel')
        .update({
          nombre: data.nombre,
          ancho_mm: data.ancho_mm,
          alto_mm: data.alto_mm,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (updateError) throw updateError;
      return updatedTamanio;
    } catch (err) {
      console.error('Error updating tamaño:', err);
      setError(err instanceof Error ? err.message : 'Error al actualizar el tamaño de papel');
      return null;
    }
  };

  const deleteTamanio = async (id: string): Promise<boolean> => {
    try {
      setError(null);

      const { error: deleteError } = await supabase
        .from('centro_copiado_tamanios_papel')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (deleteError) throw deleteError;
      return true;
    } catch (err) {
      console.error('Error deleting tamaño:', err);
      setError(err instanceof Error ? err.message : 'Error al eliminar el tamaño de papel');
      return false;
    }
  };

  return {
    tamanios,
    loading,
    error,
    fetchTamanios,
    createTamanio,
    updateTamanio,
    deleteTamanio,
  };
}
