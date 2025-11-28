import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type {
  RutaProduccionPaso,
  RutaProduccionPasoFormData,
  EtapaPaso,
} from '../types/database';

// Normalizar valores de etapa legacy a los valores correctos
const normalizeEtapa = (etapa: string): EtapaPaso => {
  const mapping: Record<string, EtapaPaso> = {
    'pre_prensa': 'Pre-prensa',
    'principal': 'Produccion',
    'produccion': 'Produccion',
    'post_prensa': 'Terminacion',
    'terminacion': 'Terminacion',
    'instalacion': 'Instalacion',
    'entrega': 'Entrega',
  };

  const normalized = mapping[etapa.toLowerCase()];
  if (normalized) {
    console.log(`[useRutaPasos] Normalizing etapa: "${etapa}" -> "${normalized}"`);
    return normalized;
  }

  // Si ya está en el formato correcto, retornarlo
  console.log(`[useRutaPasos] Etapa ya está normalizada: "${etapa}"`);
  return etapa as EtapaPaso;
};

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
      console.log('[useRutaPasos] No rutaId provided, skipping fetch');
      setPasos([]);
      setLoading(false);
      return;
    }

    console.log('[useRutaPasos] Fetching pasos for:', { rutaId, etapa });

    try {
      setLoading(true);
      setError(null);

      // Verificar sesión activa
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.error('[useRutaPasos] No active session');
        setError('No hay sesión activa');
        setPasos([]);
        setLoading(false);
        return;
      }

      let query = supabase
        .from('rutas_produccion_pasos')
        .select(`
          *,
          paso:pasos(
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

      console.log('[useRutaPasos] Executing query...');
      const { data, error: fetchError } = await query;

      console.log('[useRutaPasos] Query result:', {
        recordCount: data?.length || 0,
        hasError: !!fetchError,
        errorMessage: fetchError?.message,
        firstRecord: data?.[0]
      });

      if (fetchError) {
        console.error('[useRutaPasos] Supabase query error:', fetchError);
        throw fetchError;
      }

      // Enriquecer con datos de servicios, acabados y tecnologías
      console.log('[useRutaPasos] Enriching data with related entities...');
      const enrichedData = await Promise.all(
        (data || []).map(async (paso) => {
          const config = paso.configuracion_condicion as any;
          const enrichedPaso: RutaProduccionPaso = {
            ...paso,
            etapa: normalizeEtapa(paso.etapa) // Normalizar valores legacy
          };

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

      console.log('[useRutaPasos] Enriched data ready:', {
        total: enrichedData.length,
        porEtapa: enrichedData.reduce((acc, paso) => {
          acc[paso.etapa] = (acc[paso.etapa] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      });

      // Log detallado de TODAS las etapas para debugging
      console.log('[useRutaPasos] Detalle de todas las etapas encontradas:');
      enrichedData.forEach((paso, index) => {
        console.log(`  [${index}] Etapa: "${paso.etapa}" | ID: ${paso.id.slice(0, 8)} | Orden: ${paso.orden}`);
      });

      setPasos(enrichedData);
    } catch (err) {
      console.error('[useRutaPasos] Error fetching pasos:', {
        error: err,
        rutaId,
        etapa,
        message: err instanceof Error ? err.message : 'Unknown error',
        details: err
      });
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
    console.log('[useRutaPasos.addPaso] ===== INICIO =====');
    console.log('[useRutaPasos.addPaso] rutaId:', rutaId);
    console.log('[useRutaPasos.addPaso] data recibida:', JSON.stringify(data, null, 2));

    if (!rutaId) {
      console.error('[useRutaPasos.addPaso] ❌ Error: No hay rutaId');
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
        console.log('[useRutaPasos.addPaso] paso_id incluido:', data.paso_id);
      } else {
        console.log('[useRutaPasos.addPaso] paso_id es NULL (mapeo múltiple)');
      }

      console.log('[useRutaPasos.addPaso] insertData preparado:', JSON.stringify(insertData, null, 2));
      console.log('[useRutaPasos.addPaso] Ejecutando INSERT en Supabase...');

      const { data: insertedData, error: insertError } = await supabase
        .from('rutas_produccion_pasos')
        .insert(insertData)
        .select();

      if (insertError) {
        console.error('[useRutaPasos.addPaso] ❌ ERROR de Supabase:', {
          message: insertError.message,
          code: insertError.code,
          details: insertError.details,
          hint: insertError.hint,
          fullError: insertError
        });
        throw insertError;
      }

      console.log('[useRutaPasos.addPaso] ✅ INSERT exitoso. Registro creado:', insertedData);
      console.log('[useRutaPasos.addPaso] Recargando pasos...');
      await fetchPasos();
      console.log('[useRutaPasos.addPaso] ✅ Pasos recargados exitosamente');
      return true;
    } catch (err) {
      console.error('[useRutaPasos.addPaso] ❌ EXCEPCIÓN CAPTURADA:');
      console.error('[useRutaPasos.addPaso] Error object:', err);
      console.error('[useRutaPasos.addPaso] Error type:', typeof err);
      console.error('[useRutaPasos.addPaso] Error constructor:', err?.constructor?.name);

      if (err && typeof err === 'object') {
        const errorObj = err as any;
        console.error('[useRutaPasos.addPaso] Error properties:', {
          message: errorObj.message,
          code: errorObj.code,
          details: errorObj.details,
          hint: errorObj.hint,
          stack: errorObj.stack
        });
      }

      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      console.error('[useRutaPasos.addPaso] Mensaje de error:', errorMessage);
      setError(errorMessage);
      return false;
    } finally {
      setLoading(false);
      console.log('[useRutaPasos.addPaso] ===== FIN =====');
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
