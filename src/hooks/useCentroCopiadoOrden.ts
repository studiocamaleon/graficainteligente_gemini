import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import type { CentroCopiadoOrden, CentroCopiadoOrdenItem } from '../types/database';

interface OrdenWithDetails extends CentroCopiadoOrden {
  cliente?: {
    id: string;
    nombre_fantasia: string;
    numero_documento: string;
    whatsapp: string | null;
    email: string | null;
  };
  created_by_profile?: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  };
  items: Array<
    CentroCopiadoOrdenItem & {
      tamanio_papel?: {
        nombre: string;
        ancho_mm: number;
        alto_mm: number;
      };
      papel?: {
        material_id: string;
        variante_nombre: string;
        espesor: number | null;
        unidad_espesor: string | null;
      };
    }
  >;
}

export function useCentroCopiadoOrden(ordenId?: string) {
  const { profile } = useAuth();
  const [orden, setOrden] = useState<OrdenWithDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOrden = useCallback(async () => {
    if (!profile?.company_id || !ordenId) return;

    try {
      setLoading(true);
      setError(null);

      const { data: ordenData, error: ordenError } = await supabase
        .from('centro_copiado_ordenes')
        .select(
          `
          *,
          cliente:clients(id, nombre_fantasia, numero_documento, whatsapp, email),
          created_by_profile:profiles!centro_copiado_ordenes_created_by_fkey(id, full_name, avatar_url),
          orden_trabajo:ordenes_trabajo(id, numero_orden, numero_factura)
        `
        )
        .eq('id', ordenId)
        .eq('company_id', profile.company_id)
        .maybeSingle();

      if (ordenError) throw ordenError;

      if (!ordenData) {
        throw new Error('Orden no encontrada');
      }

      const { data: itemsData, error: itemsError } = await supabase
        .from('centro_copiado_ordenes_items')
        .select(
          `
          *,
          tamanio_papel:centro_copiado_tamanios_papel(nombre, ancho_mm, alto_mm),
          papel:centro_copiado_papeles(material_id, variante_nombre, espesor, unidad_espesor)
        `
        )
        .eq('orden_copiado_id', ordenId)
        .order('created_at', { ascending: true });

      if (itemsError) throw itemsError;

      setOrden({
        ...ordenData,
        items: itemsData || [],
      } as OrdenWithDetails);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar orden');
      console.error('Error fetching orden:', err);
    } finally {
      setLoading(false);
    }
  }, [profile?.company_id, ordenId]);

  const updateOrden = useCallback(
    async (id: string, updates: Partial<CentroCopiadoOrden>) => {
      if (!profile?.company_id) return false;

      try {
        const { error: updateError } = await supabase
          .from('centro_copiado_ordenes')
          .update(updates)
          .eq('id', id)
          .eq('company_id', profile.company_id);

        if (updateError) throw updateError;

        await fetchOrden();
        return true;
      } catch (err) {
        console.error('Error upgrading orden:', err);
        setError(err instanceof Error ? err.message : 'Error al actualizar orden');
        return false;
      }
    },
    [profile?.company_id, fetchOrden]
  );

  useEffect(() => {
    fetchOrden();
  }, [fetchOrden]);

  return {
    orden,
    loading,
    error,
    refetch: fetchOrden,
    updateOrden,
  };
}
