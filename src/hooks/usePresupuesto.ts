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

      // Configurar suscripción Realtime para actualizaciones externas
      const channel = supabase
        .channel(`presupuesto_detail_${id}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'presupuestos',
            filter: `id=eq.${id}`,
          },
          (payload) => {
            console.log('Presupuesto actualizado en Realtime:', payload);
            fetchPresupuesto();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
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
            whatsapp,
            tipo_documento,
            numero_documento,
            domicilio
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

      // Obtener items completos
      const { data: items, error: itemsError } = await supabase
        .from('presupuestos_items')
        .select('*')
        .eq('presupuesto_id', id)
        .order('created_at', { ascending: true });

      if (itemsError) {
        console.error('Error fetching items:', itemsError);
      }

      // Obtener rutas de los items
      const { data: routes, error: routesError } = await supabase
        .from('presupuestos_items_rutas')
        .select('*')
        .in('presupuesto_item_id', (items as any[])?.map(i => i.id) || [])
        .order('orden', { ascending: true });

      if (routesError) {
        console.error('Error fetching items routes:', routesError);
      }

      // Obtener conteo de archivos
      const { count: archivosCount } = await supabase
        .from('presupuestos_archivos')
        .select('*', { count: 'exact', head: true })
        .eq('presupuesto_id', id);

      // Obtener servicios
      const { data: servicios, error: serviciosError } = await (supabase as any)
        .from('presupuestos_servicios')
        .select('*')
        .eq('presupuesto_id', id);

      if (serviciosError) console.error('Error fetching servicios:', serviciosError);

      const mappedServicios = ((servicios as any[]) || []).map(s => ({
        id: s.id,
        presupuesto_id: id,
        tipo_item: 'item_personalizado' as const,
        producto_nombre: s.descripcion,
        producto_categoria: 'Servicio Adicional',
        configuracion: {},
        cantidad: Number(s.cantidad),
        precio_base: 0,
        precio_servicios: 0,
        precio_acabados: 0,
        precio_unitario_final: Number(s.precio_unitario),
        precio_total: Number(s.subtotal),
        descripcion: s.descripcion,
        created_at: s.created_at,
        updated_at: s.created_at,
        rutas_generadas: []
      }));

      // Mapear rutas a los items
      const itemsWithRoutes = ((items as any[]) || []).map(item => ({
        ...item,
        rutas_generadas: ((routes as any[]) || [])
          .filter(r => r.presupuesto_item_id === item.id)
          .map(r => ({
            id: r.id,
            etapa: r.tipo_etapa,
            paso_id: r.paso_id,
            paso_nombre: r.paso_nombre,
            orden: r.orden,
            es_obligatorio: true,
            comentario_vendedor: r.comentario_vendedor,
            _db_id: r.id
          }))
      }));

      setPresupuesto({
        ...(data as any),
        items: [...itemsWithRoutes, ...mappedServicios],
        items_count: (items?.length || 0) + mappedServicios.length,
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

      const { error: updateError } = await (supabase as any)
        .from('presupuestos')
        .update(data as any)
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

      return await updatePresupuesto(updateData as any);
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
