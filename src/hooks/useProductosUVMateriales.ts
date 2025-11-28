import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';

export interface ProductoUVMaterial {
  id: string;
  company_id: string;
  producto_uv_id: string;
  material_id: string;
  variante_nombre: string;
  espesor_mm: number | null;
  ancho_placa_cm: number;
  alto_placa_cm: number;
  precio_placa: number;
  precio_mt2: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  material?: {
    id: string;
    nombre: string;
  };
}

export interface CreateProductoUVMaterialInput {
  producto_uv_id: string;
  material_id: string;
  variante_nombre: string;
  espesor_mm?: number;
  ancho_placa_cm: number;
  alto_placa_cm: number;
  precio_placa: number;
}

export interface UpdateProductoUVMaterialInput extends Partial<CreateProductoUVMaterialInput> {
  is_active?: boolean;
}

export function useProductosUVMateriales(productoUvId?: string) {
  const { user } = useAuth();
  const [materiales, setMateriales] = useState<ProductoUVMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMateriales = async () => {
    if (!user || !productoUvId) {
      setMateriales([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('productos_impresion_uv_rigidos_materiales')
        .select(`
          *,
          material:materiales(id, nombre)
        `)
        .eq('producto_uv_id', productoUvId)
        .order('variante_nombre', { ascending: true });

      if (fetchError) throw fetchError;

      setMateriales(data || []);
    } catch (err) {
      console.error('Error fetching materiales UV:', err);
      setError(err instanceof Error ? err.message : 'Error al cargar materiales UV');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMateriales();
  }, [user, productoUvId]);

  const createMaterial = async (input: CreateProductoUVMaterialInput): Promise<ProductoUVMaterial> => {
    if (!user) throw new Error('Usuario no autenticado');

    const { data: profile } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('id', user.id)
      .single();

    if (!profile) throw new Error('Perfil no encontrado');

    const { data, error: createError } = await supabase
      .from('productos_impresion_uv_rigidos_materiales')
      .insert([
        {
          company_id: profile.company_id,
          producto_uv_id: input.producto_uv_id,
          material_id: input.material_id,
          variante_nombre: input.variante_nombre,
          espesor_mm: input.espesor_mm || null,
          ancho_placa_cm: input.ancho_placa_cm,
          alto_placa_cm: input.alto_placa_cm,
          precio_placa: input.precio_placa,
          precio_mt2: 0,
        },
      ])
      .select(`
        *,
        material:materiales(id, nombre)
      `)
      .single();

    if (createError) throw createError;
    if (!data) throw new Error('No se pudo crear el material');

    await fetchMateriales();
    return data;
  };

  const updateMaterial = async (id: string, input: UpdateProductoUVMaterialInput): Promise<ProductoUVMaterial> => {
    const { data, error: updateError } = await supabase
      .from('productos_impresion_uv_rigidos_materiales')
      .update(input)
      .eq('id', id)
      .select(`
        *,
        material:materiales(id, nombre)
      `)
      .single();

    if (updateError) throw updateError;
    if (!data) throw new Error('No se pudo actualizar el material');

    await fetchMateriales();
    return data;
  };

  const deleteMaterial = async (id: string): Promise<void> => {
    const { error: deleteError } = await supabase
      .from('productos_impresion_uv_rigidos_materiales')
      .delete()
      .eq('id', id);

    if (deleteError) throw deleteError;

    await fetchMateriales();
  };

  return {
    materiales,
    loading,
    error,
    createMaterial,
    updateMaterial,
    deleteMaterial,
    refreshMateriales: fetchMateriales,
  };
}
