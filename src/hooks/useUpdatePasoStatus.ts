import { useState } from 'react';
import { supabase } from '../lib/supabase';
import type { EstadoPaso } from '../types/database';

interface UpdatePasoStatusParams {
  rutaId: string;
  nuevoEstado: EstadoPaso;
  responsableId?: string;
  notas?: string;
}

export function useUpdatePasoStatus() {
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getPasoData = async (rutaId: string) => {
    const { data, error } = await supabase
      .from('ordenes_trabajo_items_rutas')
      .select('estado_paso, fecha_inicio, fecha_fin')
      .eq('id', rutaId)
      .single();

    if (error) throw error;
    return data;
  };

  const updatePasoStatus = async ({
    rutaId,
    nuevoEstado,
    responsableId,
    notas,
  }: UpdatePasoStatusParams): Promise<boolean> => {
    setUpdating(true);
    setError(null);

    try {
      const pasoActual = await getPasoData(rutaId);

      const updateData: Record<string, any> = {
        estado_paso: nuevoEstado,
      };

      if (nuevoEstado === 'en_proceso' && !pasoActual.fecha_inicio) {
        updateData.fecha_inicio = new Date().toISOString();
      }

      if ((nuevoEstado === 'completado' || nuevoEstado === 'omitido') && !pasoActual.fecha_fin) {
        updateData.fecha_fin = new Date().toISOString();
      }

      if (responsableId) {
        updateData.responsable_id = responsableId;
      }

      if (notas !== undefined) {
        updateData.notas = notas;
      }

      const { error: updateError } = await supabase
        .from('ordenes_trabajo_items_rutas')
        .update(updateData)
        .eq('id', rutaId);

      if (updateError) {
        console.error('Error updating paso status:', updateError);
        setError(updateError.message);
        return false;
      }

      return true;
    } catch (err) {
      console.error('Error in updatePasoStatus:', err);
      setError(err instanceof Error ? err.message : 'Error desconocido');
      return false;
    } finally {
      setUpdating(false);
    }
  };

  return {
    updatePasoStatus,
    updating,
    error,
  };
}
