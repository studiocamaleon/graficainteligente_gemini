import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';

interface Link {
  id: string;
  orden_id: string;
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

export function useOrdenLinks(ordenId: string) {
  const [links, setLinks] = useState<Link[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { profile } = useAuth();

  // Cargar links
  const loadLinks = useCallback(async () => {
    if (!ordenId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('ordenes_trabajo_links')
        .select(`
          *,
          creator:created_by(full_name)
        `)
        .eq('orden_id', ordenId)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      setLinks(data || []);
    } catch (err: any) {
      console.error('[useOrdenLinks] Error loading links:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [ordenId]);

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
      // Si parece una ruta de windows o unix, es valida
      if (
        urlToValidate.startsWith('\\\\') ||
        urlToValidate.startsWith('/') ||
        /^[a-zA-Z]:\\/.test(urlToValidate)
      ) {
        return { valid: true };
      }

      const urlObj = new URL(urlToValidate);

      if (!urlObj.hostname && !urlObj.protocol.includes('file')) {
        return {
          valid: false,
          error: 'URL inválida. Debe incluir un dominio o ser una ruta de red válida.'
        };
      }

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

    if (!ordenId) {
      throw new Error('Se requiere ordenId');
    }

    // Validar URL
    const validation = validateUrl(linkData.url);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    // Normalizar URL: agregar https:// si no tiene protocolo
    let normalizedUrl = linkData.url.trim();
    // Previamente se forzaba https:// aqui, pero ahora se maneja en el UI para permitir links internos
    // if (!normalizedUrl.includes('://')) {
    //   normalizedUrl = 'https://' + normalizedUrl;
    // }

    try {
      setError(null);

      const { data, error: insertError } = await supabase
        .from('ordenes_trabajo_links')
        .insert({
          orden_id: ordenId,
          company_id: profile.company_id,
          titulo: linkData.titulo.trim(),
          url: normalizedUrl,
          descripcion: linkData.descripcion?.trim() || null,
          created_by: profile.id
        })
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
        let normalizedUrl = updates.url.trim();
        // Previamente se forzaba https:// aqui, pero ahora se maneja en el UI
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

  return {
    links,
    loading,
    error,
    createLink,
    updateLink,
    deleteLink,
    openLink,
    copyLink,
    validateUrl,
    getServiceType,
    refresh: loadLinks
  };
}
