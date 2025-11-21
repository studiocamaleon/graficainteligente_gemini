import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';

export interface ProductoTalonarioPrecio {
  id: string;
  company_id: string;
  producto_talonario_id: string;
  medida_ancho: number;
  medida_alto: number;
  tinta: string;
  cantidad: number;
  tipo_copia: 'solo_frente' | 'frente_y_dorso';
  precio: number;
  created_at: string;
  updated_at: string;
}

export interface PrecioInput {
  medida_ancho: number;
  medida_alto: number;
  tinta: string;
  cantidad: number;
  tipo_copia: 'solo_frente' | 'frente_y_dorso';
  precio: number;
}

export interface PreciosPorCombinacion {
  medida: { ancho: number; alto: number };
  tinta: string;
  tinta_nombre?: string;
  precios: ProductoTalonarioPrecio[];
}

export function useProductosTalonariosPrecios(productoTalonarioId?: string) {
  const [precios, setPrecios] = useState<ProductoTalonarioPrecio[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { profile } = useAuth();

  useEffect(() => {
    if (productoTalonarioId && profile?.company_id) {
      fetchPrecios();
    } else {
      setPrecios([]);
    }
  }, [productoTalonarioId, profile?.company_id]);

  const fetchPrecios = async () => {
    if (!productoTalonarioId || !profile?.company_id) return;

    try {
      setIsLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('productos_talonarios_precios')
        .select('*')
        .eq('producto_talonario_id', productoTalonarioId)
        .eq('company_id', profile.company_id)
        .order('medida_ancho', { ascending: true })
        .order('medida_alto', { ascending: true })
        .order('cantidad', { ascending: true });

      if (fetchError) throw fetchError;

      setPrecios(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar precios');
      console.error('Error fetching precios:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const savePreciosEnLote = async (
    productoTalonarioId: string,
    preciosInput: PrecioInput[]
  ): Promise<void> => {
    if (!profile?.company_id) {
      throw new Error('No se pudo obtener el company_id del usuario');
    }

    try {
      setIsLoading(true);
      setError(null);

      // Primero, eliminar todos los precios existentes del producto
      const { error: deleteError } = await supabase
        .from('productos_talonarios_precios')
        .delete()
        .eq('producto_talonario_id', productoTalonarioId)
        .eq('company_id', profile.company_id);

      if (deleteError) throw deleteError;

      // Filtrar solo precios con valor definido
      const preciosValidos = preciosInput.filter((p) => p.precio > 0);

      if (preciosValidos.length === 0) {
        // Si no hay precios válidos, solo limpiar y retornar
        await fetchPrecios();
        return;
      }

      // Insertar los nuevos precios
      const preciosParaInsertar = preciosValidos.map((precio) => ({
        company_id: profile.company_id,
        producto_talonario_id: productoTalonarioId,
        medida_ancho: precio.medida_ancho,
        medida_alto: precio.medida_alto,
        tinta: precio.tinta,
        cantidad: precio.cantidad,
        tipo_copia: precio.tipo_copia,
        precio: precio.precio,
      }));

      const { error: insertError } = await supabase
        .from('productos_talonarios_precios')
        .insert(preciosParaInsertar);

      if (insertError) throw insertError;

      // Refrescar los datos
      await fetchPrecios();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Error al guardar precios';
      setError(errorMsg);
      console.error('Error saving precios en lote:', err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const deletePreciosByProducto = async (productoTalonarioId: string): Promise<void> => {
    if (!profile?.company_id) {
      throw new Error('No se pudo obtener el company_id del usuario');
    }

    try {
      setIsLoading(true);
      setError(null);

      const { error: deleteError } = await supabase
        .from('productos_talonarios_precios')
        .delete()
        .eq('producto_talonario_id', productoTalonarioId)
        .eq('company_id', profile.company_id);

      if (deleteError) throw deleteError;

      await fetchPrecios();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Error al eliminar precios';
      setError(errorMsg);
      console.error('Error deleting precios:', err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const agruparPreciosPorCombinacion = (): PreciosPorCombinacion[] => {
    const grupos: Map<string, PreciosPorCombinacion> = new Map();

    precios.forEach((precio) => {
      const key = `${precio.medida_ancho}x${precio.medida_alto}-${precio.tinta}`;

      if (!grupos.has(key)) {
        grupos.set(key, {
          medida: { ancho: precio.medida_ancho, alto: precio.medida_alto },
          tinta: precio.tinta,
          precios: [],
        });
      }

      grupos.get(key)!.precios.push(precio);
    });

    return Array.from(grupos.values());
  };

  return {
    precios,
    isLoading,
    error,
    fetchPrecios,
    savePreciosEnLote,
    deletePreciosByProducto,
    agruparPreciosPorCombinacion,
  };
}
