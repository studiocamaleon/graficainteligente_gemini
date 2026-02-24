import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import type {
  OrdenTrabajo,
  OrdenTrabajoItem,
  OrdenTrabajoNota,
  OrdenTrabajoPago,
  OrdenTrabajoHistorial,
  CanalVenta,
  EstadoOrdenTrabajo,
  ItemConfiguracion,
  TipoEventoHistorial,
  CentroCopiadoOrdenResumida,
  CentroCopiadoOrdenItem,
} from '../types/database';
import { formatDateForInput, getArgentinaDateString } from '../utils/dates';
import { generateProductionRoutes, normalizarEtapa } from '../utils/generateProductionRoutes';
import { distribuirPagosProporcional, validarDesvinculacion } from '../utils/ordenesConsolidadas';
import { sendWatiMessage } from '../lib/wati';
import { isWorkshopOperatorRole } from '../utils/roles';

export interface OrdenTrabajoServicio {
  id: string;
  orden_id: string;
  servicio_id: string | null;
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
  created_at: string;
  metadata?: any;
}

export interface OrdenTrabajoFull extends OrdenTrabajo {
  items?: OrdenTrabajoItemFull[];
  servicios?: OrdenTrabajoServicio[];
  pagos?: Array<OrdenTrabajoPago & { author_name?: string | null; author_email?: string | null }>;
  historial?: OrdenTrabajoHistorial[];
  notas?: Array<OrdenTrabajoNota & { author_name?: string | null; author_email?: string | null }>;
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
  categoria_id?: string | null;
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
  created_by?: string | null;
}

interface UpdateOrdenData {
  cliente_id?: string;
  canal_venta?: CanalVenta;
  estado?: EstadoOrdenTrabajo;
  fecha_estimada_entrega?: string | null;
  notas_internas?: string | null;
  requiere_factura?: boolean;
  requiere_despacho?: boolean;
  total?: number;
  subtotal_iva?: number;
  created_by?: string | null;
}

interface AddItemData {
  tipo_item?: 'catalogo' | 'personalizado';
  producto_id?: string | null;
  producto_nombre: string;
  producto_categoria?: string | null;
  categoria_id?: string | null;
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
  metadata?: any;
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
  cheque_data?: {
    numero_cheque: string;
    fecha_pago: string;
    banco: string;
    titular?: string;
    tipo?: 'fisico' | 'echeq';
  };
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

  const insertOrderNote = async (ordenId: string, noteText: string): Promise<boolean> => {
    if (!profile?.company_id || !profile?.id) return false;

    const trimmed = (noteText || '').trim();
    if (!trimmed) return false;

    const { error: noteError } = await supabase
      .from('ordenes_trabajo_notas')
      .insert([
        {
          orden_id: ordenId,
          company_id: profile.company_id,
          nota: trimmed,
          created_by: profile.id,
        },
      ]);

    if (noteError) {
      console.error('Error inserting order note:', noteError);
      return false;
    }

    return true;
  };

  const normalizeDateOnly = (dateValue?: string | null): string | undefined => {
    if (!dateValue) return undefined;
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) return dateValue;
    return formatDateForInput(dateValue);
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

      const [itemsRes, serviciosRes, pagosRes, historialRes, notasRes, ordenCopiadoRes, facturaRes] = await Promise.all([
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
          .from('ordenes_trabajo_notas')
          .select('id, orden_id, company_id, nota, created_by, created_at')
          .eq('orden_id', id)
          .order('created_at', { ascending: false }),
        supabase
          .from('centro_copiado_ordenes')
          .select('id, numero_orden, estado, total, requiere_factura')
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
      if (notasRes.error) {
        console.error('Error fetching order notes:', notasRes.error);
      }
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

      const notasData = notasRes.data || [];
      const pagosData = pagosRes.data || [];
      const noteAuthorIds = Array.from(
        new Set(
          notasData
            .map((n: any) => n.created_by)
            .filter((value: unknown): value is string => typeof value === 'string' && value.length > 0)
        )
      );
      const paymentAuthorIds = Array.from(
        new Set(
          pagosData
            .map((p: any) => p.created_by)
            .filter((value: unknown): value is string => typeof value === 'string' && value.length > 0)
        )
      );

      const authorById = new Map<string, { full_name: string | null; email: string | null }>();
      const allAuthorIds = Array.from(new Set([...noteAuthorIds, ...paymentAuthorIds]));
      if (allAuthorIds.length > 0) {
        const { data: noteAuthors, error: noteAuthorsError } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', allAuthorIds);

        if (noteAuthorsError) {
          console.error('Error fetching note authors:', noteAuthorsError);
        } else {
          (noteAuthors || []).forEach((author: any) => {
            authorById.set(author.id, {
              full_name: author.full_name || null,
              email: author.email || null,
            });
          });
        }
      }

      const notasMapeadas = notasData.map((n: any) => ({
        id: n.id,
        orden_id: n.orden_id,
        company_id: n.company_id,
        nota: n.nota,
        created_by: n.created_by,
        created_at: n.created_at,
        author_name: n.created_by ? authorById.get(n.created_by)?.full_name || null : null,
        author_email: n.created_by ? authorById.get(n.created_by)?.email || null : null,
      }));
      const pagosMapeados = pagosData.map((p: any) => ({
        ...p,
        author_name: p.created_by ? authorById.get(p.created_by)?.full_name || null : null,
        author_email: p.created_by ? authorById.get(p.created_by)?.email || null : null,
      }));

      // Mapear items con sus rutas
      const itemsConRutas = itemsRes.data?.map(item => ({
        ...item,
        rutas: rutasRes?.filter(r => r.orden_item_id === item.id) || []
      })) || [];

      return {
        ...orden,
        items: itemsConRutas as OrdenTrabajoItemFull[],
        servicios: serviciosRes.data,
        pagos: pagosMapeados,
        historial: historialRes.data,
        notas: notasMapeadas,
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

      const initialNote = (data.notas_internas || '').trim();
      if (initialNote) {
        const noteOk = await insertOrderNote(newOrden.id, initialNote);
        if (noteOk) {
          await addHistorialEvent(newOrden.id, 'nota_agregada', `Nota agregada por ${profile.full_name}`, {
            nota: initialNote,
          });
        }
      }

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

      let estadoAnterior: EstadoOrdenTrabajo | null = null;
      if (data.estado) {
        const { data: ordenActual, error: estadoFetchError } = await supabase
          .from('ordenes_trabajo')
          .select('estado')
          .eq('id', id)
          .eq('company_id', profile.company_id)
          .single();

        if (estadoFetchError) throw estadoFetchError;
        estadoAnterior = (ordenActual?.estado as EstadoOrdenTrabajo) || null;
      }

      const updateData: any = {
        updated_by: profile.id,
      };

      if (data.cliente_id) updateData.cliente_id = data.cliente_id;
      if (data.canal_venta) updateData.canal_venta = data.canal_venta;
      if (data.estado) updateData.estado = data.estado;
      if (data.fecha_estimada_entrega !== undefined)
        updateData.fecha_estimada_entrega = data.fecha_estimada_entrega;
      if (data.notas_internas !== undefined) updateData.notas_internas = data.notas_internas;
      if (data.requiere_factura !== undefined) updateData.requiere_factura = data.requiere_factura;
      if (data.total !== undefined) updateData.total = data.total;
      if (data.subtotal_iva !== undefined) updateData.subtotal_iva = data.subtotal_iva;
      if (data.created_by !== undefined) updateData.created_by = data.created_by;

      const { error: updateError } = await supabase
        .from('ordenes_trabajo')
        .update(updateData)
        .eq('id', id)
        .eq('company_id', profile.company_id);

      if (updateError) throw updateError;

      if (data.estado) {
        await addHistorialEvent(
          id,
          'cambio_estado',
          `Estado cambiado${estadoAnterior ? ` de ${estadoAnterior}` : ''} a: ${data.estado}`,
          {
            estado_anterior: estadoAnterior,
            estado_nuevo: data.estado,
          }
        );
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

  const addNota = async (ordenId: string, nota: string): Promise<boolean> => {
    if (!profile?.company_id || !profile?.id) {
      setError('No hay empresa o usuario asociado');
      return false;
    }

    const trimmed = (nota || '').trim();
    if (!trimmed) {
      setError('La nota no puede estar vacía');
      return false;
    }

    try {
      setLoading(true);
      setError(null);

      const noteOk = await insertOrderNote(ordenId, trimmed);
      if (!noteOk) {
        throw new Error('No se pudo guardar la nota');
      }

      const { error: syncError } = await supabase
        .from('ordenes_trabajo')
        .update({
          notas_internas: trimmed,
          updated_by: profile.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', ordenId)
        .eq('company_id', profile.company_id);

      if (syncError) throw syncError;

      await addHistorialEvent(ordenId, 'nota_agregada', `Nota agregada por ${profile.full_name}`, {
        nota: trimmed,
      });

      return true;
    } catch (err) {
      console.error('Error adding note:', err);
      setError(err instanceof Error ? err.message : 'Error al agregar nota');
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
    if (isWorkshopOperatorRole(profile?.role)) {
      setError('El rol Operador de taller no puede registrar pagos.');
      return false;
    }

    try {
      setLoading(true);
      setError(null);

      // Handle Cheque Creation if present
      let chequeId = null;
      const fechaPagoNormalizada = normalizeDateOnly(pagoData.fecha_pago);
      const fechaChequeNormalizada = normalizeDateOnly(pagoData.cheque_data?.fecha_pago);

      if (pagoData.cheque_data && pagoData.medio_cobro_id) {
        const { data: newCheck, error: checkError } = await supabase
          .from('cheques_cartera')
          .insert([{
            company_id: profile?.company_id,
            tipo: pagoData.cheque_data.tipo || 'fisico', // Use provided type or default
            direction: 'recibido',
            estado: 'pendiente',
            numero_cheque: pagoData.cheque_data.numero_cheque,
            banco: pagoData.cheque_data.banco,
            fecha_emision: getArgentinaDateString(), // Use local date
            fecha_pago: fechaChequeNormalizada || pagoData.cheque_data.fecha_pago, // Maturity
            monto: pagoData.monto,
            destinatario: pagoData.cheque_data.titular || 'Nosotros',
            descripcion: `Pago Orden #${ordenId}`, // Ideally fetch Order Number but ID is fine for link
            created_by: profile?.id
          }])
          .select()
          .single();

        if (checkError) throw checkError;
        chequeId = newCheck.id;
      }

      // We remove cheque_data from the payload to ordenes_trabajo_pagos
      const dbPagoData: any = { ...pagoData };
      delete dbPagoData.cheque_data;
      if (fechaPagoNormalizada) {
        dbPagoData.fecha_pago = fechaPagoNormalizada;
      }

      // Ensure we insert valid fields (ordenes_trabajo_pagos doesn't have cheque_id field usually, but we could add it? 
      // For now, let's just create the cheque. Linking is implicit via description or we can add metadata in notes?
      // Actually, let's append cheque info to notes if possible or just rely on 'Cheque' method.

      const { data: insertedPago, error: pagoError } = await supabase
        .from('ordenes_trabajo_pagos')
        .insert([
        {
          orden_id: ordenId,
          ...dbPagoData,
          created_by: profile?.id || null,
        },
        ])
        .select('id')
        .single();

      if (pagoError) throw pagoError;

      const metodoDescripcion = pagoData.medio_cobro_id ? 'Medio de cobro' : pagoData.metodo_pago;
      await addHistorialEvent(ordenId, 'pago_registrado', `Pago registrado: $${pagoData.monto} - ${metodoDescripcion}`, {
        monto: pagoData.monto,
        medio_cobro_id: pagoData.medio_cobro_id,
        metodo_pago: pagoData.metodo_pago,
        cheque_id: chequeId
      });

      // Generar recibo PDF (JWT del usuario logueado).
      // Importante: no bloqueamos el registro del pago ni la respuesta al usuario.
      if (insertedPago?.id) {
        void (async () => {
          try {
            // El trigger crea el recibo; a veces puede tardar un instante en estar visible.
            let recibo: any = null;
            for (let i = 0; i < 5; i++) {
              const { data, error: reciboErr } = await supabase
                .from('recibos_pagos' as any)
                .select('id, token_corto')
                .eq('pago_ot_id', insertedPago.id)
                .maybeSingle();

              if (!reciboErr && data?.id && data?.token_corto) {
                recibo = data;
                break;
              }
              await new Promise((r) => setTimeout(r, 400));
            }

            if (!recibo?.id || !recibo?.token_corto) return;

            await supabase.functions.invoke('generate-recibo-pdf', {
              body: { recibo_id: recibo.id },
            });

            // Envío Wati (fallará hasta que la plantilla esté aprobada; lo dejamos listo).
            try {
              const { data: ordenInfo } = await supabase
                .from('ordenes_trabajo')
                .select('numero_orden, cliente:clients(whatsapp)')
                .eq('id', ordenId)
                .maybeSingle();

              const phone = (ordenInfo as any)?.cliente?.whatsapp as string | null;
              const numeroOrden = (ordenInfo as any)?.numero_orden as string | null;

              if (profile?.company_id && phone && numeroOrden) {
                const montoText = Number(pagoData.monto).toLocaleString('es-AR', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                });
                const path = `${profile.company_id}/recibos/${recibo.token_corto}`;

                await sendWatiMessage({
                  companyId: profile.company_id,
                  phone,
                  template_name: 'recibo_pago_v1',
                  parameters: [
                    { name: 'monto_pagado', value: montoText },
                    { name: 'numero_orden', value: numeroOrden },
                    { name: '1', value: path },
                  ],
                  metadata: {
                    tipo: 'recibo_pago',
                    orden_trabajo_id: ordenId,
                  },
                });
              }
            } catch (watiErr) {
              console.warn('[Wati] No se pudo enviar recibo por WhatsApp (probablemente plantilla no aprobada aún):', watiErr);
            }
          } catch (genErr) {
            console.warn('[Recibos] No se pudo generar PDF automáticamente:', genErr);
          }
        })();
      }

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

      const { data: pagoAnterior, error: pagoAnteriorError } = await supabase
        .from('ordenes_trabajo_pagos')
        .select('fecha_pago, monto, medio_cobro_id, metodo_pago, referencia_pago, comprobante_url, notas')
        .eq('id', pagoId)
        .single();

      if (pagoAnteriorError) throw pagoAnteriorError;

      const pagoDataNormalizado: Record<string, unknown> = { ...pagoData };
      delete pagoDataNormalizado.cheque_data;
      const fechaPagoNormalizada = normalizeDateOnly(pagoData.fecha_pago);
      if (fechaPagoNormalizada) {
        pagoDataNormalizado.fecha_pago = fechaPagoNormalizada;
      }

      const { error: updateError } = await supabase
        .from('ordenes_trabajo_pagos')
        .update(pagoDataNormalizado)
        .eq('id', pagoId);

      if (updateError) throw updateError;

      const camposActualizados = Object.keys(pagoDataNormalizado).filter(
        key => pagoDataNormalizado[key] !== undefined
      );

      await addHistorialEvent(ordenId, 'pago_editado', 'Pago actualizado', {
        pago_id: pagoId,
        campos_actualizados: camposActualizados,
        before: pagoAnterior,
        after: pagoDataNormalizado,
      });

      return true;
    } catch (err) {
      console.error('Error updating pago:', err);
      const anyErr: any = err;
      const code = anyErr?.code ? String(anyErr.code) : null;
      if (code === '42501') {
        setError('No tenés permisos para editar pagos con tu rol actual.');
      } else {
        setError(err instanceof Error ? err.message : 'Error al actualizar pago');
      }
      return false;
    } finally {
      setLoading(false);
    }
  };

  const deletePago = async (pagoId: string, ordenId: string): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);

      // Si el pago está aplicado a una liquidación, el FK es RESTRICT y no se puede borrar.
      try {
        const { data: liqPago, error: liqErr } = await supabase
          .from('liquidaciones_pagos')
          .select('liquidacion_id')
          .eq('pago_id', pagoId)
          .limit(1);
        if (!liqErr && (liqPago?.length ?? 0) > 0) {
          setError('No se puede eliminar este pago porque está aplicado a una liquidación. Quitalo de la liquidación primero.');
          return false;
        }
      } catch {
        // Ignorar; si falla el check, intentamos el delete igualmente.
      }

      const { data: pagoAEliminar, error: pagoAEliminarError } = await supabase
        .from('ordenes_trabajo_pagos')
        .select('fecha_pago, monto, medio_cobro_id, metodo_pago, referencia_pago, comprobante_url, notas')
        .eq('id', pagoId)
        .single();

      if (pagoAEliminarError) throw pagoAEliminarError;

      const { error: deleteError } = await supabase
        .from('ordenes_trabajo_pagos')
        .delete()
        .eq('id', pagoId);

      if (deleteError) throw deleteError;

      await addHistorialEvent(ordenId, 'pago_eliminado', 'Pago eliminado', {
        pago_id: pagoId,
        before: pagoAEliminar,
      });

      return true;
    } catch (err) {
      console.error('Error deleting pago:', err);
      const anyErr: any = err;
      const code = anyErr?.code ? String(anyErr.code) : null;
      if (code === '23503') {
        setError('No se puede eliminar este pago porque está relacionado a otros registros (por ejemplo liquidaciones).');
      } else if (code === '42501') {
        setError('No tenés permisos para eliminar pagos con tu rol actual.');
      } else {
        setError(err instanceof Error ? err.message : 'Error al eliminar pago');
      }
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

      const incomingNote = (data.ordenData.notas_internas || '').trim();

      const { data: currentOrder, error: currentOrderError } = await supabase
        .from('ordenes_trabajo')
        .select('notas_internas')
        .eq('id', id)
        .eq('company_id', profile.company_id)
        .single();

      if (currentOrderError) throw currentOrderError;
      const previousNote = ((currentOrder?.notas_internas as string | null) || '').trim();

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
        ...(data.ordenData.created_by !== undefined ? { created_by: data.ordenData.created_by } : {}),

        updated_at: new Date().toISOString(),
        updated_by: profile.id
      };

      const { error: ordenError } = await supabase
        .from('ordenes_trabajo')
        .update(updateData)
        .eq('id', id)
        .eq('company_id', profile.company_id);

      if (ordenError) throw ordenError;

      if (incomingNote && incomingNote !== previousNote) {
        const noteOk = await insertOrderNote(id, incomingNote);
        if (noteOk) {
          await addHistorialEvent(id, 'nota_agregada', `Nota agregada por ${profile.full_name}`, {
            nota: incomingNote,
          });
        }
      }

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
          created_by: profile.id,
          metadata: s.metadata || {}
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
            producto_id: item.producto_id || null,
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
              tipo_etapa: normalizarEtapa(ruta.etapa || ruta.tipo_etapa || 'principal'),
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
          categoria_id: item.categoria_id || null,
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
          .insert(itemsToInsert as any)
          .select();

        if (insertItemsError) throw insertItemsError;
        if (!insertedItems) throw new Error('Error al insertar items nuevos');

        // Insertar rutas para los NUEVOS items
        for (let i = 0; i < insertedItems.length; i++) {
          const itemDb = insertedItems[i];
          const itemOriginal = newItems[i]; // Coinciden en índice

          let rutasPregeneradas = itemOriginal.rutas_generadas || [];

          // MEJORA: Generar rutas automáticamente si se omitieron
          if (rutasPregeneradas.length === 0 && (itemOriginal.producto_id || (itemOriginal.configuracion as any)?.ruta_produccion_id)) {
            rutasPregeneradas = await generateProductionRoutes({
              productoId: (itemOriginal as any).producto_id || '',
              categoria: (itemOriginal as any).producto_categoria || '',
              configuracion: itemOriginal.configuracion || {}
            });
          }

          if (rutasPregeneradas && rutasPregeneradas.length > 0) {
            const rutasToInsert = rutasPregeneradas.map((ruta: any) => ({
              company_id: profile.company_id,
              orden_item_id: itemDb.id,
              tipo_etapa: normalizarEtapa(ruta.etapa || ruta.tipo_etapa || 'principal'),
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

    let createdOrdenId: string | null = null;

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
      createdOrdenId = newOrden.id;

      const initialNote = (data.ordenData.notas_internas || '').trim();
      if (initialNote) {
        const noteOk = await insertOrderNote(newOrden.id, initialNote);
        if (noteOk) {
          await addHistorialEvent(newOrden.id, 'nota_agregada', `Nota agregada por ${profile.full_name}`, {
            nota: initialNote,
          });
        }
      }

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

        const { data: insertedItemsRaw, error: itemsError } = await supabase
          .from('ordenes_trabajo_items')
          .insert(itemsToInsert as any)
          .select();
        const insertedItems = insertedItemsRaw as any[];

        if (itemsError) throw itemsError;

        // 3. Insertar rutas pregeneradas para cada item
        for (let i = 0; i < insertedItems.length; i++) {
          const item = insertedItems[i];
          const itemOriginal = data.items[i];

          let rutasPregeneradas = itemOriginal.rutas_generadas || [];

          // MEJORA: Si no hay rutas pero hay config con ruta, intentar generarlas dinámicamente
          if (rutasPregeneradas.length === 0 && (itemOriginal.producto_id || (itemOriginal.configuracion as any)?.ruta_produccion_id)) {
            console.log(`🔍 Intentando generar rutas automáticas para item ${(item as any).id}...`);
            rutasPregeneradas = await generateProductionRoutes({
              productoId: (itemOriginal as any).producto_id || '',
              categoria: (itemOriginal as any).producto_categoria || '',
              configuracion: itemOriginal.configuracion || {}
            });
          }

          // Si el item tiene rutas (pregeneradas o recién calculadas), insertarlas
          if (rutasPregeneradas && rutasPregeneradas.length > 0) {
            try {
              const rutasToInsert = rutasPregeneradas.map((ruta: any) => {
                console.log('🔍 Ruta a insertar:', {
                  tipo_etapa: ruta.etapa,
                  paso_nombre: ruta.paso_nombre,
                  orden: ruta.orden
                });

                return {
                  company_id: profile.company_id,
                  orden_item_id: item.id,
                  tipo_etapa: normalizarEtapa(ruta.etapa || ruta.tipo_etapa || 'principal'),
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
          // Crear mapa de IDs temporales a reales
          const tempIdToRealId = new Map<string, string>();
          data.items.forEach((item, index) => {
            const tempId = (item as any).id; // El item original del frontend tiene ID temporal
            if (tempId && insertedItems[index]) {
              tempIdToRealId.set(tempId, insertedItems[index].id);
            }
          });

          const serviciosToInsert = data.servicios.map(s => {
            // Remapear linked_item_ids si existen
            let metadata = s.metadata || {};
            if (metadata.linked_item_ids && Array.isArray(metadata.linked_item_ids)) {
              const newLinkedIds = metadata.linked_item_ids
                .map((tempId: string) => tempIdToRealId.get(tempId) || tempId)
                .filter(Boolean); // Filtrar nulos si falla el map

              metadata = { ...metadata, linked_item_ids: newLinkedIds };
            }

            return {
              orden_id: newOrden.id,
              descripcion: s.descripcion,
              cantidad: s.cantidad,
              precio_unitario: s.precio_unitario,
              subtotal: s.subtotal,
              servicio_id: s.servicio_id || null,
              created_by: profile.id,
              metadata: metadata
            };
          });

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
        const subtotalFinal = subtotalItems + totalServicios; // Fix: Incluir servicios en subtotal para consistencia con fn SQL

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
      // Evitar "órdenes fantasma" (se creó el header pero falló en items/rutas/servicios).
      if (createdOrdenId) {
        try {
          await supabase
            .from('ordenes_trabajo')
            .delete()
            .eq('id', createdOrdenId)
            .eq('company_id', profile.company_id);
        } catch (cleanupErr) {
          console.error('Error limpiando orden parcial:', cleanupErr);
        }
      }
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

      // 1. Obtener la orden completa con sus pagos y la OC asociada
      const ordenCompleta = await getOrdenById(ordenTrabajoId);

      if (!ordenCompleta || !ordenCompleta.ordenCopiado) {
        throw new Error('No se encontró la orden de trabajo o no tiene orden de copiado asociada');
      }

      // 2. Validar desvinculación
      // TODO: Verificar si tiene items en producción (por ahora asumimos false o lo sacamos de la OC)
      // En una implementación ideal, deberíamos verificar el estado de los items de la OC
      const { valido, mensaje } = validarDesvinculacion(ordenCompleta.ordenCopiado as any);

      if (!valido) {
        throw new Error(mensaje);
      }

      // 3. Distribuir pagos proporcionalmente
      // Nota: ordenCompleta.pagos contiene TODOS los pagos consolidados
      const pagos = ordenCompleta.pagos || [];
      const totalOT = ordenCompleta.total; // Este total incluye items OT + OC si está consolidado? 
      // Revisando createOrdenItem, el total de la OT suma items propios.
      // Pero calcularTotalesConsolidados suma OT + OC.
      // Necesitamos el total PROPIO de la OT.

      // Recalculamos totales propios de la OT (items + servicios)
      const subtotalItemsOT = ordenCompleta.items?.reduce((sum, item) => sum + item.precio_total, 0) || 0;
      const subtotalServiciosOT = ordenCompleta.servicios?.reduce((sum, s) => sum + s.subtotal, 0) || 0;
      const totalPropioOT = subtotalItemsOT + subtotalServiciosOT;
      // Nota: Esto es simplificado, faltaría IVA y descuentos propios si aplican, 
      // pero para la proporción usamos el valor relativo.

      const totalOC = ordenCompleta.ordenCopiado.total;

      const { pagosOT, pagosOC, totalPagadoOT, totalPagadoOC } = distribuirPagosProporcional(
        totalPropioOT,
        totalOC,
        pagos as any[]
      );

      console.log('Distribución de pagos:', {
        totalPropioOT,
        totalOC,
        pagosOriginales: pagos.length,
        nuevosPagosOT: pagosOT.length,
        nuevosPagosOC: pagosOC.length,
        montoOT: totalPagadoOT,
        montoOC: totalPagadoOC
      });

      // 4. Actualizar pagos de la OT
      // Estrategia: Actualizar los pagos existentes con el nuevo monto asignado a OT
      // Si el monto OT es 0, podríamos borrarlos, pero mejor mantener el registro con monto 0 o actualizado.
      // La función distribuirPagosProporcional devuelve un array mapeado de los pagos originales.

      for (const pago of pagosOT) {
        if (pago.monto !== pago.montoOriginal) {
          const { error: updateError } = await supabase
            .from('ordenes_trabajo_pagos')
            .update({
              monto: pago.monto,
              notas: (pago.notas ? pago.notas + ' ' : '') + '(Monto ajustado por desvinculación de OC)'
            })
            .eq('id', pago.id);

          if (updateError) throw updateError;
        }
      }

      // 5. Crear pagos para la OC
      // Insertamos nuevos registros en centro_copiado_ordenes_pagos
      // Usando los mismos datos (fecha, medio cobro) que el pago original
      if (pagosOC.length > 0) {
        const pagosParaInsertar = pagosOC.map(p => ({
          orden_copiado_id: ordenCompleta.ordenCopiado!.id,
          fecha_pago: p.fecha_pago,
          monto: p.monto,
          medio_cobro_id: (p as any).medio_cobro_id, // Asumimos que viene del join o tipo correcto
          // Si el pago original no tiene medio_cobro_id (ej. efectivo sin id), esto podría fallar si la columna es FK obligatoria.
          // Revisamos tipos: OrdenTrabajoPago tiene 'metodo_pago' (string) y 'medio_cobro_id' no está explícito en la interfaz OT pero sí en la lógica.
          // En DB ordenes_trabajo_pagos tiene medio_cobro_id uuid nullable.
          // CentroCopiadoOrdenPago tiene medio_cobro_id uuid NOT NULL? -> Revisar schema.
          // Si falla por null, necesitamos un fallback o lógica adicional.

          referencia_pago: (p as any).referencia_pago,
          notas: `Pago derivado de OT #${ordenCompleta.numero_orden} (Desvinculación)`,
          created_by: profile.id,
          comision_aplicada: 0, // Simplificación
          fecha_liberacion_estimada: p.fecha_pago // Simplificación
        }));

        // Filtrar pagos con monto > 0 para no llenar de basura
        const pagosValidos = pagosParaInsertar.filter(p => p.monto > 0);

        if (pagosValidos.length > 0) {
          const { error: insertError } = await supabase
            .from('centro_copiado_ordenes_pagos')
            .insert(pagosValidos);

          if (insertError) throw insertError;
        }
      }

      // 6. Desvincular la orden de copiado
      const { error: updateError } = await supabase
        .from('centro_copiado_ordenes')
        .update({ orden_trabajo_id: null })
        .eq('id', ordenCompleta.ordenCopiado.id) // Usar ID directo de la OC
        .eq('company_id', profile.company_id);

      if (updateError) throw updateError;

      // Registrar en historial
      await addHistorialEvent(
        ordenTrabajoId,
        'modificacion', // TipoEventoHistorial genérico o 'nota_agregada'
        'Orden de copiado desvinculada. Pagos redistribuidos.',
        {
          total_ot_previo: totalPropioOT + totalOC,
          total_desvinculado: totalOC,
          pagos_transferidos: totalPagadoOC
        }
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
    addNota,
    changeEstado,
    desvincularOrdenCopiado,
    updateOrdenCompleta,
  };
}
