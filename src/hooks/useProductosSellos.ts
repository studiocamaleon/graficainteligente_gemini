import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import type {
  ProductoSello,
  ProductoSelloConRelaciones,
  CreateProductoSelloData,
  UpdateProductoSelloData,
} from '../types/database';

interface UseProductosSellosFilters {
  search?: string;
  tipoProducto?: string;
  isActive?: boolean;
}

export function useProductosSellos(filters?: UseProductosSellosFilters) {
  const [productos, setProductos] = useState<ProductoSello[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user, profile } = useAuth();

  useEffect(() => {
    if (profile?.company_id) {
      fetchProductos();
    } else if (user && !profile) {
      setIsLoading(true);
    } else {
      setIsLoading(false);
    }
  }, [profile?.company_id, filters?.search, filters?.tipoProducto, filters?.isActive, user]);

  const fetchProductos = async () => {
    try {
      setIsLoading(true);
      setError(null);

      let query = supabase
        .from('productos_sellos')
        .select('*')
        .eq('company_id', profile?.company_id)
        .order('nombre', { ascending: true });

      if (filters?.search) {
        query = query.ilike('nombre', `%${filters.search}%`);
      }

      if (filters?.tipoProducto) {
        query = query.eq('tipo_producto', filters.tipoProducto);
      }

      if (filters?.isActive !== undefined) {
        query = query.eq('is_active', filters.isActive);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;

      setProductos(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar productos');
      console.error('Error fetching productos sellos:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return {
    productos,
    isLoading,
    error,
    refetch: fetchProductos,
  };
}

export function useProductoSello(id?: string) {
  const [producto, setProducto] = useState<ProductoSelloConRelaciones | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user, profile } = useAuth();

  useEffect(() => {
    if (id && profile?.company_id) {
      fetchProducto();
    } else {
      setProducto(null);
      setIsLoading(false);
    }
  }, [id, profile?.company_id, user]);

  const fetchProducto = async () => {
    if (!id) return;

    try {
      setIsLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('productos_sellos')
        .select(`
          *,
          ruta_produccion:rutas_produccion(id, nombre)
        `)
        .eq('id', id)
        .eq('company_id', profile?.company_id)
        .maybeSingle();

      if (fetchError) throw fetchError;

      setProducto(data as ProductoSelloConRelaciones);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar producto');
      console.error('Error fetching producto sello:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return {
    producto,
    isLoading,
    error,
    refetch: fetchProducto,
  };
}

export function useProductoSelloActions() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { profile } = useAuth();

  const createProducto = async (data: CreateProductoSelloData): Promise<ProductoSello | null> => {
    try {
      setIsLoading(true);
      setError(null);

      const productoData: any = {
        company_id: profile?.company_id,
        nombre: data.nombre,
        tipo_producto: data.tipo_producto,
        impuesto_iva: data.impuesto_iva,
        ruta_produccion_id: data.ruta_produccion_id || null,
        is_active: true,
      };

      if (data.tipo_producto === 'sello') {
        productoData.tipo_sello = data.tipo_sello;
        productoData.marca = data.marca;
      }

      if (data.tipo_producto === 'tinta') {
        productoData.tipo_tinta = data.tipo_tinta;
      }

      if (data.medida_ancho !== undefined) {
        productoData.medida_ancho = data.medida_ancho;
      }

      if (data.medida_alto !== undefined) {
        productoData.medida_alto = data.medida_alto;
      }

      const { data: producto, error: insertError } = await supabase
        .from('productos_sellos')
        .insert([productoData])
        .select()
        .single();

      if (insertError) throw insertError;

      return producto;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear producto');
      console.error('Error creating producto sello:', err);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const updateProducto = async (id: string, data: UpdateProductoSelloData): Promise<boolean> => {
    try {
      setIsLoading(true);
      setError(null);

      const updateData: any = {};

      if (data.nombre !== undefined) updateData.nombre = data.nombre;
      if (data.tipo_producto !== undefined) updateData.tipo_producto = data.tipo_producto;
      if (data.impuesto_iva !== undefined) updateData.impuesto_iva = data.impuesto_iva;
      if (data.ruta_produccion_id !== undefined) updateData.ruta_produccion_id = data.ruta_produccion_id;
      if (data.is_active !== undefined) updateData.is_active = data.is_active;

      if (data.tipo_sello !== undefined) updateData.tipo_sello = data.tipo_sello;
      if (data.marca !== undefined) updateData.marca = data.marca;
      if (data.medida_ancho !== undefined) updateData.medida_ancho = data.medida_ancho;
      if (data.medida_alto !== undefined) updateData.medida_alto = data.medida_alto;
      if (data.tipo_tinta !== undefined) updateData.tipo_tinta = data.tipo_tinta;

      const { error: updateError } = await supabase
        .from('productos_sellos')
        .update(updateData)
        .eq('id', id)
        .eq('company_id', profile?.company_id);

      if (updateError) throw updateError;

      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al actualizar producto');
      console.error('Error updating producto sello:', err);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const deleteProducto = async (id: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      setError(null);

      const { error: deleteError } = await supabase
        .from('productos_sellos')
        .delete()
        .eq('id', id)
        .eq('company_id', profile?.company_id);

      if (deleteError) throw deleteError;

      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar producto');
      console.error('Error deleting producto sello:', err);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const toggleActive = async (id: string, isActive: boolean): Promise<boolean> => {
    return updateProducto(id, { is_active: isActive });
  };

  return {
    createProducto,
    updateProducto,
    deleteProducto,
    toggleActive,
    isLoading,
    error,
  };
}
