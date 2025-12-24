import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import { getArgentinaDate, startOfDay } from '../utils/dates';
import type {
  CentroCopiadoOrden,
  EstadoOrdenCopiado,
  CentroCopiadoOrdenItem
} from '../types/database';
import type { ItemCopiadoConfig } from '../components/centro-copiado/CentroCopiadoItemForm';

interface ItemWithId {
  id: string;
  config: Partial<ItemCopiadoConfig>;
  precio?: number;
  isCollapsed?: boolean;
  archivoId?: string;
  nombreArchivo?: string;
  descripcion?: string;
}

interface UseCentroCopiadoOrdenesParams {
  searchTerm?: string;
  estado?: EstadoOrdenCopiado | null;
  estados?: EstadoOrdenCopiado[];
  clienteId?: string | null;
  fechaDesde?: string | null;
  fechaHasta?: string | null;
  page?: number;
  itemsPerPage?: number;
  enabled?: boolean;
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
  origen: 'WhatsApp' | 'Web' | 'Mostrador' | 'App Mobile';
  orden_trabajo_id?: string;
  fecha_entrega_estimada?: string;
  observaciones?: string;
  requiere_factura?: boolean;
  total: number;
  subtotal: number;
  total_descuentos: number;
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
    estados = [],
    clienteId = null,
    fechaDesde = null,
    fechaHasta = null,
    page = 1,
    itemsPerPage = 25,
    enabled = true,
  } = params;

  const fetchOrdenes = useCallback(async () => {
    if (!profile?.company_id || !enabled) return;

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

      if (estados && estados.length > 0) {
        query = query.in('estado', estados);
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
        // First find clients matching the search term
        const { data: matchingClients } = await supabase
          .from('clients')
          .select('id')
          .ilike('nombre_fantasia', `%${searchTerm}%`)
          .limit(20);

        const clientIds = matchingClients?.map((c) => c.id) || [];

        let orCondition = `numero_orden.ilike.%${searchTerm}%,observaciones.ilike.%${searchTerm}%`;

        if (clientIds.length > 0) {
          orCondition += `,cliente_id.in.(${clientIds.join(',')})`;
        }

        query = query.or(orCondition);
      }

      const from = (page - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;

      query = query.order('fecha_solicitud', { ascending: true }).range(from, to);

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
    Array.isArray(estados) ? estados.join(',') : '', // Stabilize array dependency
    clienteId,
    fechaDesde,
    fechaHasta,
    page,
    itemsPerPage,
    enabled,
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

        const today = getArgentinaDate();
        const dateStr = today.format('YYYYMMDD');

        // Obtener la última orden del día para calcular la secuencia
        const { data: lastOrder } = await supabase
          .from('centro_copiado_ordenes')
          .select('numero_orden')
          .eq('company_id', profile.company_id)
          .gte('created_at', startOfDay(today).toISOString())
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        let nextSequence = 1;
        if (lastOrder?.numero_orden) {
          const parts = lastOrder.numero_orden.split('-');
          if (parts.length === 3) {
            const lastSequence = parseInt(parts[2], 10);
            if (!isNaN(lastSequence)) {
              nextSequence = lastSequence + 1;
            }
          }
        }

        const numeroSecuencia = String(nextSequence).padStart(4, '0');
        const numeroOrden = `CC-${dateStr}-${numeroSecuencia}`;

        const ordenData = {
          company_id: profile.company_id,
          numero_orden: numeroOrden,
          cliente_id: data.cliente_id,
          canal_venta: data.origen, // Map origin to expected DB column
          orden_trabajo_id: data.orden_trabajo_id || null,
          estado: 'pendiente' as EstadoOrdenCopiado,
          fecha_solicitud: new Date().toISOString(),
          fecha_entrega_estimada: data.fecha_entrega_estimada || null,
          fecha_entrega_real: null,
          total: data.total,
          subtotal: data.subtotal,
          total_descuentos: data.total_descuentos,
          observaciones: data.observaciones || null,
          created_by: profile.id,
          requiere_factura: data.requiere_factura || false,
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

  const updateOrdenCompleta = useCallback(
    async (ordenId: string, data: CreateOrdenCopiadoData, items: ItemWithId[]) => {
      if (!profile?.company_id) {
        setError('No se pudo obtener la información del usuario');
        return false;
      }

      try {
        setError(null);
        setLoading(true);

        // 1. Actualizar datos de la orden
        const { error: updateOrderError } = await supabase
          .from('centro_copiado_ordenes')
          .update({
            cliente_id: data.cliente_id,
            canal_venta: data.origen,
            orden_trabajo_id: data.orden_trabajo_id || null,
            fecha_entrega_estimada: data.fecha_entrega_estimada || null,
            total: data.total,
            subtotal: data.subtotal,
            total_descuentos: data.total_descuentos,
            observaciones: data.observaciones || null,
            requiere_factura: data.requiere_factura || false,
            updated_at: new Date().toISOString(),
          })
          .eq('id', ordenId)
          .eq('company_id', profile.company_id);

        if (updateOrderError) throw updateOrderError;

        // 2. Gestionar Items
        // Obtener items actuales para saber cuáles eliminar
        const { data: currentItems } = await supabase
          .from('centro_copiado_ordenes_items')
          .select('id')
          .eq('orden_copiado_id', ordenId);

        const currentIds = currentItems?.map((i) => i.id) || [];
        const incomingIds = items
          .filter((i) => !i.id.startsWith('temp_')) // Solo IDs reales (UUIDs)
          .map((i) => i.id);

        // Identificar items a eliminar
        const itemsToDelete = currentIds.filter((id) => !incomingIds.includes(id));

        if (itemsToDelete.length > 0) {
          const { error: deleteError } = await supabase
            .from('centro_copiado_ordenes_items')
            .delete()
            .in('id', itemsToDelete);

          if (deleteError) throw deleteError;
        }

        // Procesar items (Insertar o Actualizar)
        for (const item of items) {
          const config = item.config;

          const esPloteoCad = config.modo_item === 'ploteo_cad';

          // Validar config mínima necesaria
          if (esPloteoCad) {
            if (
              !config.ploteo_cad_tipo_papel ||
              !config.ploteo_cad_ancho_rollo ||
              !config.ploteo_cad_metros_lineales ||
              !config.cantidad_copias
            ) {
              continue;
            }
          } else {
            if (
              !config.tamanio_papel_id ||
              !config.papel_id ||
              !config.tipo_tinta ||
              !config.cara_impresa ||
              !config.cantidad_hojas ||
              !config.cantidad_copias
            ) {
              continue;
            }
          }

          const itemData = {
            orden_copiado_id: ordenId,
            // Common
            cantidad_unidades: config.cantidad_copias,
            precio_unitario: (item.precio || 0) / (config.cantidad_copias || 1),
            subtotal: item.precio || 0,
            descripcion: item.descripcion || null,

            // Imprimir / Standard Fields (Null if CAD)
            tipo_item: esPloteoCad ? null : 'impresion', // Or handled by DB default? Usually 'impresion' by default but we added 'es_ploteo_cad'. 
            // Actually existing table has tipo_item enum. Does it have 'ploteo_cad'? No. 
            // Logic: if es_ploteo_cad is true, tipo_item might be null or we reuse 'impresion'?
            // Looking at migration, we added `es_ploteo_cad` column. The `tipo_item` enum was likely not modified.
            // Let's check `types/database.ts`. TipoItemCopiado = 'impresion' | 'anillado' | 'plastificado'.
            // So if it is Ploteo CAD, we probably should set `tipo_item` to null or keep it as 'impresion' but ignore it?
            // "Impresión de Planos" is technically printing.
            // Let's set it to 'impresion' for now, or null if allowed.
            // The constraint might require a value.
            // In `CrearOrdenCopiado.tsx` I didn't set `tipo_item` explicitely for Ploteo CAD in my previous edit?
            // Wait, I might have missed `tipo_item` in `CrearOrdenCopiado.tsx`?
            // Let's check `CrearOrdenCopiado.tsx`.
            // Line 448 in ORIGINAL code (before my edit) didn't set `tipo_item`.
            // Oh, checking `useCentroCopiadoOrdenItems.ts` line 98: `tipo_item: 'impresion'`.
            // So I should stick to 'impresion' or check if constraint allows null.
            // Given I am not modifying the enum, keeping 'impresion' is safest, but `es_ploteo_cad` flag distinguishes it.

            tipo_item: 'impresion', // Defaulting to impresion as it is printing
            tamanio_papel_id: !esPloteoCad ? config.tamanio_papel_id : null,
            papel_id: !esPloteoCad ? config.papel_id : null,
            tipo_tinta: !esPloteoCad ? config.tipo_tinta : null,
            cara_impresa: !esPloteoCad ? config.cara_impresa : null,
            cantidad_hojas: !esPloteoCad ? config.cantidad_hojas : null,
            tipo_anillado: !esPloteoCad ? config.anillado?.tipo || null : null,
            tipo_plastificado: !esPloteoCad ? config.plastificado?.tipo || null : null,
            con_guillotinado: !esPloteoCad ? !!config.guillotinado : false,

            // Ploteo CAD fields
            es_ploteo_cad: esPloteoCad,
            ploteo_cad_tipo_papel: esPloteoCad ? config.ploteo_cad_tipo_papel : null,
            ploteo_cad_ancho_rollo: esPloteoCad ? config.ploteo_cad_ancho_rollo : null,
            ploteo_cad_metros_lineales: esPloteoCad ? config.ploteo_cad_metros_lineales : null,
          };

          if (item.id.startsWith('temp_')) {
            // INSERTAR NUEVO ITEM
            const { data: newItem, error: insertError } = await supabase
              .from('centro_copiado_ordenes_items')
              .insert(itemData as any)
              .select()
              .single();

            if (insertError) throw insertError;

            // Asociar archivo si existe
            if (newItem && item.archivoId) {
              await supabase
                .from('centro_copiado_ordenes_archivos')
                .update({ item_generado_id: newItem.id })
                .eq('id', item.archivoId);
            }
          } else {
            // ACTUALIZAR ITEM EXISTENTE
            const { error: updateItemError } = await supabase
              .from('centro_copiado_ordenes_items')
              .update(itemData as any)
              .eq('id', item.id);

            if (updateItemError) throw updateItemError;

            // Nota: No actualizamos asociación de archivos en edición de items existentes 
            // a menos que sea explícitamente necesario, lo cual requeriría lógica extra.
          }
        }

        await fetchOrdenes();
        return true;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Error al actualizar la orden completa';
        setError(errorMessage);
        console.error('Error updating orden completa:', err);
        return false;
      } finally {
        setLoading(false);
      }
    },
    [profile?.company_id, fetchOrdenes]
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
    updateOrdenCompleta,
    updateEstado,
    deleteOrden,
  };
}
