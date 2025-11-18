import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import type { RutaProduccion, RutaProduccionFormData } from '../types/database';

interface UseRutaProduccionResult {
  loading: boolean;
  error: string | null;
  createRuta: (data: RutaProduccionFormData) => Promise<RutaProduccion | null>;
  updateRuta: (id: string, data: Partial<RutaProduccionFormData>) => Promise<boolean>;
  toggleRutaStatus: (id: string, currentStatus: boolean) => Promise<boolean>;
  deleteRuta: (id: string) => Promise<boolean>;
  duplicateRuta: (id: string) => Promise<RutaProduccion | null>;
}

export function useRutaProduccion(): UseRutaProduccionResult {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createRuta = async (
    data: RutaProduccionFormData
  ): Promise<RutaProduccion | null> => {
    if (!profile?.company_id) {
      setError('No se encontró el company_id del usuario');
      return null;
    }

    try {
      setLoading(true);
      setError(null);

      const { data: newRuta, error: createError } = await supabase
        .from('rutas_produccion')
        .insert({
          company_id: profile.company_id,
          nombre: data.nombre,
          descripcion: data.descripcion || null,
          is_active: true,
        })
        .select()
        .single();

      if (createError) throw createError;

      return newRuta;
    } catch (err) {
      console.error('Error creating ruta:', err);
      setError(err instanceof Error ? err.message : 'Error desconocido');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const updateRuta = async (
    id: string,
    data: Partial<RutaProduccionFormData>
  ): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);

      const updateData: Record<string, unknown> = {};
      if (data.nombre !== undefined) updateData.nombre = data.nombre;
      if (data.descripcion !== undefined) updateData.descripcion = data.descripcion || null;

      const { error: updateError } = await supabase
        .from('rutas_produccion')
        .update(updateData)
        .eq('id', id);

      if (updateError) throw updateError;

      return true;
    } catch (err) {
      console.error('Error updating ruta:', err);
      setError(err instanceof Error ? err.message : 'Error desconocido');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const toggleRutaStatus = async (
    id: string,
    currentStatus: boolean
  ): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);

      const { error: updateError } = await supabase
        .from('rutas_produccion')
        .update({ is_active: !currentStatus })
        .eq('id', id);

      if (updateError) throw updateError;

      return true;
    } catch (err) {
      console.error('Error toggling ruta status:', err);
      setError(err instanceof Error ? err.message : 'Error desconocido');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const deleteRuta = async (id: string): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);

      const { error: deleteError } = await supabase
        .from('rutas_produccion')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;

      return true;
    } catch (err) {
      console.error('Error deleting ruta:', err);
      setError(err instanceof Error ? err.message : 'Error desconocido');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const duplicateRuta = async (id: string): Promise<RutaProduccion | null> => {
    if (!profile?.company_id) {
      setError('No se encontró el company_id del usuario');
      return null;
    }

    try {
      setLoading(true);
      setError(null);

      const { data: originalRuta, error: fetchError } = await supabase
        .from('rutas_produccion')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError) throw fetchError;
      if (!originalRuta) throw new Error('Ruta no encontrada');

      const { data: pasos, error: pasosError } = await supabase
        .from('rutas_produccion_pasos')
        .select('*')
        .eq('ruta_id', id)
        .order('etapa')
        .order('orden');

      if (pasosError) throw pasosError;

      const { data: newRuta, error: createError } = await supabase
        .from('rutas_produccion')
        .insert({
          company_id: profile.company_id,
          nombre: `${originalRuta.nombre} (Copia)`,
          descripcion: originalRuta.descripcion,
          is_active: false,
        })
        .select()
        .single();

      if (createError) throw createError;
      if (!newRuta) throw new Error('Error creando la copia de la ruta');

      if (pasos && pasos.length > 0) {
        const pasosCopia = pasos.map((paso) => ({
          ruta_id: newRuta.id,
          etapa: paso.etapa,
          paso_id: paso.paso_id,
          orden: paso.orden,
          es_obligatorio: paso.es_obligatorio,
          tipo_condicion: paso.tipo_condicion,
          configuracion_condicion: paso.configuracion_condicion,
        }));

        const { error: insertPasosError } = await supabase
          .from('rutas_produccion_pasos')
          .insert(pasosCopia);

        if (insertPasosError) throw insertPasosError;
      }

      return newRuta;
    } catch (err) {
      console.error('Error duplicating ruta:', err);
      setError(err instanceof Error ? err.message : 'Error desconocido');
      return null;
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    error,
    createRuta,
    updateRuta,
    toggleRutaStatus,
    deleteRuta,
    duplicateRuta,
  };
}
