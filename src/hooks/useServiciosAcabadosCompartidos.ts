import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export type MetodoProrrateo = 'proporcional' | 'uniforme' | 'manual';

export interface ServicioCompartido {
  id: string;
  servicio_id: string;
  configuracion: Record<string, any>;
  metodo_prorrateo: MetodoProrrateo;
  prorrateos: Record<string, number>;
  precio_total: number;
  notas?: string;
  created_at: string;
  updated_at: string;
}

export interface AcabadoCompartido {
  id: string;
  acabado_id: string;
  configuracion: Record<string, any>;
  metodo_prorrateo: MetodoProrrateo;
  prorrateos: Record<string, number>;
  precio_total: number;
  notas?: string;
  created_at: string;
  updated_at: string;
}

interface AddServicioCompartidoParams {
  servicio_id: string;
  configuracion?: Record<string, any>;
  metodo_prorrateo?: MetodoProrrateo;
  prorrateos?: Record<string, number>;
  precio_total: number;
  notas?: string;
}

interface AddAcabadoCompartidoParams {
  acabado_id: string;
  configuracion?: Record<string, any>;
  metodo_prorrateo?: MetodoProrrateo;
  prorrateos?: Record<string, number>;
  precio_total: number;
  notas?: string;
}

interface UseServiciosAcabadosCompartidosParams {
  tipo: 'orden' | 'presupuesto';
  id: string;
}

export function useServiciosAcabadosCompartidos({
  tipo,
  id
}: UseServiciosAcabadosCompartidosParams) {
  const [serviciosCompartidos, setServiciosCompartidos] = useState<ServicioCompartido[]>([]);
  const [acabadosCompartidos, setAcabadosCompartidos] = useState<AcabadoCompartido[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tablaPrefijo = tipo === 'orden' ? 'ordenes_trabajo' : 'presupuestos';
  const idColumn = tipo === 'orden' ? 'orden_trabajo_id' : 'presupuesto_id';

  const fetchServiciosCompartidos = useCallback(async () => {
    if (!id) return;

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from(`${tablaPrefijo}_servicios_compartidos`)
        .select(`
          *,
          servicio:servicios(id, nombre, tipo_impacto)
        `)
        .eq(idColumn, id)
        .order('created_at', { ascending: true });

      if (fetchError) throw fetchError;
      setServiciosCompartidos(data || []);
    } catch (err) {
      console.error('Error fetching servicios compartidos:', err);
      setError(err instanceof Error ? err.message : 'Error al cargar servicios compartidos');
    } finally {
      setIsLoading(false);
    }
  }, [id, tablaPrefijo, idColumn]);

  const fetchAcabadosCompartidos = useCallback(async () => {
    if (!id) return;

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from(`${tablaPrefijo}_acabados_compartidos`)
        .select(`
          *,
          acabado:acabados(id, nombre, tipo_impacto)
        `)
        .eq(idColumn, id)
        .order('created_at', { ascending: true });

      if (fetchError) throw fetchError;
      setAcabadosCompartidos(data || []);
    } catch (err) {
      console.error('Error fetching acabados compartidos:', err);
      setError(err instanceof Error ? err.message : 'Error al cargar acabados compartidos');
    } finally {
      setIsLoading(false);
    }
  }, [id, tablaPrefijo, idColumn]);

  const addServicioCompartido = async (params: AddServicioCompartidoParams) => {
    if (!id) {
      throw new Error(`ID de ${tipo} no válido`);
    }

    setError(null);

    try {
      const { data, error: insertError } = await supabase
        .from(`${tablaPrefijo}_servicios_compartidos`)
        .insert({
          [idColumn]: id,
          servicio_id: params.servicio_id,
          configuracion: params.configuracion || {},
          metodo_prorrateo: params.metodo_prorrateo || 'proporcional',
          prorrateos: params.prorrateos || {},
          precio_total: params.precio_total,
          notas: params.notas
        })
        .select()
        .single();

      if (insertError) throw insertError;

      await fetchServiciosCompartidos();
      return data;
    } catch (err) {
      console.error('Error adding servicio compartido:', err);
      const errorMessage = err instanceof Error ? err.message : 'Error al agregar servicio compartido';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  };

  const addAcabadoCompartido = async (params: AddAcabadoCompartidoParams) => {
    if (!id) {
      throw new Error(`ID de ${tipo} no válido`);
    }

    setError(null);

    try {
      const { data, error: insertError } = await supabase
        .from(`${tablaPrefijo}_acabados_compartidos`)
        .insert({
          [idColumn]: id,
          acabado_id: params.acabado_id,
          configuracion: params.configuracion || {},
          metodo_prorrateo: params.metodo_prorrateo || 'proporcional',
          prorrateos: params.prorrateos || {},
          precio_total: params.precio_total,
          notas: params.notas
        })
        .select()
        .single();

      if (insertError) throw insertError;

      await fetchAcabadosCompartidos();
      return data;
    } catch (err) {
      console.error('Error adding acabado compartido:', err);
      const errorMessage = err instanceof Error ? err.message : 'Error al agregar acabado compartido';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  };

  const updateServicioCompartido = async (
    servicioId: string,
    updates: Partial<AddServicioCompartidoParams>
  ) => {
    setError(null);

    try {
      const { error: updateError } = await supabase
        .from(`${tablaPrefijo}_servicios_compartidos`)
        .update(updates)
        .eq('id', servicioId);

      if (updateError) throw updateError;

      await fetchServiciosCompartidos();
    } catch (err) {
      console.error('Error updating servicio compartido:', err);
      const errorMessage = err instanceof Error ? err.message : 'Error al actualizar servicio compartido';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  };

  const updateAcabadoCompartido = async (
    acabadoId: string,
    updates: Partial<AddAcabadoCompartidoParams>
  ) => {
    setError(null);

    try {
      const { error: updateError } = await supabase
        .from(`${tablaPrefijo}_acabados_compartidos`)
        .update(updates)
        .eq('id', acabadoId);

      if (updateError) throw updateError;

      await fetchAcabadosCompartidos();
    } catch (err) {
      console.error('Error updating acabado compartido:', err);
      const errorMessage = err instanceof Error ? err.message : 'Error al actualizar acabado compartido';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  };

  const deleteServicioCompartido = async (servicioId: string) => {
    setError(null);

    try {
      const { error: deleteError } = await supabase
        .from(`${tablaPrefijo}_servicios_compartidos`)
        .delete()
        .eq('id', servicioId);

      if (deleteError) throw deleteError;

      await fetchServiciosCompartidos();
    } catch (err) {
      console.error('Error deleting servicio compartido:', err);
      const errorMessage = err instanceof Error ? err.message : 'Error al eliminar servicio compartido';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  };

  const deleteAcabadoCompartido = async (acabadoId: string) => {
    setError(null);

    try {
      const { error: deleteError } = await supabase
        .from(`${tablaPrefijo}_acabados_compartidos`)
        .delete()
        .eq('id', acabadoId);

      if (deleteError) throw deleteError;

      await fetchAcabadosCompartidos();
    } catch (err) {
      console.error('Error deleting acabado compartido:', err);
      const errorMessage = err instanceof Error ? err.message : 'Error al eliminar acabado compartido';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  };

  return {
    serviciosCompartidos,
    acabadosCompartidos,
    isLoading,
    error,
    fetchServiciosCompartidos,
    fetchAcabadosCompartidos,
    addServicioCompartido,
    addAcabadoCompartido,
    updateServicioCompartido,
    updateAcabadoCompartido,
    deleteServicioCompartido,
    deleteAcabadoCompartido
  };
}
