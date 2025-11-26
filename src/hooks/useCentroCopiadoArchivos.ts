import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';

export interface CentroCopiadoArchivo {
  id: string;
  orden_copiado_id: string | null;
  orden_temporal_id: string | null;
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
  temporal_creado_en: string | null;
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

interface UseCentroCopiadoArchivosParams {
  ordenId?: string;
  ordenTemporalId?: string;
}

export function useCentroCopiadoArchivos(params?: string | UseCentroCopiadoArchivosParams) {
  // Soportar tanto string legacy como objeto nuevo
  const ordenId = typeof params === 'string' ? params : params?.ordenId;
  const ordenTemporalId = typeof params === 'string' ? undefined : params?.ordenTemporalId;
  const modoTemporal = !!ordenTemporalId && !ordenId;

  const { profile } = useAuth();
  const [archivos, setArchivos] = useState<CentroCopiadoArchivo[]>([]);
  const [espacioUsado, setEspacioUsado] = useState<EspacioUsado | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchArchivos = useCallback(async () => {
    if (!profile?.company_id || (!ordenId && !ordenTemporalId)) return;

    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from('centro_copiado_ordenes_archivos')
        .select(`
          *,
          uploader:profiles!centro_copiado_ordenes_archivos_uploaded_by_fkey(id, full_name, avatar_url)
        `)
        .eq('company_id', profile.company_id);

      // Filtrar por orden real o temporal
      if (modoTemporal && ordenTemporalId) {
        query = query.eq('orden_temporal_id', ordenTemporalId);
      } else if (ordenId) {
        query = query.eq('orden_copiado_id', ordenId);
      }

      query = query.order('created_at', { ascending: false });

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;

      setArchivos(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar archivos');
      console.error('Error fetching archivos:', err);
    } finally {
      setLoading(false);
    }
  }, [profile?.company_id, ordenId, ordenTemporalId, modoTemporal]);

  const fetchEspacioUsado = useCallback(async () => {
    if (!ordenId && !ordenTemporalId) return;

    try {
      const { data, error: fetchError } = await supabase
        .rpc('fn_calcular_espacio_usado_copiado_temporal', {
          p_orden_id: ordenId || null,
          p_orden_temporal_id: ordenTemporalId || null
        });

      if (fetchError) throw fetchError;

      if (data && data.length > 0) {
        setEspacioUsado(data[0]);
      }
    } catch (err) {
      console.error('Error fetching espacio usado:', err);
    }
  }, [ordenId, ordenTemporalId]);

  useEffect(() => {
    fetchArchivos();
    fetchEspacioUsado();
  }, [fetchArchivos, fetchEspacioUsado]);

  const createArchivo = async (data: {
    orden_copiado_id?: string | null;
    orden_temporal_id?: string | null;
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
      const insertData: any = {
        ...data,
        company_id: profile.company_id,
        uploaded_by: profile.id,
      };

      // Agregar timestamp para archivos temporales
      if (data.orden_temporal_id) {
        insertData.temporal_creado_en = new Date().toISOString();
      }

      const { data: archivo, error: createError } = await supabase
        .from('centro_copiado_ordenes_archivos')
        .insert(insertData)
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

  // Asociar archivos temporales con orden real
  const asociarConOrden = async (
    ordenIdReal: string,
    tempId?: string
  ) => {
    const efectivoTempId = tempId || ordenTemporalId;
    const efectivoCompanyId = profile?.company_id;

    console.log('[asociarConOrden] Iniciando asociación:', {
      ordenIdReal,
      tempId: efectivoTempId,
      companyId: efectivoCompanyId,
      modoTemporal
    });

    if (!efectivoTempId) {
      throw new Error('ordenTemporalId no disponible');
    }

    if (!efectivoCompanyId) {
      throw new Error('company_id no disponible');
    }

    try {
      // Usar función SQL con SECURITY DEFINER
      const { data, error: rpcError } = await supabase
        .rpc('fn_asociar_archivos_copiado_temporales', {
          p_orden_temporal_id: efectivoTempId,
          p_orden_copiado_id: ordenIdReal,
          p_company_id: efectivoCompanyId
        });

      if (rpcError) {
        console.error('[asociarConOrden] Error en función SQL:', rpcError);
        throw rpcError;
      }

      const count = data?.[0]?.archivos_asociados || 0;

      console.log('[asociarConOrden] Archivos asociados:', count);

      // Mover archivos físicos en storage
      if (count > 0) {
        console.log('[asociarConOrden] Moviendo archivos en storage...');

        const { data: archivosAsociados } = await supabase
          .from('centro_copiado_ordenes_archivos')
          .select('id, nombre_storage')
          .eq('orden_copiado_id', ordenIdReal)
          .eq('company_id', efectivoCompanyId);

        if (archivosAsociados && archivosAsociados.length > 0) {
          for (const archivo of archivosAsociados) {
            const oldPath = `${efectivoCompanyId}/temporal/${efectivoTempId}/${archivo.nombre_storage}`;
            const newPath = `${efectivoCompanyId}/${ordenIdReal}/${archivo.nombre_storage}`;

            console.log(`[asociarConOrden] Moviendo: ${oldPath} → ${newPath}`);

            try {
              // Descargar archivo temporal
              const { data: fileData, error: downloadError } = await supabase.storage
                .from('centro-copiado-archivos')
                .download(oldPath);

              if (downloadError) {
                console.error(`[asociarConOrden] Error descargando ${oldPath}:`, downloadError);
                continue;
              }

              // Subir a ubicación final
              const { error: uploadError } = await supabase.storage
                .from('centro-copiado-archivos')
                .upload(newPath, fileData, { upsert: true });

              if (uploadError) {
                console.error(`[asociarConOrden] Error subiendo ${newPath}:`, uploadError);
                continue;
              }

              // Eliminar archivo temporal
              await supabase.storage
                .from('centro-copiado-archivos')
                .remove([oldPath]);

              // Actualizar path en BD
              await supabase
                .from('centro_copiado_ordenes_archivos')
                .update({ storage_path: newPath })
                .eq('id', archivo.id);

              console.log(`[asociarConOrden] ✅ Movido: ${archivo.nombre_storage}`);
            } catch (moveError) {
              console.error(`[asociarConOrden] Error moviendo archivo ${archivo.id}:`, moveError);
            }
          }
        }
      }

      return {
        success: true,
        count
      };
    } catch (err: any) {
      console.error('[asociarConOrden] ERROR:', err);
      throw err;
    }
  };

  // Limpiar archivos temporales
  const limpiarTemporales = async (tempId?: string) => {
    const efectivoTempId = tempId || ordenTemporalId;

    if (!efectivoTempId || !profile?.company_id) {
      return { success: true, count: 0 };
    }

    try {
      // Obtener archivos temporales
      const { data: archivosTemporales } = await supabase
        .from('centro_copiado_ordenes_archivos')
        .select('id, storage_path')
        .eq('orden_temporal_id', efectivoTempId)
        .eq('company_id', profile.company_id);

      if (archivosTemporales && archivosTemporales.length > 0) {
        // Eliminar de storage
        const paths = archivosTemporales.map(a => a.storage_path);
        await supabase.storage
          .from('centro-copiado-archivos')
          .remove(paths);

        // Eliminar de BD
        await supabase
          .from('centro_copiado_ordenes_archivos')
          .delete()
          .eq('orden_temporal_id', efectivoTempId)
          .eq('company_id', profile.company_id);
      }

      return { success: true, count: archivosTemporales?.length || 0 };
    } catch (err: any) {
      console.error('Error limpiando temporales:', err);
      throw err;
    }
  };

  return {
    archivos,
    espacioUsado,
    loading,
    error,
    modoTemporal,
    createArchivo,
    updateArchivo,
    deleteArchivo,
    asociarConOrden,
    limpiarTemporales,
    refetch: fetchArchivos,
  };
}
