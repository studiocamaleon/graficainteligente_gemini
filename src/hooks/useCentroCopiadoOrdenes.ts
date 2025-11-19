import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import type {
  CentroCopiadoOrden,
  EstadoOrdenCopiado,
  CentroCopiadoOrdenItem
} from '../types/database';

interface UseCentroCopiadoOrdenesParams {
  searchTerm?: string;
  estado?: EstadoOrdenCopiado | null;
  clienteId?: string | null;
  fechaDesde?: string | null;
  fechaHasta?: string | null;
  page?: number;
  itemsPerPage?: number;
}

interface OrdenCopiadoWithRelations extends CentroCopiadoOrden {
  cliente?: {
    id: string;
    nombre_fantasia: string;
    numero_documento: string;
  };
  created_by_profile?: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  };
  items_count?: number;
}

interface CreateOrdenCopiadoData {
  cliente_id: string;
  orden_trabajo_id?: string;
  fecha_entrega_estimada?: string;
  observaciones?: string;
}

export function useCentroCopiadoOrdenes(params: UseCentroCopiadoOrdenesParams = {}) {
  const { profile } = useAuth();
  const [ordenes, setOrdenes] = useState<OrdenCopiadoWithRelations[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    searchTerm = '',
    estado = null,
    clienteId = null,
    fechaDesde = null,
    fechaHasta = null,
    page = 1,
    itemsPerPage = 25,
  } = params;

  const fetchOrdenes = useCallback(async () => {
    if (!profile?.company_id) return;

    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from('centro_copiado_ordenes')
        .select(
          `
          *,
          cliente:clients(id, nombre_fantasia, numero_documento),
          created_by_profile:profiles!centro_copiado_ordenes_created_by_fkey(id, full_name, avatar_url)
        `,
          { count: 'exact' }
        )
        .eq('company_id', profile.company_id);

      if (estado) {
        query = query.eq('estado', estado);
      }

      if (clienteId) {
        query = query.eq('cliente_id', clienteId);
      }

      if (fechaDesde) {
        query = query.gte('fecha_solicitud', fechaDesde);
      }

      if (fechaHasta) {
        query = query.lte('fecha_solicitud', fechaHasta);
      }

      if (searchTerm) {
        query = query.or(
          `numero_orden.ilike.%${searchTerm}%,observaciones.ilike.%${searchTerm}%`
        );
      }

      const from = (page - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;

      query = query.order('fecha_solicitud', { ascending: false }).range(from, to);

      const { data, error: fetchError, count } = await query;

      if (fetchError) throw fetchError;

      if (data) {
        const ordenesWithCounts = await Promise.all(
          data.map(async (orden) => {
            const { count: itemsCount } = await supabase
              .from('centro_copiado_ordenes_items')
              .select('*', { count: 'exact', head: true })
              .eq('orden_copiado_id', orden.id);

            return {
              ...orden,
              items_count: itemsCount || 0,
            };
          })
        );

        setOrdenes(ordenesWithCounts as OrdenCopiadoWithRelations[]);
        setTotalCount(count || 0);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar órdenes de copiado');
      console.error('Error fetching ordenes copiado:', err);
    } finally {
      setLoading(false);
    }
  }, [
    profile?.company_id,
    searchTerm,
    estado,
    clienteId,
    fechaDesde,
    fechaHasta,
    page,
    itemsPerPage,
  ]);

  useEffect(() => {
    fetchOrdenes();
  }, [fetchOrdenes]);

  const createOrden = useCallback(
    async (data: CreateOrdenCopiadoData) => {
      if (!profile?.company_id || !profile?.id) {
        setError('No se pudo obtener la información del usuario');
        return null;
      }

      try {
        setError(null);

        const today = new Date();
        const dateStr = today.toISOString().split('T')[0].replace(/-/g, '');

        const { count } = await supabase
          .from('centro_copiado_ordenes')
          .select('*', { count: 'exact', head: true })
          .eq('company_id', profile.company_id)
          .gte('created_at', new Date(today.setHours(0, 0, 0, 0)).toISOString());

        const numeroSecuencia = String((count || 0) + 1).padStart(4, '0');
        const numeroOrden = `CC-${dateStr}-${numeroSecuencia}`;

        const ordenData = {
          company_id: profile.company_id,
          numero_orden: numeroOrden,
          cliente_id: data.cliente_id,
          orden_trabajo_id: data.orden_trabajo_id || null,
          estado: 'pendiente' as EstadoOrdenCopiado,
          fecha_solicitud: new Date().toISOString(),
          fecha_entrega_estimada: data.fecha_entrega_estimada || null,
          fecha_entrega_real: null,
          total: 0,
          observaciones: data.observaciones || null,
          created_by: profile.id,
        };

        const { data: newOrden, error: insertError } = await supabase
          .from('centro_copiado_ordenes')
          .insert(ordenData)
          .select()
          .single();

        if (insertError) throw insertError;

        await fetchOrdenes();
        return newOrden;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Error al crear orden de copiado';
        setError(errorMessage);
        console.error('Error creating orden copiado:', err);
        return null;
      }
    },
    [profile?.company_id, profile?.id, fetchOrdenes]
  );

  const updateOrden = useCallback(
    async (ordenId: string, updates: Partial<CentroCopiadoOrden>) => {
      if (!profile?.company_id) {
        setError('No se pudo obtener la información del usuario');
        return false;
      }

      try {
        setError(null);

        const { error: updateError } = await supabase
          .from('centro_copiado_ordenes')
          .update(updates)
          .eq('id', ordenId)
          .eq('company_id', profile.company_id);

        if (updateError) throw updateError;

        await fetchOrdenes();
        return true;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Error al actualizar orden';
        setError(errorMessage);
        console.error('Error updating orden:', err);
        return false;
      }
    },
    [profile?.company_id, fetchOrdenes]
  );

  const updateEstado = useCallback(
    async (ordenId: string, nuevoEstado: EstadoOrdenCopiado, observaciones?: string) => {
      const updates: Partial<CentroCopiadoOrden> = {
        estado: nuevoEstado,
      };

      if (nuevoEstado === 'entregada') {
        updates.fecha_entrega_real = new Date().toISOString();
      }

      if (observaciones) {
        updates.observaciones = observaciones;
      }

      return updateOrden(ordenId, updates);
    },
    [updateOrden]
  );

  const deleteOrden = useCallback(
    async (ordenId: string) => {
      if (!profile?.company_id) {
        setError('No se pudo obtener la información del usuario');
        return false;
      }

      try {
        setError(null);

        const { error: deleteError } = await supabase
          .from('centro_copiado_ordenes')
          .delete()
          .eq('id', ordenId)
          .eq('company_id', profile.company_id);

        if (deleteError) throw deleteError;

        await fetchOrdenes();
        return true;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Error al eliminar orden';
        setError(errorMessage);
        console.error('Error deleting orden:', err);
        return false;
      }
    },
    [profile?.company_id, fetchOrdenes]
  );

  return {
    ordenes,
    totalCount,
    loading,
    error,
    fetchOrdenes,
    createOrden,
    updateOrden,
    updateEstado,
    deleteOrden,
  };
}
