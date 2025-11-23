import { useState, useEffect } from 'react';
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
  const loadLinks = async () => {
    if (!ordenId && !ordenTemporalId) return;

    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from('ordenes_trabajo_links')
        .select(`
          *,
          creator:created_by(full_name)
        `);

      if (modoTemporal && ordenTemporalId) {
        query = query.eq('orden_temporal_id', ordenTemporalId);
      } else if (ordenId) {
        query = query.eq('orden_id', ordenId);
      }

      const { data, error: fetchError } = await query.order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      setLinks(data || []);
    } catch (err: any) {
      console.error('Error loading links:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLinks();
  }, [ordenId, ordenTemporalId]);

  // Validar URL
  const validateUrl = (url: string): { valid: boolean; error?: string } => {
    try {
      const urlObj = new URL(url);

      // Verificar que sea http o https
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        return {
          valid: false,
          error: 'La URL debe comenzar con http:// o https://'
        };
      }

      // Verificar que tenga un dominio válido
      if (!urlObj.hostname || urlObj.hostname.length < 3) {
        return {
          valid: false,
          error: 'URL inválida. Debe incluir un dominio válido.'
        };
      }

      return { valid: true };
    } catch {
      return {
        valid: false,
        error: 'URL inválida. Formato correcto: https://ejemplo.com/archivo'
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

    try {
      setError(null);

      const insertData: any = {
        company_id: profile.company_id,
        titulo: linkData.titulo.trim(),
        url: linkData.url.trim(),
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

      // Si se actualiza la URL, validarla
      if (updates.url) {
        const validation = validateUrl(updates.url);
        if (!validation.valid) {
          throw new Error(validation.error);
        }
      }

      const updateData: any = {};
      if (updates.titulo !== undefined) updateData.titulo = updates.titulo.trim();
      if (updates.url !== undefined) updateData.url = updates.url.trim();
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
  const asociarConOrden = async (ordenIdReal: string) => {
    if (!ordenTemporalId || !profile?.company_id) {
      throw new Error('No hay links temporales para asociar');
    }

    try {
      const { error } = await supabase
        .from('ordenes_trabajo_links')
        .update({
          orden_id: ordenIdReal,
          orden_temporal_id: null,
          temporal_creado_en: null
        })
        .eq('orden_temporal_id', ordenTemporalId)
        .eq('company_id', profile.company_id);

      if (error) throw error;

      const { count } = await supabase
        .from('ordenes_trabajo_links')
        .select('*', { count: 'exact', head: true })
        .eq('orden_id', ordenIdReal);

      return { success: true, count: count || 0 };
    } catch (err: any) {
      console.error('Error asociando links:', err);
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
