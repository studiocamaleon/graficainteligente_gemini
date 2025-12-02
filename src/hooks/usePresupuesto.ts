import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type {
  Presupuesto,
  PresupuestoConRelaciones,
  UpdatePresupuestoData,
} from '../types/presupuestos';

export function usePresupuesto(id: string | undefined) {
  const [presupuesto, setPresupuesto] = useState<PresupuestoConRelaciones | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      fetchPresupuesto();
    } else {
      setPresupuesto(null);
      setLoading(false);
    }
  }, [id]);

  const fetchPresupuesto = async () => {
    if (!id) return;

    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('presupuestos')
        .select(
          `
          *,
          cliente:clients!cliente_id (
            id,
            razon_social,
            nombre_fantasia,
            email,
            telefono,
            cuit,
            direccion
          ),
          vendedor:profiles!vendedor_id (
            id,
            full_name,
            email,
            role
          ),
          orden_trabajo:ordenes_trabajo!orden_trabajo_id (
            id,
            numero_orden,
            estado,
            fecha_creacion,
            fecha_estimada_entrega
          )
        `
        )
        .eq('id', id)
        .single();

      if (fetchError) throw fetchError;

      // Obtener conteo de items
      const { count: itemsCount } = await supabase
        .from('presupuestos_items')
        .select('*', { count: 'exact', head: true })
        .eq('presupuesto_id', id);

      // Obtener conteo de archivos
      const { count: archivosCount } = await supabase
        .from('presupuestos_archivos')
        .select('*', { count: 'exact', head: true })
        .eq('presupuesto_id', id);

      setPresupuesto({
        ...(data as PresupuestoConRelaciones),
        items_count: itemsCount || 0,
        archivos_count: archivosCount || 0,
      });
    } catch (err: any) {
      console.error('Error fetching presupuesto:', err);
      setError(err.message);
      setPresupuesto(null);
    } finally {
      setLoading(false);
    }
  };

  const updatePresupuesto = async (data: UpdatePresupuestoData): Promise<boolean> => {
    if (!id) return false;

    try {
      setError(null);

      const { error: updateError } = await supabase
        .from('presupuestos')
        .update(data)
        .eq('id', id);

      if (updateError) throw updateError;

      await fetchPresupuesto();
      return true;
    } catch (err: any) {
      console.error('Error updating presupuesto:', err);
      setError(err.message);
      return false;
    }
  };

  const cambiarEstado = async (nuevoEstado: Presupuesto['estado']): Promise<boolean> => {
    if (!id) return false;

    try {
      setError(null);

      const updateData: UpdatePresupuestoData = { estado: nuevoEstado };

      // Agregar timestamps según estado
      if (nuevoEstado === 'enviado') {
        updateData.fecha_enviado = new Date().toISOString();
      } else if (nuevoEstado === 'aprobado' || nuevoEstado === 'rechazado') {
        updateData.fecha_respuesta = new Date().toISOString();
      }

      return await updatePresupuesto(updateData);
    } catch (err: any) {
      console.error('Error cambiando estado:', err);
      setError(err.message);
      return false;
    }
  };

  const generarPDF = async (): Promise<{ pdfPath: string; pdfUrl: string } | null> => {
    // TODO: Implementar en Fase 7
    console.log('generarPDF: Pendiente de implementación en Fase 7');
    return null;
  };

  const enviarWhatsApp = async (): Promise<boolean> => {
    // TODO: Implementar en Fase 8
    console.log('enviarWhatsApp: Pendiente de implementación en Fase 8');
    return false;
  };

  return {
    presupuesto,
    loading,
    error,
    refetch: fetchPresupuesto,
    updatePresupuesto,
    cambiarEstado,
    generarPDF,
    enviarWhatsApp,
  };
}
