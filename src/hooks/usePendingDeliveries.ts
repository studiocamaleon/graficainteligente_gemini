import { useState, useCallback, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import { isWorkshopOperatorRole } from '../utils/roles';
import { useMediosCobro } from './useMediosCobro';
import { sendWatiMessage } from '../lib/wati';


export interface PendingDelivery {
    id: string;
    numero_orden: string;
    cliente: {
        id: string;
        nombre_fantasia: string;
        razon_social: string;
        numero_documento: string;
        tiene_cuenta_corriente: boolean;
        whatsapp: string | null;
    } | null;
    fecha_solicitud: string;
    // ISO string of when the order was finalized (or null if unknown/historical)
    fecha_finalizada: string | null;
    fecha_entrega_estimada: string | null;
    tipo: 'orden_trabajo' | 'centro_copiado';
    total: number;
    estado: string;
    total_pagado: number;
    saldo_pendiente: number;
    requiere_despacho?: boolean;
    tracking_token?: string;
}

export function usePendingDeliveries() {
    const { profile } = useAuth();
    const { calcularComisionYLiberacion } = useMediosCobro();
    const [deliveries, setDeliveries] = useState<PendingDelivery[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchDeliveries = useCallback(async () => {
        if (!profile?.company_id) return;

        try {
            setLoading(true);
            setError(null);

            // fetch Work Orders (Estado: finalizada) with payments
            const { data: workOrders, error: workError } = await supabase
                .from('ordenes_trabajo')
                .select(`
          id,
          numero_orden,
          created_at,
          fecha_completado,
          fecha_estimada_entrega,
          subtotal,
          total_descuentos,
          subtotal_iva,
          total,
          estado,
          requiere_despacho,
          tracking_token,
          cliente:clients(id, nombre_fantasia, razon_social, numero_documento, tiene_cuenta_corriente, whatsapp),
          pagos:ordenes_trabajo_pagos(monto)
        `)
                .eq('company_id', profile.company_id)
                .eq('estado', 'finalizada');

            if (workError) throw workError;

            // fetch Copy Center Orders (Estado: finalizada) with payments
            const { data: copyOrders, error: copyError } = await supabase
                .from('centro_copiado_ordenes')
                .select(`
          id,
          numero_orden,
          fecha_solicitud,
          fecha_completado,
          fecha_entrega_estimada,
          total,
          estado,
          tracking_token,
          cliente:clients(id, nombre_fantasia, razon_social, numero_documento, tiene_cuenta_corriente, whatsapp),
          pagos:centro_copiado_ordenes_pagos(monto)
        `)
                .eq('company_id', profile.company_id)
                .eq('estado', 'finalizada');

            if (copyError) throw copyError;

            const workOrderIds = (workOrders as any[] || []).map((o) => o.id);
            let ocTotalsByOtId = new Map<string, number>();

            if (workOrderIds.length > 0) {
                const { data: linkedOc, error: linkedOcError } = await supabase
                    .from('centro_copiado_ordenes')
                    .select('orden_trabajo_id, total, estado')
                    .in('orden_trabajo_id', workOrderIds)
                    .neq('estado', 'cancelada');

                if (linkedOcError) throw linkedOcError;

                ocTotalsByOtId = (linkedOc || []).reduce((acc: Map<string, number>, row: any) => {
                    const otId = row.orden_trabajo_id as string | null;
                    if (!otId) return acc;
                    const current = acc.get(otId) || 0;
                    acc.set(otId, current + Number(row.total || 0));
                    return acc;
                }, new Map<string, number>());
            }

            // Helper to sum payments
            const sumPayments = (pagos: any[]) => pagos?.reduce((sum, p) => sum + Number(p.monto || 0), 0) || 0;

            // Map and merge
            const mappedWorkOrders: PendingDelivery[] = (workOrders as any[] || []).map(o => {
                const totalPagado = sumPayments(o.pagos);
                const subtotal = Number(o.subtotal || 0);
                const descuentos = Number(o.total_descuentos || 0);
                const iva = Number(o.subtotal_iva || 0);
                const ocTotal = Number(ocTotalsByOtId.get(o.id) || 0);

                // Total neto robusto para evitar inconsistencias cuando el campo `total` quedó desactualizado.
                const totalCalculado = Number((subtotal - descuentos + iva + ocTotal).toFixed(2));
                const totalOrden = Math.max(0, totalCalculado);
                const saldoPendiente = Math.max(0, Number((totalOrden - totalPagado).toFixed(2)));
                const fechaFinalizada = o.fecha_completado ?? null;
                return {
                    id: o.id,
                    numero_orden: o.numero_orden,
                    cliente: o.cliente,
                    fecha_solicitud: o.created_at,
                    fecha_finalizada: fechaFinalizada,
                    fecha_entrega_estimada: o.fecha_estimada_entrega,
                    tipo: 'orden_trabajo',
                    total: totalOrden,
                    estado: o.estado,
                    total_pagado: totalPagado,
                    saldo_pendiente: saldoPendiente,
                    requiere_despacho: o.requiere_despacho,
                    tracking_token: o.tracking_token,
                };
            });

            const mappedCopyOrders: PendingDelivery[] = (copyOrders as any[] || []).map(o => {
                const totalPagado = sumPayments(o.pagos);
                const saldoPendiente = Math.max(0, (o.total || 0) - totalPagado);
                const fechaFinalizada = o.fecha_completado ?? null;
                return {
                    id: o.id,
                    numero_orden: o.numero_orden,
                    cliente: o.cliente,
                    fecha_solicitud: o.fecha_solicitud,
                    fecha_finalizada: fechaFinalizada,
                    fecha_entrega_estimada: o.fecha_entrega_estimada,
                    tipo: 'centro_copiado',
                    total: o.total,
                    estado: o.estado,
                    total_pagado: totalPagado,
                    saldo_pendiente: saldoPendiente,
                    tracking_token: o.tracking_token,
                };
            });
            // Merge and Sort by Date (Oldest First)
            const allDeliveries = [...mappedWorkOrders, ...mappedCopyOrders].sort((a, b) => {
                const aDate = new Date(a.fecha_finalizada ?? a.fecha_solicitud).getTime();
                const bDate = new Date(b.fecha_finalizada ?? b.fecha_solicitud).getTime();
                return aDate - bDate;
            });

            setDeliveries(allDeliveries);

        } catch (err) {
            console.error('Error fetching pending deliveries:', err);
            setError(err instanceof Error ? err.message : 'Error al cargar entregas pendientes');
        } finally {
            setLoading(false);
        }
    }, [profile?.company_id]);

    const deliverOrder = async (
        id: string,
        type: 'orden_trabajo' | 'centro_copiado',
        shippingData?: {
            fecha_despacho: string;
            transporte: string;
            numero_guia: string;
        }
    ) => {
        try {
            const table = type === 'orden_trabajo' ? 'ordenes_trabajo' : 'centro_copiado_ordenes';
            let updates: any = {
                estado: 'entregada',
                fecha_entrega_real: new Date().toISOString()
            };

            if (shippingData && type === 'orden_trabajo') {
                updates = {
                    ...updates,
                    ...shippingData,
                    estado_envio: 'enviado'
                };
            }

            const { error: updateError } = await supabase
                .from(table)
                .update(updates)
                .eq('id', id);

            if (updateError) throw updateError; // Fixed typo in thought if present, this is correct.

            // Optimistic update
            setDeliveries(prev => prev.filter(d => d.id !== id));
            return true;
        } catch (err) {
            console.error('Error delivering order:', err);
            return false;
        }
    };

    const addPayment = async (data: {
        orden_id: string;
        tipo: 'orden_trabajo' | 'centro_copiado';
        fecha_pago: string;
        monto: number;
        medio_cobro_id: string;
        referencia_pago?: string;
        notas?: string;
    }) => {
        try {
            if (isWorkshopOperatorRole(profile?.role)) {
                setError('El rol Operador de taller no puede registrar pagos.');
                return false;
            }

            const table = data.tipo === 'orden_trabajo' ? 'ordenes_trabajo_pagos' : 'centro_copiado_ordenes_pagos';
            const idField = data.tipo === 'orden_trabajo' ? 'orden_id' : 'orden_copiado_id';
            const { comision, fechaLiberacion } = calcularComisionYLiberacion(
                data.monto,
                data.medio_cobro_id,
                data.fecha_pago
            );

            const paymentData: any = {
                [idField]: data.orden_id,
                fecha_pago: data.fecha_pago,
                monto: data.monto,
                medio_cobro_id: data.medio_cobro_id,
                referencia_pago: data.referencia_pago || null,
                notas: data.notas || null,
                comision_aplicada: comision,
                fecha_liberacion_estimada: fechaLiberacion,
                created_by: profile?.id
            };

            const { data: insertedPago, error: insertError } = await supabase
                .from(table)
                .insert(paymentData)
                .select('id')
                .single();

            if (insertError) throw insertError;

            if (insertedPago?.id && profile?.company_id) {
                void (async () => {
                    try {
                        const reciboFilterField = data.tipo === 'orden_trabajo' ? 'pago_ot_id' : 'pago_copiado_id';
                        let recibo: any = null;

                        for (let i = 0; i < 5; i++) {
                            const { data: reciboData, error: reciboErr } = await supabase
                                .from('recibos_pagos' as any)
                                .select('id, token_corto')
                                .eq(reciboFilterField, insertedPago.id)
                                .maybeSingle();

                            if (!reciboErr && reciboData?.id && reciboData?.token_corto) {
                                recibo = reciboData;
                                break;
                            }
                            await new Promise((res) => setTimeout(res, 400));
                        }

                        if (!recibo?.id || !recibo?.token_corto) return;

                        await supabase.functions.invoke('generate-recibo-pdf', {
                            body: { recibo_id: recibo.id },
                        });

                        try {
                            const sourceTable = data.tipo === 'orden_trabajo' ? 'ordenes_trabajo' : 'centro_copiado_ordenes';
                            const { data: ordenInfo } = await supabase
                                .from(sourceTable)
                                .select('numero_orden, cliente:clients(whatsapp)')
                                .eq('id', data.orden_id)
                                .maybeSingle();

                            const phone = (ordenInfo as any)?.cliente?.whatsapp as string | null;
                            const numeroOrden = (ordenInfo as any)?.numero_orden as string | null;

                            if (phone && numeroOrden) {
                                const montoText = Number(data.monto).toLocaleString('es-AR', {
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
                                        ...(data.tipo === 'orden_trabajo'
                                            ? { orden_trabajo_id: data.orden_id }
                                            : { orden_copiado_id: data.orden_id }),
                                    },
                                });
                            }
                        } catch (watiErr) {
                            console.warn('[Wati] No se pudo enviar recibo por WhatsApp desde entregas:', watiErr);
                        }
                    } catch (genErr) {
                        console.warn('[Recibos] No se pudo generar PDF automáticamente desde entregas:', genErr);
                    }
                })();
            }

            // Update local state
            await fetchDeliveries(); // Refresh to recalculate balance
            return true;
        } catch (err) {
            console.error('Error adding payment:', err);
            setError(err instanceof Error ? err.message : 'Error al registrar pago');
            return false;
        }
    };

    useEffect(() => {
        fetchDeliveries();
    }, [fetchDeliveries]);

    return {
        deliveries,
        loading,
        error,
        refresh: fetchDeliveries,
        deliverOrder,
        addPayment
    };
}
