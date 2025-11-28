import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';

export interface ProductoImpresionUVRigido {
  id: string;
  company_id: string;
  categoria_id: string;
  nombre: string;
  descripcion: string | null;
  tecnologia_id: string;
  tintas: string[];
  ruta_produccion_id: string | null;
  permite_material_cliente: boolean;
  ancho_minimo: number | null;
  ancho_maximo: number | null;
  alto_minimo: number | null;
  alto_maximo: number | null;
  cantidad_minima: number;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateProductoUVInput {
  nombre: string;
  descripcion?: string;
  tecnologia_id: string;
  tintas: string[];
  ruta_produccion_id?: string;
  permite_material_cliente?: boolean;
  ancho_minimo?: number;
  ancho_maximo?: number;
  alto_minimo?: number;
  alto_maximo?: number;
  cantidad_minima?: number;
}

export interface UpdateProductoUVInput extends Partial<CreateProductoUVInput> {
  activo?: boolean;
}

export function useProductosImpresionUVRigidos() {
  const { user } = useAuth();
  const [productos, setProductos] = useState<ProductoImpresionUVRigido[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProductos = async () => {
    if (!user) {
      setProductos([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('productos_impresion_uv_rigidos')
        .select('*')
        .order('nombre', { ascending: true });

      if (fetchError) throw fetchError;

      setProductos(data || []);
    } catch (err) {
      console.error('Error fetching productos UV:', err);
      setError(err instanceof Error ? err.message : 'Error al cargar productos UV');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProductos();
  }, [user]);

  const createProducto = async (input: CreateProductoUVInput): Promise<ProductoImpresionUVRigido> => {
    if (!user) throw new Error('Usuario no autenticado');

    const { data: profile } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('id', user.id)
      .single();

    if (!profile) throw new Error('Perfil no encontrado');

    const { data, error: createError } = await supabase
      .from('productos_impresion_uv_rigidos')
      .insert([
        {
          company_id: profile.company_id,
          categoria_id: '00000000-0000-0000-0000-000000000008',
          nombre: input.nombre,
          descripcion: input.descripcion || null,
          tecnologia_id: input.tecnologia_id,
          tintas: input.tintas,
          ruta_produccion_id: input.ruta_produccion_id || null,
          permite_material_cliente: input.permite_material_cliente ?? true,
          ancho_minimo: input.ancho_minimo || null,
          ancho_maximo: input.ancho_maximo || null,
          alto_minimo: input.alto_minimo || null,
          alto_maximo: input.alto_maximo || null,
          cantidad_minima: input.cantidad_minima ?? 1,
        },
      ])
      .select()
      .single();

    if (createError) {
      console.error('Error saving producto:', createError);
      throw createError;
    }
    if (!data) throw new Error('No se pudo crear el producto');

    await fetchProductos();
    return data;
  };

  const updateProducto = async (id: string, input: UpdateProductoUVInput): Promise<ProductoImpresionUVRigido> => {
    const { data, error: updateError } = await supabase
      .from('productos_impresion_uv_rigidos')
      .update(input)
      .eq('id', id)
      .select()
      .single();

    if (updateError) throw updateError;
    if (!data) throw new Error('No se pudo actualizar el producto');

    await fetchProductos();
    return data;
  };

  const deleteProducto = async (id: string): Promise<void> => {
    const { error: deleteError } = await supabase
      .from('productos_impresion_uv_rigidos')
      .delete()
      .eq('id', id);

    if (deleteError) throw deleteError;

    await fetchProductos();
  };

  return {
    productos,
    loading,
    error,
    createProducto,
    updateProducto,
    deleteProducto,
    refreshProductos: fetchProductos,
  };
}
