import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';

export interface ArchivoOrdenCopiado {
  id: string;
  orden_copiado_id: string;
  nombre_archivo: string;
  nombre_storage: string;
  tipo_mime: string;
  tamano_bytes: number;
  storage_path: string;
  paginas_detectadas: number | null;
  created_at: string;
}

export function useCentroCopiadoOrdenArchivos(ordenId?: string) {
  const { profile } = useAuth();
  const [archivos, setArchivos] = useState<ArchivoOrdenCopiado[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchArchivos = useCallback(async () => {
    if (!profile?.company_id || !ordenId) return;

    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('centro_copiado_ordenes_archivos')
        .select('*')
        .eq('orden_copiado_id', ordenId)
        .eq('company_id', profile.company_id)
        .order('created_at', { ascending: true });

      if (fetchError) throw fetchError;

      setArchivos(data || []);
    } catch (err) {
      console.error('Error cargando archivos:', err);
      setError(err instanceof Error ? err.message : 'Error al cargar archivos');
    } finally {
      setLoading(false);
    }
  }, [ordenId, profile?.company_id]);

  useEffect(() => {
    fetchArchivos();
  }, [fetchArchivos]);

  const descargarArchivo = async (archivo: ArchivoOrdenCopiado): Promise<boolean> => {
    try {
      const { data, error: downloadError } = await supabase.storage
        .from('centro-copiado-archivos')
        .download(archivo.storage_path);

      if (downloadError) {
        console.error('Error descargando archivo:', downloadError);
        return false;
      }

      const url = URL.createObjectURL(data);
      const link = document.createElement('a');
      link.href = url;
      link.download = archivo.nombre_archivo;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      return true;
    } catch (err) {
      console.error('Error en descarga:', err);
      return false;
    }
  };

  const obtenerUrlPublica = (archivo: ArchivoOrdenCopiado): string => {
    const { data } = supabase.storage
      .from('centro-copiado-archivos')
      .getPublicUrl(archivo.storage_path);

    return data.publicUrl;
  };

  const formatearTamano = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return {
    archivos,
    loading,
    error,
    refetch: fetchArchivos,
    descargarArchivo,
    obtenerUrlPublica,
    formatearTamano,
  };
}
