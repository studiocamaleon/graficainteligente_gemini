import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import { useToast } from '../contexts/ToastContext';
import type {
  Presupuesto,
  PresupuestoConRelaciones,
  CreatePresupuestoData,
  UpdatePresupuestoData,
  PresupuestosFilters,
  PresupuestosPaginacion,
  PresupuestosResponse,
} from '../types/presupuestos';

export function usePresupuestos(
  filters?: PresupuestosFilters,
  pagination?: PresupuestosPaginacion
) {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [presupuestos, setPresupuestos] = useState<PresupuestoConRelaciones[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    if (user) {
      fetchPresupuestos();
    }
  }, [user, filters, pagination]);

  const fetchPresupuestos = async () => {
    try {
      setLoading(true);
      setError(null);

      // --- LOGICA DE BUSQUEDA (RPC) ---
      if (filters?.search && filters.search.length > 0) {
        if (!profile?.company_id) return;

        const { data: searchData, error: searchError } = await supabase
          .rpc('fn_search_presupuestos', {
            p_search_term: filters.search,
            p_company_id: profile.company_id,
            p_limit: pagination?.limit || 20,
            p_offset: ((pagination?.page || 1) - 1) * (pagination?.limit || 20)
          });

        if (searchError) throw searchError;

        const mappedData: PresupuestoConRelaciones[] = (searchData || []).map((item: any) => ({
          id: item.id,
          numero_presupuesto: item.numero_presupuesto,
          fecha_creacion: item.fecha_creacion,
          fecha_validez: item.fecha_validez,
          cliente_id: item.cliente_id,
          vendedor_id: item.vendedor_id,
          estado: item.estado,
          total: Number(item.total),
          company_id: item.company_id,
          cliente: {
            id: item.cliente_id,
            razon_social: item.cliente_razon_social,
            nombre_fantasia: item.cliente_nombre_fantasia,
            email: item.cliente_email,
            // whatsapp no viene en RPC por defecto, agregarlo si critico
          },
          vendedor: {
            id: item.vendedor_id,
            full_name: item.vendedor_full_name,
            // email no viene
          },
          orden_trabajo: item.orden_trabajo_id ? {
            id: item.orden_trabajo_id,
            numero_orden: item.orden_trabajo_numero,
            estado: 'pendiente' // Placeholder, no critico para lista
          } : undefined,
          items_count: Number(item.items_count),
          presupuestos_items: [{ count: Number(item.items_count) }] // Para compatibilidad
        }));

        setPresupuestos(mappedData);
        setTotal(searchData && searchData.length > 0 ? Number(searchData[0].full_count) : 0);
        return;
      }

      // --- LOGICA ESTANDAR (Query Builder) ---
      let query = supabase
        .from('presupuestos')
        .select(
          `
          *,
          cliente:clients!cliente_id (
            id,
            razon_social,
            nombre_fantasia,
            email,
            whatsapp
          ),
          vendedor:profiles!vendedor_id (
            id,
            full_name,
            email
          ),
          orden_trabajo:ordenes_trabajo!orden_trabajo_id (
            id,
            numero_orden,
            estado
          ),
          presupuestos_items (count)
        `,
          { count: 'exact' }
        );

      // Filtros
      // Note: Search filter handled above via RPC

      if (filters?.estado) {
        if (Array.isArray(filters.estado)) {
          query = query.in('estado', filters.estado);
        } else {
          query = query.eq('estado', filters.estado);
        }
      }

      if (filters?.canal_venta) {
        if (Array.isArray(filters.canal_venta)) {
          query = query.in('canal_venta', filters.canal_venta);
        } else {
          query = query.eq('canal_venta', filters.canal_venta);
        }
      }

      if (filters?.vendedor_id) {
        query = query.eq('vendedor_id', filters.vendedor_id);
      }

      if (filters?.cliente_id) {
        query = query.eq('cliente_id', filters.cliente_id);
      }

      if (filters?.fecha_desde) {
        query = query.gte('fecha_creacion', filters.fecha_desde);
      }

      if (filters?.fecha_hasta) {
        query = query.lte('fecha_creacion', filters.fecha_hasta);
      }

      if (filters?.solo_vencidos) {
        query = query.eq('estado', 'vencido');
      }

      if (filters?.solo_pendientes_respuesta) {
        query = query.eq('estado', 'enviado');
      }

      // Ordenamiento
      const orderBy = pagination?.order_by || 'fecha_creacion';
      const orderDirection = pagination?.order_direction || 'desc';
      query = query.order(orderBy, { ascending: orderDirection === 'asc' });

      // Paginación
      if (pagination?.page && pagination?.limit) {
        const from = (pagination.page - 1) * pagination.limit;
        const to = from + pagination.limit - 1;
        query = query.range(from, to);
      }

      const { data, error: fetchError, count } = await query;

      if (fetchError) throw fetchError;

      const presupuestosConCount = (data || []).map((p: any) => ({
        ...p,
        items_count: p.presupuestos_items?.[0]?.count || 0,
      }));

      setPresupuestos((presupuestosConCount as PresupuestoConRelaciones[]) || []);
      setTotal(count || 0);

    } catch (err: any) {
      console.error('Error fetching presupuestos:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const createPresupuesto = async (
    data: CreatePresupuestoData
  ): Promise<Presupuesto | null> => {
    try {
      setError(null);

      const { data: newPresupuesto, error: createError } = await supabase
        .from('presupuestos')
        .insert({
          ...data,
          company_id: profile?.company_id,
          estado: data.estado || 'borrador',
          created_by: user?.id,
        })
        .select()
        .single();

      if (createError) throw createError;

      // Refrescar lista
      await fetchPresupuestos();

      return newPresupuesto as Presupuesto;
    } catch (err: any) {
      console.error('Error creating presupuesto:', err);
      setError(err.message);
      return null;
    }
  };

  const updatePresupuesto = async (
    id: string,
    data: UpdatePresupuestoData
  ): Promise<boolean> => {
    try {
      setError(null);

      const { error: updateError } = await supabase
        .from('presupuestos')
        .update({
          ...data,
          updated_by: user?.id,
        })
        .eq('id', id);

      if (updateError) throw updateError;

      // Refrescar lista
      await fetchPresupuestos();

      return true;
    } catch (err: any) {
      console.error('Error updating presupuesto:', err);
      setError(err.message);
      return false;
    }
  };

  const deletePresupuesto = async (id: string): Promise<boolean> => {
    try {
      setError(null);

      const { error: deleteError } = await supabase
        .from('presupuestos')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;

      // Refrescar lista
      await fetchPresupuestos();

      return true;
    } catch (err: any) {
      console.error('Error deleting presupuesto:', err);
      setError(err.message);
      return false;
    }
  };

  const duplicarPresupuesto = async (id: string): Promise<Presupuesto | null> => {
    try {
      setError(null);

      // Obtener presupuesto original
      const { data: original, error: fetchError } = await supabase
        .from('presupuestos')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError) throw fetchError;

      // Crear copia sin id, numero, tracking_token, fechas específicas
      const { data: duplicado, error: createError } = await supabase
        .from('presupuestos')
        .insert({
          company_id: original.company_id,
          cliente_id: original.cliente_id,
          vendedor_id: original.vendedor_id,
          canal_venta: original.canal_venta,
          estado: 'borrador',
          condiciones_comerciales: original.condiciones_comerciales,
          notas_internas: original.notas_internas
            ? `${original.notas_internas}\n\nDuplicado de: ${original.numero_presupuesto}`
            : `Duplicado de: ${original.numero_presupuesto}`,
          created_by: user?.id,
        })
        .select()
        .single();

      if (createError) throw createError;

      // Copiar items
      const { data: items, error: itemsError } = await supabase
        .from('presupuestos_items')
        .select('*')
        .eq('presupuesto_id', id);

      if (itemsError) throw itemsError;

      if (items && items.length > 0) {
        const itemsCopiados = items.map((item: any) => ({
          presupuesto_id: duplicado.id,
          tipo_item: item.tipo_item,
          producto_id: item.producto_id,
          producto_nombre: item.producto_nombre,
          producto_categoria: item.producto_categoria,
          configuracion: item.configuracion,
          cantidad: item.cantidad,
          precio_base: item.precio_base,
          precio_servicios: item.precio_servicios,
          precio_acabados: item.precio_acabados,
          precio_unitario_final: item.precio_unitario_final,
          precio_total: item.precio_total,
          descripcion: item.descripcion,
          tiempo_produccion_dias: item.tiempo_produccion_dias,
        }));

        await supabase.from('presupuestos_items').insert(itemsCopiados);
      }

      // Refrescar lista
      await fetchPresupuestos();

      return duplicado as Presupuesto;
    } catch (err: any) {
      console.error('Error duplicando presupuesto:', err);
      setError(err.message);
      return null;
    }
  };

  const cambiarEstado = async (
    id: string,
    nuevoEstado: Presupuesto['estado']
  ): Promise<boolean> => {
    try {
      setError(null);

      const updateData: UpdatePresupuestoData = { estado: nuevoEstado };

      // Agregar timestamps según estado
      if (nuevoEstado === 'enviado') {
        updateData.fecha_enviado = new Date().toISOString();
      } else if (nuevoEstado === 'aprobado' || nuevoEstado === 'rechazado') {
        updateData.fecha_respuesta = new Date().toISOString();
      }

      return await updatePresupuesto(id, updateData);
    } catch (err: any) {
      console.error('Error cambiando estado:', err);
      setError(err.message);
      return false;
    }
  };

  const enviarPresupuesto = async (id: string): Promise<boolean> => {
    const resultado = await cambiarEstado(id, 'enviado');

    // Como respaldo, llamar directamente a enviarNotificacionPresupuesto
    // por si el trigger falla (especialmente en local/dev)
    if (resultado) {
      try {
        await enviarNotificacionPresupuesto(id, 'presupuesto_listo');
      } catch (err) {
        console.warn('Error enviando notificación de respaldo:', err);
        // No fallar si la notificación falla
      }
    }

    return resultado;
  };

  const aprobarPresupuesto = async (
    id: string,
    observaciones?: string
  ): Promise<boolean> => {
    try {
      setError(null);

      const { error: updateError } = await supabase
        .from('presupuestos')
        .update({
          estado: 'aprobado',
          fecha_respuesta: new Date().toISOString(),
          observaciones_cliente: observaciones,
          updated_by: user?.id,
        })
        .eq('id', id);

      if (updateError) throw updateError;

      await fetchPresupuestos();
      return true;
    } catch (err: any) {
      console.error('Error aprobando presupuesto:', err);
      setError(err.message);
      return false;
    }
  };

  const rechazarPresupuesto = async (
    id: string,
    motivoRechazo: string,
    observaciones?: string
  ): Promise<boolean> => {
    try {
      setError(null);

      const observacionesCompletas = observaciones
        ? `MOTIVO: ${motivoRechazo}\n\n${observaciones}`
        : `MOTIVO: ${motivoRechazo}`;

      const { error: updateError } = await supabase
        .from('presupuestos')
        .update({
          estado: 'rechazado',
          fecha_respuesta: new Date().toISOString(),
          observaciones_cliente: observacionesCompletas,
          updated_by: user?.id,
        })
        .eq('id', id);

      if (updateError) throw updateError;

      await fetchPresupuestos();
      return true;
    } catch (err: any) {
      console.error('Error rechazando presupuesto:', err);
      setError(err.message);
      return false;
    }
  };

  const enviarNotificacionPresupuesto = async (
    presupuestoId: string,
    tipoNotificacion: 'presupuesto_listo' | 'presupuesto_aprobado' | 'presupuesto_vencido'
  ): Promise<boolean> => {
    try {
      setError(null);

      if (!profile?.company_id) {
        throw new Error('No se encontró información de la empresa');
      }

      const { data, error: functionError } = await supabase.functions.invoke(
        'notify-presupuesto',
        {
          body: {
            presupuesto_id: presupuestoId,
            company_id: profile.company_id,
            tipo_notificacion: tipoNotificacion,
            frontend_origin: window.location.origin,
          },
        }
      );

      if (functionError) throw functionError;

      if (!data?.success) {
        throw new Error(data?.error || data?.message || 'Error desconocido al enviar notificación');
      }

      return true;
    } catch (err: any) {
      console.error('Error enviando notificación:', err);
      toast.error(`Error de notificación: ${err.message}`);
      return false;
    }
  };

  const convertirAOrden = async (
    presupuestoId: string,
    params: {
      fechaEntrega: string;
      notasAdicionales?: string;
      montoPago?: number;
      medioCobroId?: string;
      referenciaPago?: string;
      rutasPersonalizadas?: Record<string, any[]>;
      requiereFactura?: boolean;
    }
  ): Promise<string | null> => {
    try {
      setError(null);

      const { data, error: rpcError } = await supabase.rpc(
        'fn_convertir_presupuesto_a_orden',
        {
          p_copiar_archivos: true,
          p_fecha_entrega_estimada: params.fechaEntrega,
          p_medio_cobro_id: params.medioCobroId || null,
          p_monto_pago: params.montoPago || null,
          p_notas_adicionales: params.notasAdicionales || null,
          p_presupuesto_id: presupuestoId,
          p_referencia_pago: params.referenciaPago || null,
          p_requiere_factura: params.requiereFactura || false,
          p_rutas_personalizadas: params.rutasPersonalizadas || null,
        } as any
      );

      if (rpcError) throw rpcError;

      await fetchPresupuestos();

      return data as string;
    } catch (err: any) {
      console.error('Error convirtiendo presupuesto:', err);
      setError(err.message);
      return null;
    }
  };

  return {
    presupuestos,
    loading,
    error,
    total,
    refetch: fetchPresupuestos,
    createPresupuesto,
    updatePresupuesto,
    deletePresupuesto,
    duplicarPresupuesto,
    cambiarEstado,
    enviarPresupuesto,
    aprobarPresupuesto,
    rechazarPresupuesto,
    enviarNotificacionPresupuesto,
    convertirAOrden,
  };
}
