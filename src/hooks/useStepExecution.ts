import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import { ordenarRutasPorEtapaYOrden, ORDEN_ETAPAS } from '../utils/productionUtils';
import type { OrdenItemRuta, EstadoPaso, TipoEtapaRuta } from '../types/database';

interface StepExecutionResult {
  success: boolean;
  error?: string;
  updatedRuta?: OrdenItemRuta;
}

export function useStepExecution() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startStep = async (rutaId: string, ordenItemId: string): Promise<StepExecutionResult> => {
    if (!profile?.id) {
      return { success: false, error: 'Usuario no autenticado' };
    }

    setLoading(true);
    setError(null);

    try {
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
      // Completar el paso
      const { data: updatedRuta, error: updateError } = await supabase
        .from('ordenes_trabajo_items_rutas')
        .update({
          estado_paso: 'completado' as EstadoPaso,
          fecha_fin: new Date().toISOString(),
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

      return { success: true, updatedRuta };
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

      return { success: true, updatedRuta };
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
