import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import { ordenarRutasPorEtapaYOrden, ORDEN_ETAPAS } from '../utils/productionUtils';
import type { OrdenItemRuta, EstadoPaso, TipoEtapaRuta } from '../types/database';

interface StepExecutionResult {
  success: boolean;
  error?: string;
  updatedRuta?: OrdenItemRuta;
  ordenCambioAFinalizada?: boolean;
  ordenFinalizada?: boolean;
  ordenRequiereDespacho?: boolean;
  ordenNumero?: string;
  ordenId?: string;
}

interface OrdenSnapshot {
  id: string;
  estado: string;
  requiere_despacho: boolean;
  numero_orden: string;
}

export function useStepExecution() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOrdenSnapshot = async (ordenItemId: string): Promise<OrdenSnapshot | null> => {
    const { data, error: snapshotError } = await supabase
      .from('ordenes_trabajo_items')
      .select('orden:ordenes_trabajo!inner(id, estado, requiere_despacho, numero_orden)')
      .eq('id', ordenItemId)
      .maybeSingle<any>();

    if (snapshotError) {
      console.warn('No se pudo obtener snapshot de la orden:', snapshotError);
      return null;
    }

    const orden = data?.orden;
    if (!orden) return null;

    return {
      id: orden.id,
      estado: orden.estado,
      requiere_despacho: Boolean(orden.requiere_despacho),
      numero_orden: orden.numero_orden || 'Sin número',
    };
  };

  const buildOrdenTransitionMeta = (
    before: OrdenSnapshot | null,
    after: OrdenSnapshot | null
  ): Pick<
    StepExecutionResult,
    'ordenCambioAFinalizada' | 'ordenFinalizada' | 'ordenRequiereDespacho' | 'ordenNumero' | 'ordenId'
  > => {
    const finalOrder = after || before;
    const estadoBefore = before?.estado;
    const estadoAfter = after?.estado;
    const ordenFinalizada = estadoAfter === 'finalizada';

    return {
      ordenCambioAFinalizada:
        estadoBefore !== undefined
          ? estadoBefore !== 'finalizada' && estadoAfter === 'finalizada'
          : false,
      ordenFinalizada,
      ordenRequiereDespacho: finalOrder ? finalOrder.requiere_despacho : false,
      ordenNumero: finalOrder?.numero_orden,
      ordenId: finalOrder?.id,
    };
  };

  const startStep = async (rutaId: string, ordenItemId: string): Promise<StepExecutionResult> => {
    if (!profile?.id) {
      return { success: false, error: 'Usuario no autenticado' };
    }

    setLoading(true);
    setError(null);

    try {
      // 1. Verificar si es tarea global
      const { data: rutaInfo, error: fetchRutaError } = await supabase
        .from('ordenes_trabajo_items_rutas')
        .select('global_task_id, paso_nombre')
        .eq('id', rutaId)
        .single<any>();

      if (fetchRutaError) throw fetchRutaError;

      // CASO TAREA GLOBAL: Actualización Masiva
      if (rutaInfo.global_task_id) {
        const { error: rpcError } = await supabase.rpc('update_global_task_status', {
          p_global_task_id: rutaInfo.global_task_id,
          p_new_status: 'en_proceso',
          p_user_id: profile.id
        } as any);

        if (rpcError) throw rpcError;

        // Actualizar estado del item a "en_proceso" es más complejo masivamente, se omite por ahora
        // o se confía en triggers de DB si existen. 
        // Retornamos éxito genérico.
        return { success: true };
      }

      // CASO TAREA NORMAL: Lógica Original
      // Verificar que no haya otro paso en proceso para este item
      const { data: pasosEnProceso, error: checkError } = await supabase
        .from('ordenes_trabajo_items_rutas')
        .select('id, paso_nombre')
        .eq('orden_item_id', ordenItemId)
        .eq('estado_paso', 'en_proceso');

      if (checkError) throw checkError;

      if (pasosEnProceso && pasosEnProceso.length > 0) {
        return {
          success: false,
          error: `Ya hay un paso en proceso: ${pasosEnProceso[0].paso_nombre}`,
        };
      }

      // Iniciar el paso
      const { data: updatedRuta, error: updateError } = await supabase
        .from('ordenes_trabajo_items_rutas')
        .update({
          estado_paso: 'en_proceso' as EstadoPaso,
          fecha_inicio: new Date().toISOString(),
          responsable_id: profile.id,
        })
        .eq('id', rutaId)
        .select()
        .single();

      if (updateError) throw updateError;

      // Actualizar estado del item a "en_proceso" si estaba "pendiente"
      const { error: itemError } = await supabase
        .from('ordenes_trabajo_items')
        .update({ estado: 'en_proceso' })
        .eq('id', ordenItemId)
        .eq('estado', 'pendiente');

      if (itemError) console.warn('Error actualizando estado del item:', itemError);

      return { success: true, updatedRuta };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Error desconocido';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setLoading(false);
    }
  };

  const completeStep = async (
    rutaId: string,
    ordenItemId: string,
    notas?: string
  ): Promise<StepExecutionResult> => {
    if (!profile?.id) {
      return { success: false, error: 'Usuario no autenticado' };
    }

    setLoading(true);
    setError(null);

    try {
      const ordenBefore = await fetchOrdenSnapshot(ordenItemId);

      // 1. Verificar si es tarea global
      const { data: rutaInfo, error: fetchRutaError } = await supabase
        .from('ordenes_trabajo_items_rutas')
        .select('global_task_id, fecha_inicio')
        .eq('id', rutaId)
        .single<any>();

      if (fetchRutaError) throw fetchRutaError;

      // CASO TAREA GLOBAL
      if (rutaInfo.global_task_id) {
        const { error: rpcError } = await supabase.rpc('update_global_task_status', {
          p_global_task_id: rutaInfo.global_task_id,
          p_new_status: 'completado',
          p_user_id: profile.id,
          p_notes: notas || null
        } as any);

        if (rpcError) throw rpcError;
        const ordenAfter = await fetchOrdenSnapshot(ordenItemId);
        return {
          success: true,
          ...buildOrdenTransitionMeta(ordenBefore, ordenAfter),
        };
      }

      // CASO NORMAL
      const nowIso = new Date().toISOString();
      // Completar el paso
      const { data: updatedRuta, error: updateError } = await supabase
        .from('ordenes_trabajo_items_rutas')
        .update({
          estado_paso: 'completado' as EstadoPaso,
          fecha_inicio: rutaInfo?.fecha_inicio || nowIso,
          fecha_fin: nowIso,
          responsable_id: profile.id,
          notas: notas || null,
        })
        .eq('id', rutaId)
        .select()
        .single();

      if (updateError) throw updateError;

      // Verificar si todos los pasos están completados
      const { data: todasRutas, error: rutasError } = await supabase
        .from('ordenes_trabajo_items_rutas')
        .select('estado_paso')
        .eq('orden_item_id', ordenItemId);

      if (rutasError) throw rutasError;

      const todosPasosCompletados = todasRutas?.every(
        (r) => r.estado_paso === 'completado' || r.estado_paso === 'omitido'
      );

      // Si todos los pasos están completados, actualizar el item a finalizado
      if (todosPasosCompletados) {
        const { error: itemError } = await supabase
          .from('ordenes_trabajo_items')
          .update({ estado: 'finalizado' })
          .eq('id', ordenItemId);

        if (itemError) console.warn('Error actualizando estado del item a finalizado:', itemError);
      }

      const ordenAfter = await fetchOrdenSnapshot(ordenItemId);
      return {
        success: true,
        updatedRuta,
        ...buildOrdenTransitionMeta(ordenBefore, ordenAfter),
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Error desconocido';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setLoading(false);
    }
  };

  const skipStep = async (
    rutaId: string,
    ordenItemId: string,
    justificacion: string
  ): Promise<StepExecutionResult> => {
    if (!profile?.id) {
      return { success: false, error: 'Usuario no autenticado' };
    }

    if (!justificacion || justificacion.trim().length === 0) {
      return { success: false, error: 'La justificación es obligatoria para omitir un paso' };
    }

    setLoading(true);
    setError(null);

    try {
      const ordenBefore = await fetchOrdenSnapshot(ordenItemId);

      // 1. Verificar si es tarea global
      const { data: rutaInfo, error: fetchRutaError } = await supabase
        .from('ordenes_trabajo_items_rutas')
        .select('global_task_id')
        .eq('id', rutaId)
        .single<any>();

      if (fetchRutaError) throw fetchRutaError;

      // CASO TAREA GLOBAL
      if (rutaInfo.global_task_id) {
        const { error: rpcError } = await supabase.rpc('update_global_task_status', {
          p_global_task_id: rutaInfo.global_task_id,
          p_new_status: 'omitido',
          p_user_id: profile.id,
          p_notes: justificacion
        } as any);

        if (rpcError) throw rpcError;
        const ordenAfter = await fetchOrdenSnapshot(ordenItemId);
        return {
          success: true,
          ...buildOrdenTransitionMeta(ordenBefore, ordenAfter),
        };
      }

      // CASO NORMAL
      // Omitir el paso
      const { data: updatedRuta, error: updateError } = await supabase
        .from('ordenes_trabajo_items_rutas')
        .update({
          estado_paso: 'omitido' as EstadoPaso,
          fecha_fin: new Date().toISOString(),
          notas: justificacion,
          responsable_id: profile.id,
        })
        .eq('id', rutaId)
        .select()
        .single();

      if (updateError) throw updateError;

      // Verificar si todos los pasos están completados u omitidos
      const { data: todasRutas, error: rutasError } = await supabase
        .from('ordenes_trabajo_items_rutas')
        .select('estado_paso')
        .eq('orden_item_id', ordenItemId);

      if (rutasError) throw rutasError;

      const todosPasosCompletados = todasRutas?.every(
        (r) => r.estado_paso === 'completado' || r.estado_paso === 'omitido'
      );

      // Si todos los pasos están completados/omitidos, actualizar el item a finalizado
      if (todosPasosCompletados) {
        const { error: itemError } = await supabase
          .from('ordenes_trabajo_items')
          .update({ estado: 'finalizado' })
          .eq('id', ordenItemId);

        if (itemError) console.warn('Error actualizando estado del item a finalizado:', itemError);
      }

      const ordenAfter = await fetchOrdenSnapshot(ordenItemId);
      return {
        success: true,
        updatedRuta,
        ...buildOrdenTransitionMeta(ordenBefore, ordenAfter),
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Error desconocido';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setLoading(false);
    }
  };

  const getActiveStep = (rutas: OrdenItemRuta[]): OrdenItemRuta | null => {
    if (rutas.length === 0) return null;

    const rutasOrdenadas = ordenarRutasPorEtapaYOrden(rutas);

    const pasoEnProceso = rutasOrdenadas.find((r) => r.estado_paso === 'en_proceso');
    if (pasoEnProceso) return pasoEnProceso;

    const pasoPendiente = rutasOrdenadas.find((r) => r.estado_paso === 'pendiente');
    return pasoPendiente || null;
  };

  const canStartStep = (ruta: OrdenItemRuta, rutas: OrdenItemRuta[]): boolean => {
    if (ruta.estado_paso !== 'pendiente') return false;

    const hayPasoEnProceso = rutas.some((r) => r.estado_paso === 'en_proceso');
    if (hayPasoEnProceso) return false;

    const rutasOrdenadas = ordenarRutasPorEtapaYOrden(rutas);
    const ordenEtapaActual = ORDEN_ETAPAS[ruta.tipo_etapa];

    for (const r of rutasOrdenadas) {
      const ordenEtapaRuta = ORDEN_ETAPAS[r.tipo_etapa];

      if (ordenEtapaRuta < ordenEtapaActual) {
        if (r.estado_paso !== 'completado' && r.estado_paso !== 'omitido') {
          return false;
        }
      } else if (ordenEtapaRuta === ordenEtapaActual && r.orden < ruta.orden) {
        if (r.estado_paso !== 'completado' && r.estado_paso !== 'omitido') {
          return false;
        }
      } else if (ordenEtapaRuta === ordenEtapaActual && r.orden === ruta.orden && r.id === ruta.id) {
        break;
      }
    }

    return true;
  };

  return {
    startStep,
    completeStep,
    skipStep,
    getActiveStep,
    canStartStep,
    loading,
    error,
  };
}
