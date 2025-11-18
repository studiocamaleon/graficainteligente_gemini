import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';

export interface RangoDetalle {
  min: number;
  max: number | null;
}

/**
 * Nota sobre la lógica de rangos:
 * - Para rangos intermedios: min <= valor < max
 *   Ejemplo: rango de 5 a 10 incluye desde 5.00 hasta 9.99
 * - Para el último rango: min <= valor <= max
 *   Ejemplo: último rango de 100 a 500 incluye desde 100.00 hasta 500.00
 * - Para rangos ilimitados: min <= valor
 *   Ejemplo: rango de 1000 en adelante incluye desde 1000.00 sin límite superior
 */

export type UnidadMedida = 'mt2' | 'mt_lineal' | 'unidades';

export interface RangoPrecio {
  id: string;
  company_id: string;
  nombre: string;
  unidad_medida: UnidadMedida;
  rangos: RangoDetalle[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface UseRangosPrecioResult {
  rangos: RangoPrecio[];
  loading: boolean;
  error: string | null;
  fetchRangos: () => Promise<void>;
  createRango: (data: CreateRangoData) => Promise<RangoPrecio | null>;
  updateRango: (id: string, data: UpdateRangoData) => Promise<boolean>;
  deleteRango: (id: string) => Promise<boolean>;
  getRangoById: (id: string) => Promise<RangoPrecio | null>;
}

interface CreateRangoData {
  nombre: string;
  unidad_medida: UnidadMedida;
  rangos: RangoDetalle[];
}

interface UpdateRangoData {
  nombre?: string;
  unidad_medida?: UnidadMedida;
  rangos?: RangoDetalle[];
  is_active?: boolean;
}

export function useRangosPrecio(): UseRangosPrecioResult {
  const [rangos, setRangos] = useState<RangoPrecio[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { company } = useAuth();

  const fetchRangos = async () => {
    if (!company?.id) {
      setError('No hay empresa asociada');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('rangos_precio')
        .select('*')
        .eq('company_id', company.id)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      setRangos(data || []);
    } catch (err) {
      console.error('Error fetching rangos de precio:', err);
      setError(err instanceof Error ? err.message : 'Error al cargar rangos de precio');
    } finally {
      setLoading(false);
    }
  };

  const validateRangos = (rangos: RangoDetalle[]): string | null => {
    if (rangos.length === 0) {
      return 'Debe agregar al menos un rango';
    }

    const rangosOrdenados = [...rangos].sort((a, b) => a.min - b.min);

    for (let i = 0; i < rangosOrdenados.length; i++) {
      const rango = rangosOrdenados[i];

      if (rango.min < 0) {
        return `El rango ${i + 1} no puede tener valor mínimo negativo`;
      }

      if (rango.max !== null && rango.max < 0) {
        return `El rango ${i + 1} no puede tener valor máximo negativo`;
      }

      if (rango.max !== null && rango.min >= rango.max) {
        return `En el rango ${i + 1}, el mínimo debe ser menor que el máximo`;
      }

      if (rango.max === null && i < rangosOrdenados.length - 1) {
        return 'Solo el último rango puede tener valor máximo ilimitado';
      }

      if (i > 0) {
        const rangoAnterior = rangosOrdenados[i - 1];

        if (rangoAnterior.max === null) {
          return `El rango ${i} no puede existir después de un rango ilimitado`;
        }

        if (rangoAnterior.max !== rango.min) {
          return `Hay un hueco entre el rango ${i} (termina en ${rangoAnterior.max}) y el rango ${i + 1} (empieza en ${rango.min}). Los rangos deben ser continuos`;
        }
      }
    }

    return null;
  };

  const createRango = async (data: CreateRangoData): Promise<RangoPrecio | null> => {
    if (!company?.id) {
      setError('No hay empresa asociada');
      return null;
    }

    try {
      setError(null);

      const validationError = validateRangos(data.rangos);
      if (validationError) {
        setError(validationError);
        return null;
      }

      const { data: newRango, error: createError } = await supabase
        .from('rangos_precio')
        .insert([
          {
            company_id: company.id,
            nombre: data.nombre,
            unidad_medida: data.unidad_medida,
            rangos: data.rangos,
          },
        ])
        .select()
        .single();

      if (createError) throw createError;

      await fetchRangos();
      return newRango;
    } catch (err) {
      console.error('Error creating rango de precio:', err);
      setError(err instanceof Error ? err.message : 'Error al crear rango de precio');
      return null;
    }
  };

  const updateRango = async (id: string, data: UpdateRangoData): Promise<boolean> => {
    if (!company?.id) {
      setError('No hay empresa asociada');
      return false;
    }

    try {
      setError(null);

      if (data.rangos) {
        const validationError = validateRangos(data.rangos);
        if (validationError) {
          setError(validationError);
          return false;
        }
      }

      const updateData: any = {
        updated_at: new Date().toISOString(),
      };

      if (data.nombre !== undefined) updateData.nombre = data.nombre;
      if (data.unidad_medida !== undefined) updateData.unidad_medida = data.unidad_medida;
      if (data.rangos !== undefined) updateData.rangos = data.rangos;
      if (data.is_active !== undefined) updateData.is_active = data.is_active;

      const { error: updateError } = await supabase
        .from('rangos_precio')
        .update(updateData)
        .eq('id', id)
        .eq('company_id', company.id);

      if (updateError) throw updateError;

      await fetchRangos();
      return true;
    } catch (err) {
      console.error('Error updating rango de precio:', err);
      setError(err instanceof Error ? err.message : 'Error al actualizar rango de precio');
      return false;
    }
  };

  const deleteRango = async (id: string): Promise<boolean> => {
    if (!company?.id) {
      setError('No hay empresa asociada');
      return false;
    }

    try {
      setError(null);

      // Verificar si el rango está siendo usado por productos
      const { data: productosUsandoRango, error: checkError } = await supabase
        .from('productos_pricing')
        .select('id')
        .eq('rango_precio_id', id)
        .limit(1);

      if (checkError) throw checkError;

      if (productosUsandoRango && productosUsandoRango.length > 0) {
        setError('No se puede eliminar este rango porque está siendo usado por productos');
        return false;
      }

      const { error: deleteError } = await supabase
        .from('rangos_precio')
        .delete()
        .eq('id', id)
        .eq('company_id', company.id);

      if (deleteError) throw deleteError;

      await fetchRangos();
      return true;
    } catch (err) {
      console.error('Error deleting rango de precio:', err);
      setError(err instanceof Error ? err.message : 'Error al eliminar rango de precio');
      return false;
    }
  };

  const getRangoById = async (id: string): Promise<RangoPrecio | null> => {
    if (!company?.id) {
      setError('No hay empresa asociada');
      return null;
    }

    try {
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('rangos_precio')
        .select('*')
        .eq('id', id)
        .eq('company_id', company.id)
        .single();

      if (fetchError) throw fetchError;

      return data;
    } catch (err) {
      console.error('Error fetching rango de precio:', err);
      setError(err instanceof Error ? err.message : 'Error al cargar rango de precio');
      return null;
    }
  };

  useEffect(() => {
    if (company?.id) {
      fetchRangos();
    }
  }, [company?.id]);

  return {
    rangos,
    loading,
    error,
    fetchRangos,
    createRango,
    updateRango,
    deleteRango,
    getRangoById,
  };
}
