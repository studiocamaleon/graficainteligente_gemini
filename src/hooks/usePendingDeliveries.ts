import { useState, useCallback, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import { isWorkshopOperatorRole } from '../utils/roles';
import { useMediosCobro } from './useMediosCobro';
import { sendWatiMessage } from '../lib/wati';
import type { RealtimeChannel } from '@supabase/supabase-js';


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
    const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);

    const fetchDeliveries = useCallback(async () => {
        if (!profile?.company_id) return;

        try {
            setLoading(true);
            setError(null);

            const { data, error: rpcError } = await supabase
                .rpc('fn_dashboard_pending_deliveries_v1', {
                    p_company_id: profile.company_id,
                });

            if (rpcError) throw rpcError;

            const mappedDeliveries: PendingDelivery[] = (data || [])
                .map((row: any) => ({
                    id: row.orden_id,
                    numero_orden: row.numero_orden,
                    cliente: {
                        id: row.cliente_id,
                        nombre_fantasia: row.cliente_nombre || '',
                        razon_social: row.cliente_nombre || '',
                        numero_documento: row.cliente_documento || '',
                        tiene_cuenta_corriente: Boolean(row.tiene_cuenta_corriente),
                        whatsapp: row.cliente_whatsapp || null,
                    },
                    fecha_solicitud: row.fecha_creacion,
                    fecha_finalizada: row.fecha_finalizada ?? null,
                    fecha_entrega_estimada: row.fecha_entrega_estimada ?? null,
                    tipo: row.tipo_orden === 'orden_trabajo' ? 'orden_trabajo' : 'centro_copiado',
                    total: Number(row.total_calculado || 0),
                    estado: row.estado,
                    total_pagado: Number(row.pagado || 0),
                    saldo_pendiente: Number(row.saldo_pendiente || 0),
                    requiere_despacho: Boolean(row.requiere_despacho),
                    tracking_token: row.tracking_token || undefined,
                }));

            // Sort by finalization/creation date (Oldest first)
            const allDeliveries = [...mappedDeliveries].sort((a, b) => {
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

    useEffect(() => {
        if (!profile?.company_id) return;

        let channel: RealtimeChannel | null = null;

        channel = supabase
            .channel(`pending-deliveries-${profile.company_id}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'ordenes_trabajo' }, () => {
                void fetchDeliveries();
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'centro_copiado_ordenes' }, () => {
                void fetchDeliveries();
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'ordenes_trabajo_pagos' }, () => {
                void fetchDeliveries();
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'centro_copiado_ordenes_pagos' }, () => {
                void fetchDeliveries();
            })
            .subscribe((status) => {
                setIsRealtimeConnected(status === 'SUBSCRIBED');
            });

        return () => {
            if (channel) {
                void supabase.removeChannel(channel);
            }
            setIsRealtimeConnected(false);
        };
    }, [profile?.company_id, fetchDeliveries]);

    return {
        deliveries,
        loading,
        error,
        isRealtimeConnected,
        refresh: fetchDeliveries,
        deliverOrder,
        addPayment
    };
}
