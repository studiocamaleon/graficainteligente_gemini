import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type {
  Pedido,
  EstadoPedido,
  OpcionesSeleccionadas,
  PedidoRutaResuelta
} from '../types/database';

interface UsePedidosOptions {
  estado?: EstadoPedido;
  productoId?: string;
  clienteId?: string;
  searchTerm?: string;
  itemsPerPage?: number;
}

interface CreatePedidoData {
  producto_id: string;
  cliente_id: string;
  cantidad: number;
  estado?: EstadoPedido;
  fecha_pedido?: string;
  fecha_entrega_estimada?: string | null;
  opciones_seleccionadas: OpcionesSeleccionadas;
  notas?: string | null;
  precio_total?: number | null;
}

interface UpdatePedidoData {
  cantidad?: number;
  estado?: EstadoPedido;
  fecha_entrega_estimada?: string | null;
  fecha_entrega_real?: string | null;
  opciones_seleccionadas?: OpcionesSeleccionadas;
  notas?: string | null;
  precio_total?: number | null;
}

export function usePedidos(options: UsePedidosOptions = {}) {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);

  const itemsPerPage = options.itemsPerPage || 20;

  const fetchPedidos = useCallback(async (page: number = 1) => {
    try {
      setLoading(true);
      setError(null);

      const from = (page - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;

      let query = supabase
        .from('pedidos')
        .select('*, productos(nombre), clients(nombre_fantasia)', { count: 'exact' });

      if (options.estado) {
        query = query.eq('estado', options.estado);
      }

      if (options.productoId) {
        query = query.eq('producto_id', options.productoId);
      }

      if (options.clienteId) {
        query = query.eq('cliente_id', options.clienteId);
      }

      if (options.searchTerm) {
        query = query.ilike('numero_pedido', `%${options.searchTerm}%`);
      }

      query = query
        .order('created_at', { ascending: false })
        .range(from, to);

      const { data, error: fetchError, count } = await query;

      if (fetchError) throw fetchError;

      setPedidos(data || []);
      setTotalCount(count || 0);
      setCurrentPage(page);
    } catch (err) {
      console.error('Error fetching pedidos:', err);
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  }, [options.estado, options.productoId, options.clienteId, options.searchTerm, itemsPerPage]);

  useEffect(() => {
    fetchPedidos(1);
  }, [fetchPedidos]);

  const createPedido = async (data: CreatePedidoData): Promise<Pedido> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuario no autenticado');

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .single();

      if (!profile) throw new Error('Perfil no encontrado');

      const { data: numeroData, error: numeroError } = await supabase.rpc('generar_numero_pedido', {
        p_company_id: profile.company_id
      });

      if (numeroError) throw numeroError;

      const { data: newPedido, error: createError } = await supabase
        .from('pedidos')
        .insert([{
          ...data,
          company_id: profile.company_id,
          numero_pedido: numeroData,
          created_by: user.id,
          estado: data.estado || 'borrador'
        }])
        .select()
        .single();

      if (createError) throw createError;

      const { error: rutaError } = await supabase.rpc('fn_crear_ruta_resuelta_pedido', {
        p_pedido_id: newPedido.id
      });

      if (rutaError) throw rutaError;

      await fetchPedidos(currentPage);
      return newPedido;
    } catch (err) {
      console.error('Error creating pedido:', err);
      throw err;
    }
  };

  const updatePedido = async (id: string, updates: UpdatePedidoData): Promise<Pedido> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuario no autenticado');

      const { data: updated, error: updateError } = await supabase
        .from('pedidos')
        .update({
          ...updates,
          updated_by: user.id
        })
        .eq('id', id)
        .select()
        .single();

      if (updateError) throw updateError;

      if (updates.opciones_seleccionadas) {
        const { error: rutaError } = await supabase.rpc('fn_crear_ruta_resuelta_pedido', {
          p_pedido_id: id
        });

        if (rutaError) throw rutaError;
      }

      await fetchPedidos(currentPage);
      return updated;
    } catch (err) {
      console.error('Error updating pedido:', err);
      throw err;
    }
  };

  const deletePedido = async (id: string): Promise<void> => {
    try {
      const { error: deleteError } = await supabase
        .from('pedidos')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;

      await fetchPedidos(currentPage);
    } catch (err) {
      console.error('Error deleting pedido:', err);
      throw err;
    }
  };

  const getRutaResuelta = async (pedidoId: string): Promise<PedidoRutaResuelta[]> => {
    try {
      const { data, error } = await supabase
        .from('pedidos_rutas_resueltas')
        .select('*')
        .eq('pedido_id', pedidoId)
        .order('orden', { ascending: true });

      if (error) throw error;

      return data || [];
    } catch (err) {
      console.error('Error fetching ruta resuelta:', err);
      throw err;
    }
  };

  const resolverRutaEnTiempoReal = async (
    productoId: string,
    opcionesCliente: OpcionesSeleccionadas
  ): Promise<PedidoRutaResuelta[]> => {
    try {
      const { data, error } = await supabase.rpc('fn_resolver_ruta_produccion', {
        p_producto_id: productoId,
        p_opciones_cliente: opcionesCliente as any
      });

      if (error) throw error;

      return data as PedidoRutaResuelta[];
    } catch (err) {
      console.error('Error resolving ruta:', err);
      throw err;
    }
  };

  const actualizarEstadoPaso = async (
    rutaId: string,
    nuevoEstado: 'pendiente' | 'en_proceso' | 'completado' | 'omitido',
    responsableId?: string | null,
    notas?: string | null
  ): Promise<void> => {
    try {
      const updates: any = {
        estado_paso: nuevoEstado
      };

      if (nuevoEstado === 'en_proceso' && !responsableId) {
        updates.fecha_inicio = new Date().toISOString();
      }

      if (nuevoEstado === 'completado') {
        updates.fecha_fin = new Date().toISOString();
      }

      if (responsableId !== undefined) {
        updates.responsable_id = responsableId;
      }

      if (notas !== undefined) {
        updates.notas = notas;
      }

      const { error } = await supabase
        .from('pedidos_rutas_resueltas')
        .update(updates)
        .eq('id', rutaId);

      if (error) throw error;
    } catch (err) {
      console.error('Error updating paso estado:', err);
      throw err;
    }
  };

  return {
    pedidos,
    loading,
    error,
    totalCount,
    currentPage,
    totalPages: Math.ceil(totalCount / itemsPerPage),
    createPedido,
    updatePedido,
    deletePedido,
    getRutaResuelta,
    resolverRutaEnTiempoReal,
    actualizarEstadoPaso,
    refetch: (page?: number) => fetchPedidos(page || currentPage),
    goToPage: fetchPedidos
  };
}
