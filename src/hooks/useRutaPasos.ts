import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type {
  RutaProduccionPaso,
  RutaProduccionPasoFormData,
  EtapaPaso,
} from '../types/database';

interface UseRutaPasosParams {
  rutaId: string | null;
  etapa?: EtapaPaso | null;
}

interface UseRutaPasosResult {
  pasos: RutaProduccionPaso[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  addPaso: (data: RutaProduccionPasoFormData) => Promise<boolean>;
  updatePaso: (id: string, data: Partial<RutaProduccionPasoFormData>) => Promise<boolean>;
  deletePaso: (id: string) => Promise<boolean>;
  reorderPasos: (etapa: EtapaPaso, pasos: RutaProduccionPaso[]) => Promise<boolean>;
}

export function useRutaPasos({
  rutaId,
  etapa = null,
}: UseRutaPasosParams): UseRutaPasosResult {
  const [pasos, setPasos] = useState<RutaProduccionPaso[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPasos = async () => {
    if (!rutaId) {
      setPasos([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from('rutas_produccion_pasos')
        .select(`
          *,
          paso:pasos!left(
            id,
            nombre,
            estacion_id
          )
        `)
        .eq('ruta_id', rutaId);

      if (etapa) {
        query = query.eq('etapa', etapa);
      }

      query = query.order('etapa').order('orden');

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;

      // Enriquecer con datos de servicios, acabados y tecnologías
      const enrichedData = await Promise.all(
        (data || []).map(async (paso) => {
          const config = paso.configuracion_condicion as any;
          const enrichedPaso: RutaProduccionPaso = { ...paso };

          // Obtener servicio si existe en la configuración
          if (config?.servicio_id) {
            const { data: servicioData } = await supabase
              .from('servicios')
              .select('id, nombre')
              .eq('id', config.servicio_id)
              .maybeSingle();
            enrichedPaso.servicio = servicioData;
          }

          // Obtener acabado si existe en la configuración
          if (config?.acabado_id) {
            const { data: acabadoData } = await supabase
              .from('acabados')
              .select('id, nombre')
              .eq('id', config.acabado_id)
              .maybeSingle();
            enrichedPaso.acabado = acabadoData;
          }

          // Obtener tecnología si existe en la configuración
          if (config?.tecnologia_id) {
            const { data: tecnologiaData } = await supabase
              .from('tecnologias')
              .select('id, nombre')
              .eq('id', config.tecnologia_id)
              .maybeSingle();
            enrichedPaso.tecnologia = tecnologiaData;
          }

          return enrichedPaso;
        })
      );

      setPasos(enrichedData);
    } catch (err) {
      console.error('Error fetching pasos de ruta:', err);
      setError(err instanceof Error ? err.message : 'Error desconocido');
      setPasos([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPasos();
  }, [rutaId, etapa]);

  const addPaso = async (data: RutaProduccionPasoFormData): Promise<boolean> => {
    if (!rutaId) {
      setError('No se ha seleccionado una ruta');
      return false;
    }

    try {
      setLoading(true);
      setError(null);

      const insertData: Record<string, unknown> = {
        ruta_id: rutaId,
        etapa: data.etapa,
        orden: data.orden,
        es_obligatorio: data.es_obligatorio,
        tipo_condicion: data.tipo_condicion,
        configuracion_condicion: data.configuracion_condicion,
      };

      if (data.paso_id !== null) {
        insertData.paso_id = data.paso_id;
      }

      const { error: insertError } = await supabase
        .from('rutas_produccion_pasos')
        .insert(insertData);

      if (insertError) throw insertError;

      await fetchPasos();
      return true;
    } catch (err) {
      console.error('Error adding paso to ruta:', err);
      setError(err instanceof Error ? err.message : 'Error desconocido');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const updatePaso = async (
    id: string,
    data: Partial<RutaProduccionPasoFormData>
  ): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);

      const updateData: Record<string, unknown> = {};
      if (data.paso_id !== undefined) {
        updateData.paso_id = data.paso_id === null ? null : data.paso_id;
      }
      if (data.orden !== undefined) updateData.orden = data.orden;
      if (data.es_obligatorio !== undefined)
        updateData.es_obligatorio = data.es_obligatorio;
      if (data.tipo_condicion !== undefined)
        updateData.tipo_condicion = data.tipo_condicion;
      if (data.configuracion_condicion !== undefined)
        updateData.configuracion_condicion = data.configuracion_condicion;

      const { error: updateError } = await supabase
        .from('rutas_produccion_pasos')
        .update(updateData)
        .eq('id', id);

      if (updateError) throw updateError;

      await fetchPasos();
      return true;
    } catch (err) {
      console.error('Error updating paso:', err);
      setError(err instanceof Error ? err.message : 'Error desconocido');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const deletePaso = async (id: string): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);

      const { error: deleteError } = await supabase
        .from('rutas_produccion_pasos')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;

      await fetchPasos();
      return true;
    } catch (err) {
      console.error('Error deleting paso:', err);
      setError(err instanceof Error ? err.message : 'Error desconocido');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const reorderPasos = async (
    etapa: EtapaPaso,
    pasosReordenados: RutaProduccionPaso[]
  ): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);

      const updates = pasosReordenados.map((paso, index) => ({
        id: paso.id,
        orden: index,
      }));

      for (const update of updates) {
        const { error: updateError } = await supabase
          .from('rutas_produccion_pasos')
          .update({ orden: update.orden })
          .eq('id', update.id);

        if (updateError) throw updateError;
      }

      await fetchPasos();
      return true;
    } catch (err) {
      console.error('Error reordering pasos:', err);
      setError(err instanceof Error ? err.message : 'Error desconocido');
      return false;
    } finally {
      setLoading(false);
    }
  };

  return {
    pasos,
    loading,
    error,
    refetch: fetchPasos,
    addPaso,
    updatePaso,
    deletePaso,
    reorderPasos,
  };
}
