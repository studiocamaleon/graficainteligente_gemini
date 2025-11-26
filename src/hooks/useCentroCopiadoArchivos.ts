import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';

export interface CentroCopiadoArchivo {
  id: string;
  orden_copiado_id: string;
  company_id: string;
  nombre_archivo: string;
  nombre_storage: string;
  tipo_mime: string;
  tamano_bytes: number;
  storage_path: string;
  paginas_detectadas: number | null;
  item_generado_id: string | null;
  uploaded_by: string;
  created_at: string;
  updated_at: string;
  uploader?: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  };
}

export interface EspacioUsado {
  espacio_usado_bytes: number;
  espacio_usado_mb: number;
  espacio_disponible_bytes: number;
  espacio_disponible_mb: number;
  porcentaje_usado: number;
  limite_total_bytes: number;
}

export function useCentroCopiadoArchivos(ordenId?: string) {
  const { profile } = useAuth();
  const [archivos, setArchivos] = useState<CentroCopiadoArchivo[]>([]);
  const [espacioUsado, setEspacioUsado] = useState<EspacioUsado | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchArchivos = useCallback(async () => {
    if (!profile?.company_id || !ordenId) return;

    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('centro_copiado_ordenes_archivos')
        .select(`
          *,
          uploader:profiles!centro_copiado_ordenes_archivos_uploaded_by_fkey(id, full_name, avatar_url)
        `)
        .eq('orden_copiado_id', ordenId)
        .eq('company_id', profile.company_id)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      setArchivos(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar archivos');
      console.error('Error fetching archivos:', err);
    } finally {
      setLoading(false);
    }
  }, [profile?.company_id, ordenId]);

  const fetchEspacioUsado = useCallback(async () => {
    if (!ordenId) return;

    try {
      const { data, error: fetchError } = await supabase
        .rpc('fn_calcular_espacio_usado_copiado', { p_orden_id: ordenId });

      if (fetchError) throw fetchError;

      if (data && data.length > 0) {
        setEspacioUsado(data[0]);
      }
    } catch (err) {
      console.error('Error fetching espacio usado:', err);
    }
  }, [ordenId]);

  useEffect(() => {
    fetchArchivos();
    fetchEspacioUsado();
  }, [fetchArchivos, fetchEspacioUsado]);

  const createArchivo = async (data: {
    orden_copiado_id: string;
    nombre_archivo: string;
    nombre_storage: string;
    tipo_mime: string;
    tamano_bytes: number;
    storage_path: string;
    paginas_detectadas?: number | null;
    item_generado_id?: string | null;
  }): Promise<CentroCopiadoArchivo | null> => {
    if (!profile?.company_id) return null;

    try {
      const { data: archivo, error: createError } = await supabase
        .from('centro_copiado_ordenes_archivos')
        .insert({
          ...data,
          company_id: profile.company_id,
          uploaded_by: profile.id,
        })
        .select(`
          *,
          uploader:profiles!centro_copiado_ordenes_archivos_uploaded_by_fkey(id, full_name, avatar_url)
        `)
        .single();

      if (createError) throw createError;

      setArchivos(prev => [archivo, ...prev]);
      await fetchEspacioUsado();

      return archivo;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear archivo');
      console.error('Error creating archivo:', err);
      return null;
    }
  };

  const updateArchivo = async (
    id: string,
    updates: {
      item_generado_id?: string | null;
      paginas_detectadas?: number | null;
    }
  ): Promise<boolean> => {
    try {
      const { error: updateError } = await supabase
        .from('centro_copiado_ordenes_archivos')
        .update(updates)
        .eq('id', id);

      if (updateError) throw updateError;

      setArchivos(prev =>
        prev.map(archivo =>
          archivo.id === id ? { ...archivo, ...updates } : archivo
        )
      );

      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al actualizar archivo');
      console.error('Error updating archivo:', err);
      return false;
    }
  };

  const deleteArchivo = async (id: string): Promise<boolean> => {
    try {
      const { error: deleteError } = await supabase
        .from('centro_copiado_ordenes_archivos')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;

      setArchivos(prev => prev.filter(archivo => archivo.id !== id));
      await fetchEspacioUsado();

      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar archivo');
      console.error('Error deleting archivo:', err);
      return false;
    }
  };

  return {
    archivos,
    espacioUsado,
    loading,
    error,
    createArchivo,
    updateArchivo,
    deleteArchivo,
    refetch: fetchArchivos,
  };
}
