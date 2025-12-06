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
  CentroCopiadoOrdenResumida,
  CentroCopiadoOrdenItem,
  EstadoOrdenCopiado,
} from '../types/database';

export interface OrdenTrabajoServicio {
  id: string;
  orden_id: string;
  servicio_id: string | null;
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
  created_at: string;
}

export interface OrdenTrabajoFull extends OrdenTrabajo {
  items?: OrdenTrabajoItemFull[];
  servicios?: OrdenTrabajoServicio[];
  pagos?: OrdenTrabajoPago[];
  historial?: OrdenTrabajoHistorial[];
  ordenCopiado?: CentroCopiadoOrdenResumida | null;
  facturaStoragePath?: string | null;
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
  // Campos de totales
  subtotal?: number;
  total_descuentos?: number;
  total?: number;
  // Campos de facturación
  requiere_factura?: boolean;
  subtotal_iva?: number;
  // Campos de envío
  requiere_despacho?: boolean;
}

interface UpdateOrdenData {
  cliente_id?: string;
  canal_venta?: CanalVenta;
  estado?: EstadoOrdenTrabajo;
  fecha_estimada_entrega?: string | null;
  notas_internas?: string | null;
  requiere_factura?: boolean;
  requiere_despacho?: boolean;
}

interface AddItemData {
  tipo_item?: 'catalogo' | 'personalizado';
  producto_id?: string | null;
  producto_nombre: string;
  producto_categoria?: string | null;
  descripcion?: string | null;
  tiempo_produccion_dias?: number | null;
  cantidad: number;
  configuracion?: ItemConfiguracion | null;
  precio_base: number;
  precio_servicios: number;
  precio_acabados: number;
  precio_unitario_final: number;
  precio_total: number;
  rutas_generadas?: any[];
}

interface AddServicioData {
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
  servicio_id?: string | null;
}

interface CreateOrdenConItemsData {
  ordenData: CreateOrdenData;
  items: AddItemData[];
  servicios?: AddServicioData[];
  estadoInicial?: EstadoOrdenTrabajo;
}

interface AddPagoData {
  fecha_pago: string;
  monto: number;
  medio_cobro_id?: string;
  metodo_pago?: string;
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

      const [itemsRes, serviciosRes, pagosRes, historialRes, ordenCopiadoRes, facturaRes] = await Promise.all([
        supabase
          .from('ordenes_trabajo_items')
          .select('*')
          .eq('orden_id', id)
          .order('created_at', { ascending: true }),
        supabase
          .from('ordenes_trabajo_servicios' as any)
          .select('*')
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
        supabase
          .from('centro_copiado_ordenes')
          .select('id, numero_orden, estado, total')
          .eq('orden_trabajo_id', id)
          .maybeSingle(),
        // Obtener la factura activa (última creación o reemplazo)
        supabase
          .from('facturas_historial')
          .select('factura_storage_path, numero_factura, monto_total, created_at')
          .eq('orden_id', id)
          .in('tipo_operacion', ['creacion', 'reemplazo'])
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      if (itemsRes.error) throw itemsRes.error;
      if (serviciosRes.error) throw serviciosRes.error;
      if (pagosRes.error) throw pagosRes.error;
      if (historialRes.error) throw historialRes.error;
      if (ordenCopiadoRes.error) throw ordenCopiadoRes.error;
      if (facturaRes.error) throw facturaRes.error;

      // Si hay orden de copiado, cargar sus items con sus relaciones
      let ordenCopiadoCompleta: CentroCopiadoOrdenResumida | null = null;
      if (ordenCopiadoRes.data) {
        const { data: itemsOC, error: itemsOCError } = await supabase
          .from('centro_copiado_ordenes_items')
          .select(`
            *,
            tamanio_papel:centro_copiado_tamanios_papel(id, nombre),
            papel:centro_copiado_papeles(
              id,
              variante_nombre,
              material:materiales(nombre)
            )
          `)
          .eq('orden_copiado_id', ordenCopiadoRes.data.id);

        if (itemsOCError) throw itemsOCError;

        ordenCopiadoCompleta = {
          ...ordenCopiadoRes.data,
          items: itemsOC as CentroCopiadoOrdenItem[],
        };
      }

      // Obtener rutas de produccion de los items
      const { data: rutasRes, error: rutasError } = await supabase
        .from('ordenes_trabajo_items_rutas')
        .select('*')
        .in('orden_item_id', itemsRes.data?.map(i => i.id) || [])
        .order('orden', { ascending: true });

      if (rutasError) throw rutasError;

      // Mapear items con sus rutas
      const itemsConRutas = itemsRes.data?.map(item => ({
        ...item,
        rutas: rutasRes?.filter(r => r.orden_item_id === item.id) || []
      })) || [];

      return {
        ...orden,
        items: itemsConRutas as OrdenTrabajoItemFull[],
        servicios: serviciosRes.data,
        pagos: pagosRes.data,
        historial: historialRes.data,
        ordenCopiado: ordenCopiadoCompleta,
        facturaStoragePath: facturaRes.data?.factura_storage_path || null,
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

      const metodoDescripcion = pagoData.medio_cobro_id ? 'Medio de cobro' : pagoData.metodo_pago;
      await addHistorialEvent(ordenId, 'pago_registrado', `Pago registrado: $${pagoData.monto} - ${metodoDescripcion}`, {
        monto: pagoData.monto,
        medio_cobro_id: pagoData.medio_cobro_id,
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

  const updatePago = async (pagoId: string, ordenId: string, pagoData: Partial<AddPagoData>): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);

      const { error: updateError } = await supabase
        .from('ordenes_trabajo_pagos')
        .update(pagoData)
        .eq('id', pagoId);

      if (updateError) throw updateError;

      await addHistorialEvent(ordenId, 'modificacion', 'Pago actualizado');

      return true;
    } catch (err) {
      console.error('Error updating pago:', err);
      setError(err instanceof Error ? err.message : 'Error al actualizar pago');
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

  // Nueva función para actualizar orden completa (header + items + servicios)
  const updateOrdenCompleta = async (id: string, data: CreateOrdenConItemsData): Promise<OrdenTrabajoFull | null> => {
    if (!profile?.company_id || !profile?.id) {
      setError('No hay empresa o usuario asociado');
      return null;
    }

    try {
      setLoading(true);
      setError(null);

      // 1. Actualizar Header de la Orden
      const updateData: any = {
        cliente_id: data.ordenData.cliente_id,
        canal_venta: data.ordenData.canal_venta,
        fecha_estimada_entrega: data.ordenData.fecha_estimada_entrega || null,
        notas_internas: data.ordenData.notas_internas || null,
        subtotal: data.ordenData.subtotal || 0,
        total_descuentos: data.ordenData.total_descuentos || 0,
        total: data.ordenData.total || 0,
        requiere_factura: data.ordenData.requiere_factura || false,
        subtotal_iva: data.ordenData.subtotal_iva || 0,
        requiere_despacho: data.ordenData.requiere_despacho || false, // Nuevo campo
        direccion_despacho: data.ordenData.direccion_despacho || null, // Nuevo campo
        comuna_despacho: data.ordenData.comuna_despacho || null, // Nuevo campo
        region_despacho: data.ordenData.region_despacho || null, // Nuevo campo
        costo_despacho: data.ordenData.costo_despacho || 0, // Nuevo campo
        updated_at: new Date().toISOString(),
        updated_by: profile.id
      };

      const { error: ordenError } = await supabase
        .from('ordenes_trabajo')
        .update(updateData)
        .eq('id', id)
        .eq('company_id', profile.company_id);

      if (ordenError) throw ordenError;

      // 2. Gestionar Servicios Adicionales (Estrategia: Borrar y Recrear)
      // Primero borramos todos los servicios existentes
      const { error: deleteServicesError } = await supabase
        .from('ordenes_trabajo_servicios' as any)
        .delete()
        .eq('orden_id', id);

      if (deleteServicesError) throw deleteServicesError;

      // Luego insertamos los nuevos si existen
      if (data.servicios && data.servicios.length > 0) {
        const serviciosToInsert = data.servicios.map(s => ({
          orden_id: id,
          descripcion: s.descripcion,
          cantidad: s.cantidad,
          precio_unitario: s.precio_unitario,
          subtotal: s.subtotal,
          servicio_id: s.servicio_id || null,
          created_by: profile.id
        }));

        const { error: insertServError } = await supabase
          .from('ordenes_trabajo_servicios' as any)
          .insert(serviciosToInsert);

        if (insertServError) throw insertServError;
      }

      // 3. Gestionar Items (Estrategia: Diffing Inteligente)
      // Primero obtenemos los items actuales para comparar
      const { data: currentItems, error: fetchItemsError } = await supabase
        .from('ordenes_trabajo_items')
        .select('id')
        .eq('orden_id', id);

      if (fetchItemsError) throw fetchItemsError;

      const currentItemIds = new Set(currentItems?.map(i => i.id) || []);
      const incomingItemsWithId = data.items.filter((i: any) => i.id && !i.id.startsWith('temp-'));
      const incomingItemIds = new Set(incomingItemsWithId.map((i: any) => i.id));

      // 3.1 Identificar items a borrar (están en DB pero no en payload)
      const itemsToDelete = Array.from(currentItemIds).filter(id => !incomingItemIds.has(id));

      if (itemsToDelete.length > 0) {
        const { error: deleteError } = await supabase
          .from('ordenes_trabajo_items')
          .delete()
          .in('id', itemsToDelete);

        if (deleteError) throw deleteError;
      }

      // 3.2 Identificar items a actualizar (tienen ID y están en el payload)
      for (const item of incomingItemsWithId) {
        const { error: updateItemError } = await supabase
          .from('ordenes_trabajo_items')
          .update({
            tipo_item: item.tipo_item || 'catalogo',
            producto_nombre: item.producto_nombre,
            producto_categoria: item.producto_categoria || null,
            descripcion: item.descripcion || null,
            tiempo_produccion_dias: item.tiempo_produccion_dias || null,
            cantidad: item.cantidad,
            configuracion: item.configuracion || null,
            precio_base: item.precio_base,
            precio_servicios: item.precio_servicios,
            precio_acabados: item.precio_acabados,
            precio_unitario_final: item.precio_unitario_final,
            precio_total: item.precio_total,
          })
          .eq('id', item.id); // Este es un ID real de DB

        if (updateItemError) throw updateItemError;

        // NOTA: No actualizamos rutas de producción en items existentes por seguridad.
        // Si el usuario quisiera reiniciar la producción, debería borrar e insertar de nuevo.

        // MEJORA: Si el item NO tiene pasos iniciados, permitimos regenerar la ruta
        // Esto permite corregir errores de configuración antes de que inicie la producción
        if (item.rutas_generadas && item.rutas_generadas.length > 0) {
          // Verificar si hay pasos iniciados
          const { count: pasosIniciados } = await supabase
            .from('ordenes_trabajo_items_rutas')
            .select('*', { count: 'exact', head: true })
            .eq('orden_item_id', item.id)
            .neq('estado', 'pendiente');

          // Si no hay pasos iniciados (todo está pendiente), regeneramos la ruta
          if (pasosIniciados === 0) {
            // Borrar rutas anteriores
            await supabase
              .from('ordenes_trabajo_items_rutas')
              .delete()
              .eq('orden_item_id', item.id);

            // Insertar nuevas rutas
            const rutasToInsert = item.rutas_generadas.map((ruta: any) => ({
              company_id: profile.company_id,
              orden_item_id: item.id,
              tipo_etapa: ruta.tipo_etapa || 'principal',
              paso_id: ruta.paso_id,
              paso_nombre: ruta.paso_nombre,
              orden: ruta.orden,
              es_modificado: false,
              origen_plantilla_id: ruta.origen_plantilla_id || null,
              comentario_vendedor: ruta.comentario_vendedor || null,
              global_task_id: ruta.global_task_id || null,
              estado: 'pendiente' // Asegurar estado inicial
            }));

            const { error: insertRutasError } = await supabase
              .from('ordenes_trabajo_items_rutas')
              .insert(rutasToInsert);

            if (insertRutasError) throw insertRutasError;
          }
        }
      }

      // 3.3 Insertar items NUEVOS (no tienen ID o tienen 'temp-')
      const newItems = data.items.filter((i: any) => !i.id || i.id.startsWith('temp-'));
      const itemsToInsert = newItems.map(item => {
        let finalProductId = item.producto_id;
        if (typeof finalProductId === 'string' && finalProductId.trim() === '') {
          finalProductId = null;
        }

        return {
          orden_id: id,
          tipo_item: item.tipo_item || 'catalogo',
          producto_id: finalProductId,
          producto_nombre: item.producto_nombre,
          producto_categoria: item.producto_categoria || null,
          descripcion: item.descripcion || null,
          tiempo_produccion_dias: item.tiempo_produccion_dias || null,
          cantidad: item.cantidad,
          configuracion: item.configuracion || null,
          precio_base: item.precio_base,
          precio_servicios: item.precio_servicios,
          precio_acabados: item.precio_acabados,
          precio_unitario_final: item.precio_unitario_final,
          precio_total: item.precio_total,
        };
      });

      if (itemsToInsert.length > 0) {
        const { data: insertedItems, error: insertItemsError } = await supabase
          .from('ordenes_trabajo_items')
          .insert(itemsToInsert)
          .select();

        if (insertItemsError) throw insertItemsError;

        // Insertar rutas para los NUEVOS items
        for (let i = 0; i < insertedItems.length; i++) {
          const itemDb = insertedItems[i];
          const itemOriginal = newItems[i]; // Coinciden en índice

          if (itemOriginal.rutas_generadas && itemOriginal.rutas_generadas.length > 0) {
            const rutasToInsert = itemOriginal.rutas_generadas.map((ruta: any) => ({
              company_id: profile.company_id,
              orden_item_id: itemDb.id,
              tipo_etapa: ruta.tipo_etapa || 'principal',
              paso_id: ruta.paso_id,
              paso_nombre: ruta.paso_nombre,
              orden: ruta.orden,
              es_modificado: false,
              origen_plantilla_id: ruta.origen_plantilla_id || null,
              comentario_vendedor: ruta.comentario_vendedor || null,
              global_task_id: ruta.global_task_id || null,
            }));

            await supabase
              .from('ordenes_trabajo_items_rutas')
              .insert(rutasToInsert);
          }
        }
      }

      // 4. Recalcular totales consolidado
      await supabase.rpc('fn_recalcular_total_orden_trabajo', { p_orden_trabajo_id: id });

      // 5. Historial
      await addHistorialEvent(
        id,
        'modificacion',
        `Orden actualizada por ${profile.full_name}`
      );

      return await getOrdenById(id);

    } catch (err) {
      console.error('Error updating full orden:', err);
      setError(err instanceof Error ? err.message : 'Error al actualizar orden completa');
      return null;
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
      const estadoFinal = data.estadoInicial || 'pendiente';
      const { data: newOrden, error: ordenError } = await supabase
        .from('ordenes_trabajo')
        .insert([
          {
            company_id: profile.company_id,
            cliente_id: data.ordenData.cliente_id,
            vendedor_id: profile.id, // Por ahora el vendedor es quien crea
            canal_venta: data.ordenData.canal_venta,
            estado: 'pendiente',
            fecha_creacion: new Date().toISOString(),
            fecha_estimada_entrega: data.ordenData.fecha_estimada_entrega || null,
            notas_internas: data.ordenData.notas_internas || null,
            subtotal: data.ordenData.subtotal || 0,
            total_descuentos: data.ordenData.total_descuentos || 0,
            total: data.ordenData.total || 0,
            requiere_factura: data.ordenData.requiere_factura || false,
            subtotal_iva: data.ordenData.subtotal_iva || 0,
            facturada: false,
            created_by: profile.id,
            numero_orden: '',
            requiere_despacho: data.ordenData.requiere_despacho || false,
            estado_envio: 'pendiente',
            updated_at: new Date().toISOString(),
            updated_by: profile.id,
          },
        ])
        .select()
        .single();
      if (ordenError) throw ordenError;

      // 2. Insertar items
      if (data.items.length > 0) {
        const itemsToInsert = data.items.map(item => {
          // Limpieza básica: strings vacías a null
          let finalProductId = item.producto_id;
          if (typeof finalProductId === 'string' && finalProductId.trim() === '') {
            finalProductId = null;
          }

          return {
            orden_id: newOrden.id,
            tipo_item: item.tipo_item || 'catalogo',
            producto_id: finalProductId,
            producto_nombre: item.producto_nombre,
            producto_categoria: item.producto_categoria || null,
            descripcion: item.descripcion || null,
            tiempo_produccion_dias: item.tiempo_produccion_dias || null,
            cantidad: item.cantidad,
            configuracion: item.configuracion || null,
            precio_base: item.precio_base,
            precio_servicios: item.precio_servicios,
            precio_acabados: item.precio_acabados,
            precio_unitario_final: item.precio_unitario_final,
            precio_total: item.precio_total,
          };
        });

        const { data: insertedItems, error: itemsError } = await supabase
          .from('ordenes_trabajo_items')
          .insert(itemsToInsert)
          .select();

        if (itemsError) throw itemsError;

        // 3. Insertar rutas pregeneradas para cada item
        for (let i = 0; i < insertedItems.length; i++) {
          const item = insertedItems[i];
          const itemOriginal = data.items[i];

          // Si el item tiene rutas pregeneradas, insertarlas
          if (itemOriginal.rutas_generadas && itemOriginal.rutas_generadas.length > 0) {
            try {
              const rutasToInsert = itemOriginal.rutas_generadas.map((ruta: any) => {
                console.log('🔍 Ruta a insertar:', {
                  tipo_etapa: ruta.etapa,
                  paso_nombre: ruta.paso_nombre,
                  orden: ruta.orden
                });

                return {
                  company_id: profile.company_id,
                  orden_item_id: item.id,
                  tipo_etapa: ruta.tipo_etapa || 'principal', // Corregido: Usar el valor técnico, no el display
                  paso_id: ruta.paso_id,
                  paso_nombre: ruta.paso_nombre,
                  orden: ruta.orden,
                  es_modificado: false,
                  origen_plantilla_id: ruta.origen_plantilla_id || null,
                  comentario_vendedor: ruta.comentario_vendedor || null,
                  global_task_id: ruta.global_task_id || null,
                };
              });

              const { error: rutasError } = await supabase
                .from('ordenes_trabajo_items_rutas')
                .insert(rutasToInsert);

              if (rutasError) {
                console.error(`❌ Error insertando rutas para item ${item.id}:`, rutasError);
              } else {
                console.log(`✅ ${rutasToInsert.length} rutas insertadas para item ${item.id}`);

                // Verificación inmediata: consultar las rutas recién insertadas
                const { data: verificacion, error: verError } = await supabase
                  .from('ordenes_trabajo_items_rutas')
                  .select('id, tipo_etapa, paso_nombre, orden')
                  .eq('orden_item_id', item.id);

                if (verError) {
                  console.error('❌ Error verificando rutas insertadas:', verError);
                } else {
                  console.log(`🔍 Verificación inmediata: ${verificacion?.length || 0} rutas encontradas para item ${item.id}`);
                  if (verificacion && verificacion.length > 0) {
                    console.table(verificacion);
                  } else {
                    console.warn('⚠️ PROBLEMA: No se encontraron rutas inmediatamente después de insertar!');
                  }
                }
              }
            } catch (rutaError) {
              console.error(`Error insertando rutas para item ${item.id}:`, rutaError);
              // No lanzar error, continuar con los demás items
            }
          } else {
            console.warn(`⚠ Item ${item.id} no tiene rutas pregeneradas`);
          }
        }

        // 3.5. Insertar servicios adicionales (si existen)
        let totalServicios = 0;
        if (data.servicios && data.servicios.length > 0) {
          const serviciosToInsert = data.servicios.map(s => ({
            orden_id: newOrden.id,
            descripcion: s.descripcion,
            cantidad: s.cantidad,
            precio_unitario: s.precio_unitario,
            subtotal: s.subtotal,
            servicio_id: s.servicio_id || null,
            created_by: profile.id
          }));

          const { error: servError } = await supabase
            .from('ordenes_trabajo_servicios' as any)
            .insert(serviciosToInsert);

          if (servError) {
            console.error('Error insertando servicios:', servError);
            throw servError;
          }

          totalServicios = data.servicios.reduce((sum, s) => sum + s.subtotal, 0);
        }

        // 4. Actualizar totales recalculando items + servicios
        // Nota: Asumimos que 'subtotal' en DB es solo de items físicos, y 'total' es la suma final
        const subtotalItems = data.items.reduce((sum, item) => sum + item.precio_total, 0);
        const subtotalFinal = subtotalItems; // Mantenemos subtotal como solo items físicos para consistencia con fn SQL

        const totalDescuentos = newOrden.total_descuentos || 0;
        const subtotalIva = newOrden.subtotal_iva || 0;

        // Total = Items + Servicios - Descuentos + IVA
        const total = subtotalItems + totalServicios - totalDescuentos + subtotalIva;

        await supabase
          .from('ordenes_trabajo')
          .update({ subtotal: subtotalFinal, total })
          .eq('id', newOrden.id);
      }

      // 5. Agregar evento al historial
      const itemsCount = data.items.length;
      const serviciosCount = data.servicios?.length || 0;
      const descEvento = `Orden de trabajo creada por ${profile.full_name} con ${itemsCount} items${serviciosCount > 0 ? ` y ${serviciosCount} servicios` : ''}`;

      await addHistorialEvent(
        newOrden.id,
        'creacion',
        descEvento
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

  const desvincularOrdenCopiado = async (ordenTrabajoId: string): Promise<boolean> => {
    if (!profile?.company_id) {
      setError('No hay empresa asociada');
      return false;
    }

    try {
      setLoading(true);
      setError(null);

      // Desvincular la orden de copiado (setear orden_trabajo_id a null)
      const { error: updateError } = await supabase
        .from('centro_copiado_ordenes')
        .update({ orden_trabajo_id: null })
        .eq('orden_trabajo_id', ordenTrabajoId)
        .eq('company_id', profile.company_id);

      if (updateError) throw updateError;

      // Registrar en historial
      await addHistorialEvent(
        ordenTrabajoId,
        'nota_agregada',
        'Orden de copiado desvinculada de esta orden de trabajo'
      );

      return true;
    } catch (err) {
      console.error('Error desvinculando orden de copiado:', err);
      setError(err instanceof Error ? err.message : 'Error al desvincular orden de copiado');
      return false;
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
    updatePago,
    deletePago,
    changeEstado,
    desvincularOrdenCopiado,
    updateOrdenCompleta,
  };
}
