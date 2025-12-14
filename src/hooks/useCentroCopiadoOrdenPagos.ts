import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import { useMediosCobro } from './useMediosCobro';
import type { CentroCopiadoOrdenPago } from '../types/database';

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
          .select()
          .single();

        if (insertError) throw insertError;

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
        const errorMessage = err instanceof Error ? err.message : 'Error al actualizar pago';
        setError(errorMessage);
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
        setError(errorMessage);
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
