import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';

export interface ProductoUVPrecioImpresion {
  id: string;
  company_id: string;
  producto_uv_id: string;
  tinta: string;
  rango_mt2_min: number;
  rango_mt2_max: number;
  precio_mt2: number;
  created_at: string;
  updated_at: string;
}

export interface CreateProductoUVPrecioInput {
  producto_uv_id: string;
  tinta: string;
  rango_mt2_min: number;
  rango_mt2_max: number;
  precio_mt2: number;
}

export interface UpdateProductoUVPrecioInput extends Partial<CreateProductoUVPrecioInput> {}

export function useProductosUVPreciosImpresion(productoUvId?: string) {
  const { user } = useAuth();
  const [precios, setPrecios] = useState<ProductoUVPrecioImpresion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPrecios = async () => {
    if (!user || !productoUvId) {
      setPrecios([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('productos_impresion_uv_rigidos_precios_impresion')
        .select('*')
        .eq('producto_uv_id', productoUvId)
        .order('tinta', { ascending: true })
        .order('rango_mt2_min', { ascending: true });

      if (fetchError) throw fetchError;

      setPrecios(data || []);
    } catch (err) {
      console.error('Error fetching precios UV:', err);
      setError(err instanceof Error ? err.message : 'Error al cargar precios UV');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrecios();
  }, [user, productoUvId]);

  const createPrecio = async (input: CreateProductoUVPrecioInput): Promise<ProductoUVPrecioImpresion> => {
    if (!user) throw new Error('Usuario no autenticado');

    const { data: profile } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('id', user.id)
      .single();

    if (!profile) throw new Error('Perfil no encontrado');

    const { data, error: createError } = await supabase
      .from('productos_impresion_uv_rigidos_precios_impresion')
      .insert([
        {
          company_id: profile.company_id,
          producto_uv_id: input.producto_uv_id,
          tinta: input.tinta,
          rango_mt2_min: input.rango_mt2_min,
          rango_mt2_max: input.rango_mt2_max,
          precio_mt2: input.precio_mt2,
        },
      ])
      .select()
      .single();

    if (createError) throw createError;
    if (!data) throw new Error('No se pudo crear el precio');

    await fetchPrecios();
    return data;
  };

  const updatePrecio = async (id: string, input: UpdateProductoUVPrecioInput): Promise<ProductoUVPrecioImpresion> => {
    const { data, error: updateError } = await supabase
      .from('productos_impresion_uv_rigidos_precios_impresion')
      .update(input)
      .eq('id', id)
      .select()
      .single();

    if (updateError) throw updateError;
    if (!data) throw new Error('No se pudo actualizar el precio');

    await fetchPrecios();
    return data;
  };

  const deletePrecio = async (id: string): Promise<void> => {
    const { error: deleteError } = await supabase
      .from('productos_impresion_uv_rigidos_precios_impresion')
      .delete()
      .eq('id', id);

    if (deleteError) throw deleteError;

    await fetchPrecios();
  };

  const bulkUpdatePrecios = async (updates: Array<{ id: string; precio_mt2: number }>): Promise<void> => {
    const promises = updates.map(({ id, precio_mt2 }) =>
      supabase
        .from('productos_impresion_uv_rigidos_precios_impresion')
        .update({ precio_mt2 })
        .eq('id', id)
    );

    const results = await Promise.all(promises);
    const errors = results.filter((r) => r.error);

    if (errors.length > 0) {
      throw new Error(`Error al actualizar ${errors.length} precios`);
    }

    await fetchPrecios();
  };

  return {
    precios,
    loading,
    error,
    createPrecio,
    updatePrecio,
    deletePrecio,
    bulkUpdatePrecios,
    refreshPrecios: fetchPrecios,
  };
}
