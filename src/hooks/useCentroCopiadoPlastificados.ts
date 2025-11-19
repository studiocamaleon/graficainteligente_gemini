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
        .order('tipo', { ascending: true });

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

  const upsertPlastificado = async (data: CentroCopiadoPlastificadoFormData): Promise<CentroCopiadoPlastificado | null> => {
    if (!company?.id) {
      setError('No se encontró la empresa');
      return null;
    }

    try {
      setError(null);

      const { data: plastificado, error: upsertError } = await supabase
        .from('centro_copiado_plastificados')
        .upsert({
          company_id: company.id,
          tipo: data.tipo,
          precio: data.precio,
          is_active: true,
        }, {
          onConflict: 'company_id,tipo'
        })
        .select()
        .single();

      if (upsertError) throw upsertError;
      return plastificado;
    } catch (err) {
      console.error('Error upserting plastificado:', err);
      setError(err instanceof Error ? err.message : 'Error al guardar el plastificado');
      return null;
    }
  };

  return {
    plastificados,
    loading,
    error,
    fetchPlastificados,
    upsertPlastificado,
  };
}
