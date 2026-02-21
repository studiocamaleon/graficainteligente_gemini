import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import { useMediosCobro } from './useMediosCobro';
import type { CentroCopiadoOrdenPago } from '../types/database';
import { sendWatiMessage } from '../lib/wati';
import { isWorkshopOperatorRole } from '../utils/roles';

interface CreatePagoData {
  orden_copiado_id: string;
  fecha_pago: string;
  monto: number;
  medio_cobro_id: string;
  referencia_pago?: string;
  notas?: string;
}

interface UpdatePagoData {
  fecha_pago?: string;
  monto?: number;
  medio_cobro_id?: string;
  referencia_pago?: string;
  notas?: string;
}

export function useCentroCopiadoOrdenPagos(ordenCopiadoId?: string) {
  const [pagos, setPagos] = useState<CentroCopiadoOrdenPago[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { profile } = useAuth();
  const { calcularComisionYLiberacion } = useMediosCobro();

  const fetchPagos = useCallback(async () => {
    if (!profile?.company_id || !ordenCopiadoId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('centro_copiado_ordenes_pagos')
        .select('*')
        .eq('orden_copiado_id', ordenCopiadoId)
        .order('fecha_pago', { ascending: false });

      if (fetchError) throw fetchError;

      setPagos(data || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error al cargar pagos';
      setError(errorMessage);
      console.error('Error fetching pagos:', err);
    } finally {
      setLoading(false);
    }
  }, [profile?.company_id, ordenCopiadoId]);

  useEffect(() => {
    fetchPagos();
  }, [fetchPagos]);

  const createPago = useCallback(
    async (data: CreatePagoData) => {
      if (!profile?.company_id || !profile?.id) {
        setError('No se pudo obtener la información del usuario');
        return null;
      }

      if (isWorkshopOperatorRole(profile?.role)) {
        setError('El rol Operador de taller no puede registrar pagos.');
        return null;
      }

      try {
        setError(null);

        // Calcular comisión y fecha de liberación
        const { comision, fechaLiberacion } = calcularComisionYLiberacion(
          data.monto,
          data.medio_cobro_id,
          data.fecha_pago
        );

        const pagoData = {
          orden_copiado_id: data.orden_copiado_id,
          fecha_pago: data.fecha_pago,
          monto: data.monto,
          medio_cobro_id: data.medio_cobro_id,
          referencia_pago: data.referencia_pago || null,
          comision_aplicada: comision,
          fecha_liberacion_estimada: fechaLiberacion,
          notas: data.notas || null,
          created_by: profile.id,
        };

        const { data: newPago, error: insertError } = await supabase
          .from('centro_copiado_ordenes_pagos')
          .insert(pagoData)
          .select('id')
          .single();

        if (insertError) throw insertError;

        // Generar recibo PDF (JWT).
        // Importante: no bloqueamos el alta del pago ni la respuesta al usuario.
        if (newPago?.id) {
          void (async () => {
            try {
              let recibo: any = null;
              for (let i = 0; i < 5; i++) {
                const { data: r, error: reciboErr } = await supabase
                  .from('recibos_pagos' as any)
                  .select('id, token_corto')
                  .eq('pago_copiado_id', newPago.id)
                  .maybeSingle();

                if (!reciboErr && r?.id && r?.token_corto) {
                  recibo = r;
                  break;
                }
                await new Promise((res) => setTimeout(res, 400));
              }

              if (!recibo?.id || !recibo?.token_corto) return;

              await supabase.functions.invoke('generate-recibo-pdf', {
                body: { recibo_id: recibo.id },
              });

              // Envío Wati (fallará hasta aprobación de plantilla).
              try {
                const { data: ordenInfo } = await supabase
                  .from('centro_copiado_ordenes')
                  .select('numero_orden, cliente:clients(whatsapp)')
                  .eq('id', data.orden_copiado_id)
                  .maybeSingle();

                const phone = (ordenInfo as any)?.cliente?.whatsapp as string | null;
                const numeroOrden = (ordenInfo as any)?.numero_orden as string | null;

                if (profile?.company_id && phone && numeroOrden) {
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
                      orden_copiado_id: data.orden_copiado_id,
                    },
                  });
                }
              } catch (watiErr) {
                console.warn('[Wati] No se pudo enviar recibo por WhatsApp (copiado):', watiErr);
              }
            } catch (genErr) {
              console.warn('[Recibos] No se pudo generar PDF automáticamente (copiado):', genErr);
            }
          })();
        }

        await fetchPagos();
        return newPago;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Error al crear pago';
        setError(errorMessage);
        console.error('Error creating pago:', err);
        return null;
      }
    },
    [profile?.company_id, profile?.id, calcularComisionYLiberacion, fetchPagos]
  );

  const updatePago = useCallback(
    async (id: string, data: UpdatePagoData) => {
      if (!profile?.company_id) {
        setError('No se pudo obtener la información del usuario');
        return false;
      }

      try {
        setError(null);

        // Si se cambia el monto o medio de cobro, recalcular comisión
        let updateData: any = { ...data };

        if (data.monto !== undefined || data.medio_cobro_id !== undefined) {
          // Obtener el pago actual
          const pagoActual = pagos.find(p => p.id === id);
          if (pagoActual) {
            const monto = data.monto ?? pagoActual.monto;
            const medioCobroId = data.medio_cobro_id ?? pagoActual.medio_cobro_id;
            const fechaPago = data.fecha_pago ?? pagoActual.fecha_pago;

            const { comision, fechaLiberacion } = calcularComisionYLiberacion(
              monto,
              medioCobroId,
              fechaPago
            );

            updateData.comision_aplicada = comision;
            updateData.fecha_liberacion_estimada = fechaLiberacion;
          }
        }

        const { error: updateError } = await supabase
          .from('centro_copiado_ordenes_pagos')
          .update(updateData)
          .eq('id', id);

        if (updateError) throw updateError;

        await fetchPagos();
        return true;
      } catch (err) {
        const anyErr: any = err;
        const code = anyErr?.code ? String(anyErr.code) : null;
        if (code === '42501') {
          setError('No tenés permisos para editar pagos con tu rol actual.');
        } else {
          const errorMessage = err instanceof Error ? err.message : 'Error al actualizar pago';
          setError(errorMessage);
        }
        console.error('Error updating pago:', err);
        return false;
      }
    },
    [profile?.company_id, pagos, calcularComisionYLiberacion, fetchPagos]
  );

  const deletePago = useCallback(
    async (id: string) => {
      if (!profile?.company_id) {
        setError('No se pudo obtener la información del usuario');
        return false;
      }

      try {
        setError(null);

        const { error: deleteError } = await supabase
          .from('centro_copiado_ordenes_pagos')
          .delete()
          .eq('id', id);

        if (deleteError) throw deleteError;

        await fetchPagos();
        return true;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Error al eliminar pago';
        const anyErr: any = err;
        const code = anyErr?.code ? String(anyErr.code) : null;
        if (code === '42501') {
          setError('No tenés permisos para eliminar pagos con tu rol actual.');
        } else {
          setError(errorMessage);
        }
        console.error('Error deleting pago:', err);
        return false;
      }
    },
    [profile?.company_id, fetchPagos]
  );

  const calcularTotales = useCallback((totalOrden: number) => {
    const totalPagado = Number(pagos.reduce((sum, p) => sum + p.monto, 0).toFixed(2));
    const saldoPendiente = Number((totalOrden - totalPagado).toFixed(2));
    const porcentajePagado = totalOrden > 0 ? (totalPagado / totalOrden) * 100 : 0;

    return {
      totalPagado,
      saldoPendiente,
      porcentajePagado,
      estaPagado: saldoPendiente <= 0,
      tienePagoParcial: totalPagado > 0 && saldoPendiente > 0,
    };
  }, [pagos]);

  return {
    pagos,
    loading,
    error,
    fetchPagos,
    createPago,
    updatePago,
    deletePago,
    calcularTotales,
  };
}
