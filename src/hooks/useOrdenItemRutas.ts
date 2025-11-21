import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import type { OrdenItemRuta, TipoEtapaRuta } from '../types/database';

/**
 * Normaliza el valor de tipo_etapa a uno de los valores válidos del enum
 * Esta función asegura que los datos existentes en BD se lean correctamente
 *
 * IMPORTANTE: El orden de las verificaciones es crítico para evitar falsos positivos
 */
function normalizarTipoEtapa(etapa: string): TipoEtapaRuta {
  const etapaLower = etapa.toLowerCase().replace(/[-\s]/g, '_');

  // 1. Si ya está normalizado, devolver sin cambios
  if (etapaLower === 'pre_prensa' || etapaLower === 'principal' || etapaLower === 'post_prensa') {
    return etapaLower as TipoEtapaRuta;
  }

  // 2. Post-prensa (verificar ANTES que pre para evitar que "post_prensa" sea capturado por "pre")
  if (etapaLower.includes('post') ||
      etapaLower.includes('terminacion') ||
      etapaLower.includes('acabado')) {
    return 'post_prensa';
  }

  // 3. Pre-prensa (usar condiciones más específicas)
  if (etapaLower.startsWith('pre') || etapaLower.includes('_pre_')) {
    return 'pre_prensa';
  }

  // 4. Principal por defecto (producción, impresión, etc.)
  return 'principal';
}

interface UseOrdenItemRutasOptions {
  ordenItemId?: string;
}

interface CreateRutaData {
  orden_item_id: string;
  tipo_etapa: TipoEtapaRuta;
  paso_id?: string | null;
  paso_nombre: string;
  orden: number;
  es_modificado?: boolean;
  origen_plantilla_id?: string | null;
  comentario_vendedor?: string | null;
}

interface UpdateRutaData {
  tipo_etapa?: TipoEtapaRuta;
  paso_id?: string | null;
  paso_nombre?: string;
  orden?: number;
  es_modificado?: boolean;
  comentario_vendedor?: string | null;
}

export function useOrdenItemRutas(options: UseOrdenItemRutasOptions = {}) {
  const { profile } = useAuth();
  const [rutas, setRutas] = useState<OrdenItemRuta[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRutas = useCallback(async () => {
    if (!options.ordenItemId) {
      console.log('⚠️ fetchRutas: No ordenItemId provided');
      setRutas([]);
      return;
    }

    console.log('📥 fetchRutas: Consultando rutas para ordenItemId:', options.ordenItemId);

    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('ordenes_trabajo_items_rutas')
        .select(`
          *,
          responsable:profiles!ordenes_trabajo_items_rutas_responsable_id_fkey(
            full_name
          )
        `)
        .eq('orden_item_id', options.ordenItemId)
        .order('tipo_etapa', { ascending: true })
        .order('orden', { ascending: true });

      if (fetchError) {
        console.error('❌ fetchRutas error:', fetchError);
        throw fetchError;
      }

      console.log(`✅ fetchRutas: ${data?.length || 0} rutas encontradas para item ${options.ordenItemId}`);
      if (data && data.length > 0) {
        console.log('📋 Detalle de rutas encontradas (valores originales):');
        console.table(data.map(r => ({
          id: r.id.substring(0, 8),
          tipo_etapa: r.tipo_etapa,
          paso_nombre: r.paso_nombre,
          orden: r.orden
        })));
      }

      // Normalizar tipo_etapa al leer para manejar datos legacy
      const rutasNormalizadas = (data || []).map((ruta: any) => {
        const etapaNormalizada = normalizarTipoEtapa(ruta.tipo_etapa);
        if (ruta.tipo_etapa !== etapaNormalizada) {
          console.log(`🔄 Normalizando etapa: "${ruta.tipo_etapa}" → "${etapaNormalizada}"`);
        }

        // Extraer nombre del responsable si existe
        const responsableNombre = ruta.responsable?.full_name || null;

        // Remover el objeto anidado responsable y agregar solo el nombre
        const { responsable, ...rutaLimpia } = ruta;

        return {
          ...rutaLimpia,
          tipo_etapa: etapaNormalizada,
          responsable_nombre: responsableNombre
        };
      });

      setRutas(rutasNormalizadas);
    } catch (err) {
      console.error('❌ Error fetching rutas:', err);
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  }, [options.ordenItemId]);

  useEffect(() => {
    fetchRutas();
  }, [fetchRutas]);

  const createRuta = async (data: CreateRutaData): Promise<OrdenItemRuta | null> => {
    if (!profile?.company_id) {
      throw new Error('No hay company_id disponible');
    }

    try {
      const { data: newRuta, error: createError } = await supabase
        .from('ordenes_trabajo_items_rutas')
        .insert([{
          ...data,
          company_id: profile.company_id,
        }])
        .select()
        .single();

      if (createError) throw createError;

      await fetchRutas();
      return newRuta;
    } catch (err) {
      console.error('Error creating ruta:', err);
      throw err;
    }
  };

  const updateRuta = async (id: string, updates: UpdateRutaData): Promise<OrdenItemRuta | null> => {
    try {
      const { data: updated, error: updateError } = await supabase
        .from('ordenes_trabajo_items_rutas')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (updateError) throw updateError;

      await fetchRutas();
      return updated;
    } catch (err) {
      console.error('Error updating ruta:', err);
      throw err;
    }
  };

  const deleteRuta = async (id: string): Promise<void> => {
    try {
      const { error: deleteError } = await supabase
        .from('ordenes_trabajo_items_rutas')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;

      await fetchRutas();
    } catch (err) {
      console.error('Error deleting ruta:', err);
      throw err;
    }
  };

  const copiarRutaDesdePlantilla = async (
    ordenItemId: string,
    productoId: string
  ): Promise<number> => {
    if (!profile?.company_id) {
      throw new Error('No hay company_id disponible');
    }

    try {
      const { data, error } = await supabase.rpc('fn_copiar_ruta_desde_plantilla', {
        p_orden_item_id: ordenItemId,
        p_producto_id: productoId,
        p_company_id: profile.company_id,
      });

      if (error) throw error;

      await fetchRutas();
      return data as number;
    } catch (err) {
      console.error('Error copiando ruta desde plantilla:', err);
      throw err;
    }
  };

  const reordenarRutas = async (rutasReordenadas: Array<{ id: string; orden: number }>): Promise<void> => {
    try {
      const updates = rutasReordenadas.map(({ id, orden }) =>
        supabase
          .from('ordenes_trabajo_items_rutas')
          .update({ orden, es_modificado: true })
          .eq('id', id)
      );

      await Promise.all(updates);
      await fetchRutas();
    } catch (err) {
      console.error('Error reordering rutas:', err);
      throw err;
    }
  };

  const updateComentario = async (id: string, comentario: string | null): Promise<void> => {
    try {
      const { error: updateError } = await supabase
        .from('ordenes_trabajo_items_rutas')
        .update({ comentario_vendedor: comentario })
        .eq('id', id);

      if (updateError) throw updateError;

      await fetchRutas();
    } catch (err) {
      console.error('Error updating comentario:', err);
      throw err;
    }
  };

  const deleteAllRutas = async (ordenItemId: string): Promise<void> => {
    try {
      const { error: deleteError } = await supabase
        .from('ordenes_trabajo_items_rutas')
        .delete()
        .eq('orden_item_id', ordenItemId);

      if (deleteError) throw deleteError;

      await fetchRutas();
    } catch (err) {
      console.error('Error deleting all rutas:', err);
      throw err;
    }
  };

  const getRutasPorEtapa = useCallback(() => {
    return {
      pre_prensa: rutas.filter(r => r.tipo_etapa === 'pre_prensa'),
      principal: rutas.filter(r => r.tipo_etapa === 'principal'),
      post_prensa: rutas.filter(r => r.tipo_etapa === 'post_prensa'),
    };
  }, [rutas]);

  return {
    rutas,
    loading,
    error,
    createRuta,
    updateRuta,
    deleteRuta,
    copiarRutaDesdePlantilla,
    reordenarRutas,
    updateComentario,
    deleteAllRutas,
    getRutasPorEtapa,
    refetch: fetchRutas,
  };
}
