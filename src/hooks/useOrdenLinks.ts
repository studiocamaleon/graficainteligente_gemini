import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';

interface Link {
  id: string;
  orden_id: string | null;
  orden_temporal_id: string | null;
  company_id: string;
  titulo: string;
  url: string;
  descripcion: string | null;
  created_by: string;
  created_at: string;
  creator?: {
    full_name: string;
  };
}

interface CreateLinkData {
  titulo: string;
  url: string;
  descripcion?: string;
}

interface UpdateLinkData {
  titulo?: string;
  url?: string;
  descripcion?: string;
}

interface UseOrdenLinksParams {
  ordenId?: string;
  ordenTemporalId?: string;
}

export function useOrdenLinks(params: string | UseOrdenLinksParams) {
  const ordenId = typeof params === 'string' ? params : params.ordenId;
  const ordenTemporalId = typeof params === 'string' ? undefined : params.ordenTemporalId;
  const modoTemporal = !!ordenTemporalId && !ordenId;
  const [links, setLinks] = useState<Link[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { profile } = useAuth();

  // Cargar links
  const loadLinks = useCallback(async () => {
    console.log('[useOrdenLinks] loadLinks llamado:', { ordenId, ordenTemporalId, modoTemporal });

    if (!ordenId && !ordenTemporalId) {
      console.log('[useOrdenLinks] No hay ordenId ni ordenTemporalId, saliendo early');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      console.log('[useOrdenLinks] Iniciando carga...');

      let query = supabase
        .from('ordenes_trabajo_links')
        .select(`
          *,
          creator:created_by(full_name)
        `);

      if (modoTemporal && ordenTemporalId) {
        console.log('[useOrdenLinks] Modo temporal, filtrando por ordenTemporalId:', ordenTemporalId);
        query = query.eq('orden_temporal_id', ordenTemporalId);
      } else if (ordenId) {
        console.log('[useOrdenLinks] Modo normal, filtrando por ordenId:', ordenId);
        query = query.eq('orden_id', ordenId);
      }

      const { data, error: fetchError } = await query.order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      console.log('[useOrdenLinks] Links cargados:', data?.length || 0);
      setLinks(data || []);
    } catch (err: any) {
      console.error('[useOrdenLinks] Error loading links:', err);
      setError(err.message);
    } finally {
      console.log('[useOrdenLinks] Finalizando carga, setLoading(false)');
      setLoading(false);
    }
  }, [ordenId, ordenTemporalId, modoTemporal]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (cancelled) return;
      await loadLinks();
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [loadLinks]);

  // Validar URL - Aceptar cualquier URL válida
  const validateUrl = (url: string): { valid: boolean; error?: string } => {
    // Si está vacío, no es válido
    if (!url || !url.trim()) {
      return {
        valid: false,
        error: 'La URL no puede estar vacía'
      };
    }

    const trimmedUrl = url.trim();

    // Si no tiene protocolo, intentar agregarlo
    let urlToValidate = trimmedUrl;
    if (!trimmedUrl.includes('://')) {
      urlToValidate = 'https://' + trimmedUrl;
    }

    try {
      // Intentar crear objeto URL para validar formato básico
      const urlObj = new URL(urlToValidate);

      // Verificar que tenga al menos un hostname
      if (!urlObj.hostname) {
        return {
          valid: false,
          error: 'URL inválida. Debe incluir un dominio.'
        };
      }

      // Aceptar cualquier protocolo común (http, https, ftp, file, etc.)
      return { valid: true };
    } catch {
      return {
        valid: false,
        error: 'URL inválida. Ejemplo: https://ejemplo.com o ejemplo.com'
      };
    }
  };

  // Crear link
  const createLink = async (linkData: CreateLinkData) => {
    if (!profile?.company_id) {
      throw new Error('No se pudo obtener el ID de la empresa');
    }

    if (!ordenId && !ordenTemporalId) {
      throw new Error('Se requiere ordenId u ordenTemporalId');
    }

    // Validar URL
    const validation = validateUrl(linkData.url);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    // Normalizar URL: agregar https:// si no tiene protocolo
    let normalizedUrl = linkData.url.trim();
    if (!normalizedUrl.includes('://')) {
      normalizedUrl = 'https://' + normalizedUrl;
    }

    try {
      setError(null);

      const insertData: any = {
        company_id: profile.company_id,
        titulo: linkData.titulo.trim(),
        url: normalizedUrl,
        descripcion: linkData.descripcion?.trim() || null,
        created_by: profile.id
      };

      if (modoTemporal && ordenTemporalId) {
        insertData.orden_temporal_id = ordenTemporalId;
        insertData.temporal_creado_en = new Date().toISOString();
      } else {
        insertData.orden_id = ordenId;
      }

      const { data, error: insertError } = await supabase
        .from('ordenes_trabajo_links')
        .insert(insertData)
        .select()
        .single();

      if (insertError) throw insertError;

      // Recargar lista
      await loadLinks();

      return data;
    } catch (err: any) {
      console.error('Error creating link:', err);
      setError(err.message);
      throw err;
    }
  };

  // Actualizar link
  const updateLink = async (linkId: string, updates: UpdateLinkData) => {
    try {
      setError(null);

      // Si se actualiza la URL, validarla y normalizarla
      if (updates.url) {
        const validation = validateUrl(updates.url);
        if (!validation.valid) {
          throw new Error(validation.error);
        }
      }

      const updateData: any = {};
      if (updates.titulo !== undefined) updateData.titulo = updates.titulo.trim();
      if (updates.url !== undefined) {
        // Normalizar URL: agregar https:// si no tiene protocolo
        let normalizedUrl = updates.url.trim();
        if (!normalizedUrl.includes('://')) {
          normalizedUrl = 'https://' + normalizedUrl;
        }
        updateData.url = normalizedUrl;
      }
      if (updates.descripcion !== undefined) {
        updateData.descripcion = updates.descripcion?.trim() || null;
      }

      const { error: updateError } = await supabase
        .from('ordenes_trabajo_links')
        .update(updateData)
        .eq('id', linkId);

      if (updateError) throw updateError;

      // Recargar lista
      await loadLinks();
    } catch (err: any) {
      console.error('Error updating link:', err);
      setError(err.message);
      throw err;
    }
  };

  // Eliminar link
  const deleteLink = async (linkId: string) => {
    try {
      setError(null);

      const { error: deleteError } = await supabase
        .from('ordenes_trabajo_links')
        .delete()
        .eq('id', linkId);

      if (deleteError) throw deleteError;

      // Recargar lista
      await loadLinks();
    } catch (err: any) {
      console.error('Error deleting link:', err);
      setError(err.message);
      throw err;
    }
  };

  // Abrir link en nueva pestaña
  const openLink = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // Copiar link al portapapeles
  const copyLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      return true;
    } catch (err) {
      console.error('Error copying link:', err);
      return false;
    }
  };

  // Detectar tipo de servicio (WeTransfer, Google Drive, etc.)
  const getServiceType = (url: string): string => {
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname.toLowerCase();

      if (hostname.includes('wetransfer')) return 'WeTransfer';
      if (hostname.includes('drive.google')) return 'Google Drive';
      if (hostname.includes('dropbox')) return 'Dropbox';
      if (hostname.includes('onedrive') || hostname.includes('sharepoint')) return 'OneDrive';
      if (hostname.includes('mega.')) return 'MEGA';
      if (hostname.includes('mediafire')) return 'MediaFire';
      if (hostname.includes('box.')) return 'Box';

      return 'Otro';
    } catch {
      return 'Desconocido';
    }
  };

  // Asociar links temporales con orden real
  const asociarConOrden = async (
    ordenIdReal: string,
    tempId?: string,
    companyId?: string
  ) => {
    const efectivoTempId = tempId || ordenTemporalId;
    const efectivoCompanyId = companyId || profile?.company_id;

    console.log('[useOrdenLinks.asociarConOrden] Iniciando asociación con parámetros:', {
      ordenIdReal,
      tempId: efectivoTempId,
      companyId: efectivoCompanyId,
      profileExists: !!profile
    });

    if (!efectivoTempId) {
      const error = new Error('ordenTemporalId no disponible');
      console.error('[useOrdenLinks.asociarConOrden] ERROR:', error);
      throw error;
    }

    if (!efectivoCompanyId) {
      const error = new Error('company_id no disponible');
      console.error('[useOrdenLinks.asociarConOrden] ERROR:', error);
      throw error;
    }

    try {
      const { error } = await supabase
        .from('ordenes_trabajo_links')
        .update({
          orden_id: ordenIdReal,
          orden_temporal_id: null,
          temporal_creado_en: null
        })
        .eq('orden_temporal_id', efectivoTempId)
        .eq('company_id', efectivoCompanyId);

      if (error) {
        console.error('[useOrdenLinks.asociarConOrden] Error en UPDATE:', error);
        throw error;
      }

      const { count, error: countError } = await supabase
        .from('ordenes_trabajo_links')
        .select('*', { count: 'exact', head: true })
        .eq('orden_id', ordenIdReal);

      if (countError) {
        console.error('[useOrdenLinks.asociarConOrden] Error contando links:', countError);
      }

      console.log(`[useOrdenLinks.asociarConOrden] ${count || 0} links asociados en BD`);

      return { success: true, count: count || 0 };
    } catch (err: any) {
      console.error('[useOrdenLinks.asociarConOrden] Error asociando links:', err);
      throw err;
    }
  };

  // Limpiar links temporales
  const limpiarTemporales = async () => {
    if (!ordenTemporalId || !profile?.company_id) {
      return { success: true, count: 0 };
    }

    try {
      const { count } = await supabase
        .from('ordenes_trabajo_links')
        .select('*', { count: 'exact', head: true })
        .eq('orden_temporal_id', ordenTemporalId)
        .eq('company_id', profile.company_id);

      await supabase
        .from('ordenes_trabajo_links')
        .delete()
        .eq('orden_temporal_id', ordenTemporalId)
        .eq('company_id', profile.company_id);

      return { success: true, count: count || 0 };
    } catch (err: any) {
      console.error('Error limpiando links temporales:', err);
      throw err;
    }
  };

  return {
    links,
    loading,
    error,
    modoTemporal,
    createLink,
    updateLink,
    deleteLink,
    openLink,
    copyLink,
    validateUrl,
    getServiceType,
    asociarConOrden,
    limpiarTemporales,
    refresh: loadLinks
  };
}
