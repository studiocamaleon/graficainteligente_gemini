import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import type {
  CondicionComercial,
  CreateCondicionComercialData,
  UpdateCondicionComercialData,
} from '../types/presupuestos';

export function useCondicionesComerciales() {
  const { user } = useAuth();
  const [condiciones, setCondiciones] = useState<CondicionComercial[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchCondiciones();
    }
  }, [user]);

  const fetchCondiciones = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('presupuestos_condiciones_comerciales')
        .select('*')
        .order('orden', { ascending: true })
        .order('nombre', { ascending: true });

      if (fetchError) throw fetchError;

      setCondiciones((data as CondicionComercial[]) || []);
    } catch (err: any) {
      console.error('Error fetching condiciones:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchCondicionesActivas = async (): Promise<CondicionComercial[]> => {
    try {
      const { data, error: fetchError } = await supabase
        .from('presupuestos_condiciones_comerciales')
        .select('*')
        .eq('is_active', true)
        .order('orden', { ascending: true });

      if (fetchError) throw fetchError;

      return (data as CondicionComercial[]) || [];
    } catch (err: any) {
      console.error('Error fetching condiciones activas:', err);
      return [];
    }
  };

  const getCondicionDefault = async (): Promise<CondicionComercial | null> => {
    try {
      const { data, error: fetchError } = await supabase
        .from('presupuestos_condiciones_comerciales')
        .select('*')
        .eq('es_default', true)
        .eq('is_active', true)
        .single();

      if (fetchError) {
        // Si no hay default, retornar la primera activa
        const activas = await fetchCondicionesActivas();
        return activas.length > 0 ? activas[0] : null;
      }

      return data as CondicionComercial;
    } catch (err: any) {
      console.error('Error fetching condicion default:', err);
      return null;
    }
  };

  const createCondicion = async (
    data: CreateCondicionComercialData
  ): Promise<CondicionComercial | null> => {
    try {
      setError(null);

      // Si se marca como default, desmarcar las demás
      if (data.es_default) {
        await supabase
          .from('presupuestos_condiciones_comerciales')
          .update({ es_default: false })
          .eq('es_default', true);
      }

      const { data: newCondicion, error: createError } = await supabase
        .from('presupuestos_condiciones_comerciales')
        .insert({
          ...data,
          orden: data.orden ?? 0,
          is_active: data.is_active ?? true,
          es_default: data.es_default ?? false,
        })
        .select()
        .single();

      if (createError) throw createError;

      await fetchCondiciones();
      return newCondicion as CondicionComercial;
    } catch (err: any) {
      console.error('Error creating condicion:', err);
      setError(err.message);
      return null;
    }
  };

  const updateCondicion = async (
    id: string,
    data: UpdateCondicionComercialData
  ): Promise<boolean> => {
    try {
      setError(null);

      // Si se marca como default, desmarcar las demás
      if (data.es_default === true) {
        await supabase
          .from('presupuestos_condiciones_comerciales')
          .update({ es_default: false })
          .eq('es_default', true)
          .neq('id', id);
      }

      const { error: updateError } = await supabase
        .from('presupuestos_condiciones_comerciales')
        .update(data)
        .eq('id', id);

      if (updateError) throw updateError;

      await fetchCondiciones();
      return true;
    } catch (err: any) {
      console.error('Error updating condicion:', err);
      setError(err.message);
      return false;
    }
  };

  const deleteCondicion = async (id: string): Promise<boolean> => {
    try {
      setError(null);

      // Verificar que no sea la única activa
      const activas = condiciones.filter(
        (c) => c.is_active && c.id !== id
      );

      if (activas.length === 0) {
        throw new Error(
          'No se puede eliminar la única condición comercial activa'
        );
      }

      const { error: deleteError } = await supabase
        .from('presupuestos_condiciones_comerciales')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;

      await fetchCondiciones();
      return true;
    } catch (err: any) {
      console.error('Error deleting condicion:', err);
      setError(err.message);
      return false;
    }
  };

  const toggleActivo = async (id: string): Promise<boolean> => {
    try {
      setError(null);

      const condicion = condiciones.find((c) => c.id === id);
      if (!condicion) throw new Error('Condición no encontrada');

      // Si se está desactivando, verificar que no sea la única activa
      if (condicion.is_active) {
        const activas = condiciones.filter((c) => c.is_active && c.id !== id);
        if (activas.length === 0) {
          throw new Error(
            'No se puede desactivar la única condición comercial activa'
          );
        }
      }

      return await updateCondicion(id, { is_active: !condicion.is_active });
    } catch (err: any) {
      console.error('Error toggling activo:', err);
      setError(err.message);
      return false;
    }
  };

  const marcarComoDefault = async (id: string): Promise<boolean> => {
    return await updateCondicion(id, { es_default: true });
  };

  const reordenar = async (
    items: Array<{ id: string; orden: number }>
  ): Promise<boolean> => {
    try {
      setError(null);

      // Actualizar orden de cada item
      const updates = items.map((item) =>
        supabase
          .from('presupuestos_condiciones_comerciales')
          .update({ orden: item.orden })
          .eq('id', item.id)
      );

      await Promise.all(updates);

      await fetchCondiciones();
      return true;
    } catch (err: any) {
      console.error('Error reordenando condiciones:', err);
      setError(err.message);
      return false;
    }
  };

  const duplicarCondicion = async (id: string): Promise<CondicionComercial | null> => {
    try {
      setError(null);

      const condicion = condiciones.find((c) => c.id === id);
      if (!condicion) throw new Error('Condición no encontrada');

      const nuevaCondicion: CreateCondicionComercialData = {
        nombre: `${condicion.nombre} (Copia)`,
        contenido: condicion.contenido,
        es_default: false,
        orden: condicion.orden + 1,
        is_active: true,
      };

      return await createCondicion(nuevaCondicion);
    } catch (err: any) {
      console.error('Error duplicando condicion:', err);
      setError(err.message);
      return null;
    }
  };

  return {
    condiciones,
    loading,
    error,
    refetch: fetchCondiciones,
    fetchCondicionesActivas,
    getCondicionDefault,
    createCondicion,
    updateCondicion,
    deleteCondicion,
    toggleActivo,
    marcarComoDefault,
    reordenar,
    duplicarCondicion,
  };
}
