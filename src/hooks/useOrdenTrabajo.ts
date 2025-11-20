import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import type {
  OrdenTrabajo,
  OrdenTrabajoItem,
  OrdenTrabajoPago,
  OrdenTrabajoHistorial,
  CanalVenta,
  EstadoOrdenTrabajo,
  ItemConfiguracion,
  TipoEventoHistorial,
} from '../types/database';

export interface OrdenTrabajoFull extends OrdenTrabajo {
  items?: OrdenTrabajoItemFull[];
  pagos?: OrdenTrabajoPago[];
  historial?: OrdenTrabajoHistorial[];
  cliente?: {
    id: string;
    nombre_fantasia: string;
    razon_social: string;
    numero_documento: string;
    email: string | null;
  };
  created_by_profile?: {
    id: string;
    full_name: string;
    email: string;
  };
}

export interface OrdenTrabajoItemFull extends OrdenTrabajoItem {
  producto?: {
    id: string;
    nombre: string;
    categoria_id: string;
  };
}

interface CreateOrdenData {
  cliente_id: string;
  canal_venta: CanalVenta;
  fecha_estimada_entrega?: string;
  notas_internas?: string;
}

interface UpdateOrdenData {
  cliente_id?: string;
  canal_venta?: CanalVenta;
  estado?: EstadoOrdenTrabajo;
  fecha_estimada_entrega?: string | null;
  notas_internas?: string | null;
}

interface AddItemData {
  producto_id: string;
  cantidad: number;
  configuracion: ItemConfiguracion;
  precio_base: number;
  precio_servicios: number;
  precio_acabados: number;
  precio_unitario_final: number;
  precio_total: number;
}

interface CreateOrdenConItemsData {
  ordenData: CreateOrdenData;
  items: AddItemData[];
  estadoInicial?: EstadoOrdenTrabajo;
}

interface AddPagoData {
  fecha_pago: string;
  monto: number;
  metodo_pago: string;
  referencia_pago?: string;
  comprobante_url?: string;
  notas?: string;
}

export function useOrdenTrabajo() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addHistorialEvent = async (
    ordenId: string,
    tipoEvento: TipoEventoHistorial,
    descripcion: string,
    metadata: Record<string, any> = {}
  ) => {
    try {
      await supabase.from('ordenes_trabajo_historial').insert([
        {
          orden_id: ordenId,
          usuario_id: profile?.id || null,
          tipo_evento: tipoEvento,
          descripcion,
          metadata,
          ip_address: null,
        },
      ]);
    } catch (err) {
      console.error('Error adding historial event:', err);
    }
  };

  const getOrdenById = async (id: string): Promise<OrdenTrabajoFull | null> => {
    if (!profile?.company_id) {
      setError('No hay empresa asociada');
      return null;
    }

    try {
      setLoading(true);
      setError(null);

      // Nota: Usamos profiles!ordenes_trabajo_created_by_fkey para especificar explícitamente la relación
      // ya que ordenes_trabajo tiene múltiples FKs a profiles (vendedor_id, created_by, updated_by)
      // El campo vendedor_id está reservado para futura funcionalidad de vendedores/comisionistas
      const { data: orden, error: ordenError } = await supabase
        .from('ordenes_trabajo')
        .select(
          `
          *,
          cliente:clients(id, nombre_fantasia, razon_social, numero_documento, email),
          created_by_profile:profiles!ordenes_trabajo_created_by_fkey(id, full_name, email)
        `
        )
        .eq('id', id)
        .eq('company_id', profile.company_id)
        .single();

      if (ordenError) throw ordenError;

      const [itemsRes, pagosRes, historialRes] = await Promise.all([
        supabase
          .from('ordenes_trabajo_items')
          .select('*, producto:productos(id, nombre, categoria_id)')
          .eq('orden_id', id)
          .order('created_at', { ascending: true }),
        supabase
          .from('ordenes_trabajo_pagos')
          .select('*')
          .eq('orden_id', id)
          .order('fecha_pago', { ascending: false }),
        supabase
          .from('ordenes_trabajo_historial')
          .select('*')
          .eq('orden_id', id)
          .order('created_at', { ascending: false }),
      ]);

      if (itemsRes.error) throw itemsRes.error;
      if (pagosRes.error) throw pagosRes.error;
      if (historialRes.error) throw historialRes.error;

      return {
        ...orden,
        items: itemsRes.data as OrdenTrabajoItemFull[],
        pagos: pagosRes.data,
        historial: historialRes.data,
      } as OrdenTrabajoFull;
    } catch (err) {
      console.error('Error fetching orden:', err);
      setError(err instanceof Error ? err.message : 'Error al cargar orden');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const createOrden = async (data: CreateOrdenData): Promise<OrdenTrabajoFull | null> => {
    if (!profile?.company_id || !profile?.id) {
      setError('No hay empresa o usuario asociado');
      return null;
    }

    try {
      setLoading(true);
      setError(null);

      const { data: newOrden, error: ordenError } = await supabase
        .from('ordenes_trabajo')
        .insert([
          {
            company_id: profile.company_id,
            cliente_id: data.cliente_id,
            vendedor_id: profile.id, // Por ahora es igual a created_by, reservado para futura funcionalidad
            canal_venta: data.canal_venta,
            estado: 'borrador',
            fecha_creacion: new Date().toISOString(),
            fecha_estimada_entrega: data.fecha_estimada_entrega || null,
            notas_internas: data.notas_internas || null,
            subtotal: 0,
            total_descuentos: 0,
            total: 0,
            created_by: profile.id,
            numero_orden: '',
          },
        ])
        .select()
        .single();

      if (ordenError) throw ordenError;

      await addHistorialEvent(
        newOrden.id,
        'creacion',
        `Orden de trabajo creada por ${profile.full_name}`
      );

      return await getOrdenById(newOrden.id);
    } catch (err) {
      console.error('Error creating orden:', err);
      setError(err instanceof Error ? err.message : 'Error al crear orden');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const updateOrden = async (id: string, data: UpdateOrdenData): Promise<boolean> => {
    if (!profile?.company_id) {
      setError('No hay empresa asociada');
      return false;
    }

    try {
      setLoading(true);
      setError(null);

      const updateData: any = {
        updated_by: profile.id,
      };

      if (data.cliente_id) updateData.cliente_id = data.cliente_id;
      if (data.canal_venta) updateData.canal_venta = data.canal_venta;
      if (data.estado) updateData.estado = data.estado;
      if (data.fecha_estimada_entrega !== undefined)
        updateData.fecha_estimada_entrega = data.fecha_estimada_entrega;
      if (data.notas_internas !== undefined) updateData.notas_internas = data.notas_internas;

      const { error: updateError } = await supabase
        .from('ordenes_trabajo')
        .update(updateData)
        .eq('id', id)
        .eq('company_id', profile.company_id);

      if (updateError) throw updateError;

      if (data.estado) {
        await addHistorialEvent(id, 'cambio_estado', `Estado cambiado a: ${data.estado}`, {
          estado_anterior: data.estado,
          estado_nuevo: data.estado,
        });
      } else {
        await addHistorialEvent(id, 'modificacion', 'Orden de trabajo modificada');
      }

      return true;
    } catch (err) {
      console.error('Error updating orden:', err);
      setError(err instanceof Error ? err.message : 'Error al actualizar orden');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const deleteOrden = async (id: string): Promise<boolean> => {
    if (!profile?.company_id) {
      setError('No hay empresa asociada');
      return false;
    }

    try {
      setLoading(true);
      setError(null);

      const { error: deleteError } = await supabase
        .from('ordenes_trabajo')
        .delete()
        .eq('id', id)
        .eq('company_id', profile.company_id);

      if (deleteError) throw deleteError;

      return true;
    } catch (err) {
      console.error('Error deleting orden:', err);
      setError(err instanceof Error ? err.message : 'Error al eliminar orden');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const addItem = async (ordenId: string, itemData: AddItemData): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);

      const { data: newItem, error: itemError } = await supabase
        .from('ordenes_trabajo_items')
        .insert([
          {
            orden_id: ordenId,
            ...itemData,
          },
        ])
        .select()
        .single();

      if (itemError) throw itemError;

      const { data: orden } = await supabase
        .from('ordenes_trabajo')
        .select('subtotal')
        .eq('id', ordenId)
        .single();

      const nuevoSubtotal = (orden?.subtotal || 0) + itemData.precio_total;

      await supabase
        .from('ordenes_trabajo')
        .update({ subtotal: nuevoSubtotal, total: nuevoSubtotal })
        .eq('id', ordenId);

      await addHistorialEvent(ordenId, 'item_agregado', 'Item agregado a la orden', {
        item_id: newItem.id,
        producto_id: itemData.producto_id,
        cantidad: itemData.cantidad,
      });

      return true;
    } catch (err) {
      console.error('Error adding item:', err);
      setError(err instanceof Error ? err.message : 'Error al agregar item');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const updateItem = async (
    itemId: string,
    ordenId: string,
    itemData: Partial<AddItemData>
  ): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);

      const { data: oldItem } = await supabase
        .from('ordenes_trabajo_items')
        .select('precio_total')
        .eq('id', itemId)
        .single();

      const { error: updateError } = await supabase
        .from('ordenes_trabajo_items')
        .update(itemData)
        .eq('id', itemId);

      if (updateError) throw updateError;

      if (itemData.precio_total !== undefined && oldItem) {
        const diferencia = itemData.precio_total - oldItem.precio_total;

        const { data: orden } = await supabase
          .from('ordenes_trabajo')
          .select('subtotal')
          .eq('id', ordenId)
          .single();

        const nuevoSubtotal = (orden?.subtotal || 0) + diferencia;

        await supabase
          .from('ordenes_trabajo')
          .update({ subtotal: nuevoSubtotal, total: nuevoSubtotal })
          .eq('id', ordenId);
      }

      await addHistorialEvent(ordenId, 'item_modificado', 'Item modificado', {
        item_id: itemId,
      });

      return true;
    } catch (err) {
      console.error('Error updating item:', err);
      setError(err instanceof Error ? err.message : 'Error al actualizar item');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const deleteItem = async (itemId: string, ordenId: string): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);

      const { data: item } = await supabase
        .from('ordenes_trabajo_items')
        .select('precio_total')
        .eq('id', itemId)
        .single();

      const { error: deleteError } = await supabase
        .from('ordenes_trabajo_items')
        .delete()
        .eq('id', itemId);

      if (deleteError) throw deleteError;

      if (item) {
        const { data: orden } = await supabase
          .from('ordenes_trabajo')
          .select('subtotal')
          .eq('id', ordenId)
          .single();

        const nuevoSubtotal = Math.max(0, (orden?.subtotal || 0) - item.precio_total);

        await supabase
          .from('ordenes_trabajo')
          .update({ subtotal: nuevoSubtotal, total: nuevoSubtotal })
          .eq('id', ordenId);
      }

      await addHistorialEvent(ordenId, 'item_eliminado', 'Item eliminado de la orden', {
        item_id: itemId,
      });

      return true;
    } catch (err) {
      console.error('Error deleting item:', err);
      setError(err instanceof Error ? err.message : 'Error al eliminar item');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const addPago = async (ordenId: string, pagoData: AddPagoData): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);

      const { error: pagoError } = await supabase.from('ordenes_trabajo_pagos').insert([
        {
          orden_id: ordenId,
          ...pagoData,
          created_by: profile?.id || null,
        },
      ]);

      if (pagoError) throw pagoError;

      await addHistorialEvent(ordenId, 'pago_registrado', `Pago registrado: $${pagoData.monto}`, {
        monto: pagoData.monto,
        metodo_pago: pagoData.metodo_pago,
      });

      return true;
    } catch (err) {
      console.error('Error adding pago:', err);
      setError(err instanceof Error ? err.message : 'Error al registrar pago');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const deletePago = async (pagoId: string, ordenId: string): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);

      const { error: deleteError } = await supabase
        .from('ordenes_trabajo_pagos')
        .delete()
        .eq('id', pagoId);

      if (deleteError) throw deleteError;

      await addHistorialEvent(ordenId, 'modificacion', 'Pago eliminado');

      return true;
    } catch (err) {
      console.error('Error deleting pago:', err);
      setError(err instanceof Error ? err.message : 'Error al eliminar pago');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const changeEstado = async (
    id: string,
    nuevoEstado: EstadoOrdenTrabajo
  ): Promise<boolean> => {
    return updateOrden(id, { estado: nuevoEstado });
  };

  const createOrdenConItems = async (data: CreateOrdenConItemsData): Promise<OrdenTrabajoFull | null> => {
    if (!profile?.company_id || !profile?.id) {
      setError('No hay empresa o usuario asociado');
      return null;
    }

    try {
      setLoading(true);
      setError(null);

      // 1. Crear la orden
      const estadoFinal = data.estadoInicial || 'borrador';
      const { data: newOrden, error: ordenError } = await supabase
        .from('ordenes_trabajo')
        .insert([
          {
            company_id: profile.company_id,
            cliente_id: data.ordenData.cliente_id,
            vendedor_id: profile.id, // Por ahora es igual a created_by, reservado para futura funcionalidad
            canal_venta: data.ordenData.canal_venta,
            estado: estadoFinal,
            fecha_creacion: new Date().toISOString(),
            fecha_estimada_entrega: data.ordenData.fecha_estimada_entrega || null,
            notas_internas: data.ordenData.notas_internas || null,
            subtotal: 0,
            total_descuentos: 0,
            total: 0,
            created_by: profile.id,
            numero_orden: '',
          },
        ])
        .select()
        .single();

      if (ordenError) throw ordenError;

      // 2. Insertar items
      if (data.items.length > 0) {
        const itemsToInsert = data.items.map(item => ({
          orden_id: newOrden.id,
          ...item,
        }));

        const { data: insertedItems, error: itemsError } = await supabase
          .from('ordenes_trabajo_items')
          .insert(itemsToInsert)
          .select();

        if (itemsError) throw itemsError;

        // 3. Generar rutas de producción para cada item
        for (const item of insertedItems) {
          try {
            // Obtener categoría de la configuración del item
            const categoria = item.configuracion?.categoria || 'Impresion Laser';

            const { data: rutaCount, error: rutaError } = await supabase.rpc('fn_generar_ruta_produccion_item', {
              p_orden_item_id: item.id,
              p_producto_id: item.producto_id,
              p_categoria: categoria,
              p_configuracion: item.configuracion || {},
              p_company_id: profile.company_id,
            });

            if (rutaError) {
              console.error(`Error generando ruta para item ${item.id}:`, rutaError);
            } else {
              console.log(`✓ Ruta generada para item ${item.id}: ${rutaCount || 0} pasos creados`);
            }
          } catch (rutaError) {
            console.error(`Error generando ruta para item ${item.id}:`, rutaError);
            // No lanzar error, continuar con los demás items
          }
        }

        // 4. Actualizar totales
        const subtotal = data.items.reduce((sum, item) => sum + item.precio_total, 0);
        await supabase
          .from('ordenes_trabajo')
          .update({ subtotal, total: subtotal })
          .eq('id', newOrden.id);
      }

      // 5. Agregar evento al historial
      await addHistorialEvent(
        newOrden.id,
        'creacion',
        `Orden de trabajo creada por ${profile.full_name} con ${data.items.length} items`
      );

      // 6. Retornar orden completa
      return await getOrdenById(newOrden.id);
    } catch (err) {
      console.error('Error creating orden con items:', err);
      setError(err instanceof Error ? err.message : 'Error al crear orden');
      return null;
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    error,
    getOrdenById,
    createOrden,
    createOrdenConItems,
    updateOrden,
    deleteOrden,
    addItem,
    updateItem,
    deleteItem,
    addPago,
    deletePago,
    changeEstado,
  };
}
