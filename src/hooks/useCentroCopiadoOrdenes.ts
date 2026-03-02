import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
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

interface SearchCentroCopiadoOrdenRpcRow {
  id: string;
  company_id: string;
  numero_orden: string | null;
  orden_trabajo_id: string | null;
  cliente_id: string | null;
  requiere_despacho: boolean;
  estado: EstadoOrdenCopiado;
  fecha_solicitud: string;
  fecha_entrega_estimada: string | null;
  fecha_entrega_real: string | null;
  total: number;
  observaciones: string | null;
  requiere_factura: boolean;
  numero_factura: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  canal_venta: CentroCopiadoOrden['canal_venta'];
  subtotal: number;
  total_descuentos: number;
  cliente_nombre: string | null;
  cliente_documento: string | null;
  created_by_full_name: string | null;
  created_by_avatar_url: string | null;
  items_count: number;
  full_count: number;
}

interface CreateOrdenCopiadoData {
  cliente_id?: string | null;
  origen?: 'WhatsApp' | 'Web' | 'Mostrador' | 'App Mobile' | null;
  requiere_despacho?: boolean;
  orden_trabajo_id?: string;
  fecha_entrega_estimada?: string;
  observaciones?: string;
  requiere_factura?: boolean;
  total: number;
  subtotal: number;
  total_descuentos: number;
  estado?: EstadoOrdenCopiado;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value?: string | null): value is string {
  return !!value && UUID_REGEX.test(value);
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

      const from = (page - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;
      const trimmedSearchTerm = searchTerm.trim();

      if (trimmedSearchTerm) {
        const { data, error: searchError } = await supabase.rpc(
          'fn_search_centro_copiado_ordenes',
          {
            p_company_id: profile.company_id,
            p_search_term: trimmedSearchTerm,
            p_estado: estado,
            p_estados: estados.length > 0 ? estados : null,
            p_cliente_id: clienteId,
            p_fecha_desde: fechaDesde,
            p_fecha_hasta: fechaHasta,
            p_limit: itemsPerPage,
            p_offset: from,
          }
        );

        if (searchError) throw searchError;

        const searchRows = (data || []) as SearchCentroCopiadoOrdenRpcRow[];
        const mappedRows = searchRows.map((item) => ({
          id: item.id,
          company_id: item.company_id,
          numero_orden: item.numero_orden,
          orden_trabajo_id: item.orden_trabajo_id,
          cliente_id: item.cliente_id,
          requiere_despacho: item.requiere_despacho,
          estado: item.estado,
          fecha_solicitud: item.fecha_solicitud,
          fecha_entrega_estimada: item.fecha_entrega_estimada,
          fecha_entrega_real: item.fecha_entrega_real,
          total: item.total,
          observaciones: item.observaciones,
          requiere_factura: item.requiere_factura,
          numero_factura: item.numero_factura,
          created_by: item.created_by,
          created_at: item.created_at,
          updated_at: item.updated_at,
          canal_venta: item.canal_venta,
          subtotal: item.subtotal,
          total_descuentos: item.total_descuentos,
          cliente: item.cliente_id
            ? {
                id: item.cliente_id,
                nombre_fantasia: item.cliente_nombre || 'Sin cliente',
                numero_documento: item.cliente_documento || '',
              }
            : undefined,
          created_by_profile: item.created_by
            ? {
                id: item.created_by,
                full_name: item.created_by_full_name || '',
                avatar_url: item.created_by_avatar_url,
              }
            : undefined,
          items_count: item.items_count || 0,
        })) as OrdenCopiadoWithRelations[];

        setOrdenes(mappedRows);
        setTotalCount(searchRows.length > 0 ? Number(searchRows[0].full_count || 0) : 0);
        return;
      }

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

        const estadoInicial: EstadoOrdenCopiado = data.estado || 'pendiente';
        const fechaEntregaReal = estadoInicial === 'entregada' ? new Date().toISOString() : null;

        const ordenData = {
          company_id: profile.company_id,
          numero_orden: null,
          cliente_id: data.cliente_id || null,
          canal_venta: data.origen || null, // Map origin to expected DB column
          requiere_despacho: Boolean(data.requiere_despacho),
          orden_trabajo_id: data.orden_trabajo_id || null,
          estado: estadoInicial,
          fecha_solicitud: new Date().toISOString(),
          fecha_entrega_estimada: data.fecha_entrega_estimada || null,
          fecha_entrega_real: fechaEntregaReal,
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

        if (estadoInicial !== 'borrador') {
          await supabase.rpc('fn_assign_numero_orden_cc_if_missing', {
            p_orden_id: newOrden.id,
          } as any);
        }

        await fetchOrdenes();
        const { data: refreshed } = await supabase
          .from('centro_copiado_ordenes')
          .select('*')
          .eq('id', newOrden.id)
          .maybeSingle();
        return (refreshed || newOrden) as any;
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
            requiere_despacho: Boolean(data.requiere_despacho),
            ...(data.estado ? { estado: data.estado } : {}),
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

        if ((data.estado || 'pendiente') !== 'borrador') {
          await supabase.rpc('fn_assign_numero_orden_cc_if_missing', {
            p_orden_id: ordenId,
          } as any);
        }

        // 2. Gestionar Items
        // Obtener items actuales para saber cuáles eliminar
        const { data: currentItems } = await supabase
          .from('centro_copiado_ordenes_items')
          .select('id')
          .eq('orden_copiado_id', ordenId);

        const currentIds = currentItems?.map((i) => i.id) || [];
        const incomingIds = items
          .filter((i) => isUuid(i.id))
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

          if (!isUuid(item.id)) {
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
