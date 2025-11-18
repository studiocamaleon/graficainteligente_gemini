import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import type {
  ProductoPlotterCorte,
  ProductoPlotterCorteConRelaciones,
  CreateProductoPlotterCorteData,
} from '../types/database';

interface UseProductosPlotterCorteFilters {
  search?: string;
  isActive?: boolean;
}

export function useProductosPlotterCorte(filters?: UseProductosPlotterCorteFilters) {
  const [productos, setProductos] = useState<ProductoPlotterCorte[]>([]);
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
  }, [profile?.company_id, filters?.search, filters?.isActive, user]);

  const fetchProductos = async () => {
    try {
      setIsLoading(true);
      setError(null);

      let query = supabase
        .from('productos_plotter_corte')
        .select('*')
        .eq('company_id', profile?.company_id)
        .order('nombre', { ascending: true });

      if (filters?.search) {
        query = query.ilike('nombre', `%${filters.search}%`);
      }

      if (filters?.isActive !== undefined) {
        query = query.eq('is_active', filters.isActive);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;

      setProductos(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar productos');
      console.error('Error fetching productos plotter corte:', err);
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

export function useProductoPlotterCorte(id?: string) {
  const [producto, setProducto] = useState<ProductoPlotterCorteConRelaciones | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user, profile } = useAuth();

  useEffect(() => {
    if (id && profile?.company_id) {
      fetchProducto();
    } else {
      setProducto(null);
    }
  }, [id, profile?.company_id]);

  const fetchProducto = async () => {
    if (!id) return;

    try {
      setIsLoading(true);
      setError(null);

      const { data: productoData, error: productoError } = await supabase
        .from('productos_plotter_corte')
        .select('*')
        .eq('id', id)
        .eq('company_id', profile?.company_id)
        .maybeSingle();

      if (productoError) throw productoError;
      if (!productoData) throw new Error('Producto no encontrado');

      const [serviciosResult, acabadosResult, rangoPrecioResult] = await Promise.all([
        supabase
          .from('productos_plotter_corte_servicios')
          .select(`
            id,
            servicio_id,
            servicios (
              id,
              nombre,
              is_active
            )
          `)
          .eq('producto_id', id),
        supabase
          .from('productos_plotter_corte_acabados')
          .select(`
            id,
            acabado_id,
            acabados (
              id,
              nombre,
              is_active
            )
          `)
          .eq('producto_id', id),
        productoData.rango_precio_id
          ? supabase
              .from('rangos_precio')
              .select('id, nombre, unidad_medida')
              .eq('id', productoData.rango_precio_id)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
      ]);

      if (serviciosResult.error) throw serviciosResult.error;
      if (acabadosResult.error) throw acabadosResult.error;
      if (rangoPrecioResult.error) throw rangoPrecioResult.error;

      const servicios = (serviciosResult.data || []).map((rel: any) => ({
        id: rel.id,
        producto_plotter_corte_id: id,
        servicio_id: rel.servicio_id,
        servicio_nombre: rel.servicios?.nombre || '',
        is_active: rel.servicios?.is_active ?? true,
      }));

      const acabados = (acabadosResult.data || []).map((rel: any) => ({
        id: rel.id,
        producto_plotter_corte_id: id,
        acabado_id: rel.acabado_id,
        acabado_nombre: rel.acabados?.nombre || '',
        is_active: rel.acabados?.is_active ?? true,
      }));

      const productoCompleto: ProductoPlotterCorteConRelaciones = {
        ...productoData,
        servicios,
        acabados,
        rango_precio: rangoPrecioResult.data,
      };

      setProducto(productoCompleto);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar producto');
      console.error('Error fetching producto plotter corte:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const createProducto = async (data: CreateProductoPlotterCorteData) => {
    if (!profile?.company_id) {
      throw new Error('No se encontró la empresa del usuario');
    }

    try {
      setIsLoading(true);
      setError(null);

      const { data: newProducto, error: productoError } = await supabase
        .from('productos_plotter_corte')
        .insert({
          company_id: profile.company_id,
          nombre: data.nombre,
          unidad_venta: 'mt_lineal',
          material_id: data.material_id,
          variante_nombre: data.variante_nombre,
          espesor: data.espesor || null,
          anchos_disponibles: data.anchos_disponibles,
          cantidad_minima: data.cantidad_minima || null,
          color: data.color,
          marca: data.marca || null,
          impuesto_iva: data.impuesto_iva,
          rango_precio_id: data.rango_precio_id || null,
          ruta_produccion_id: data.ruta_produccion_id || null,
        })
        .select()
        .single();

      if (productoError) throw productoError;
      if (!newProducto) throw new Error('No se pudo crear el producto');

      const serviciosInserts = data.servicios.map((servicio_id) => ({
        producto_id: newProducto.id,
        servicio_id,
      }));

      const acabadosInserts = data.acabados.map((acabado_id) => ({
        producto_id: newProducto.id,
        acabado_id,
      }));

      if (serviciosInserts.length > 0) {
        const { error: serviciosError } = await supabase
          .from('productos_plotter_corte_servicios')
          .insert(serviciosInserts);

        if (serviciosError) throw serviciosError;
      }

      if (acabadosInserts.length > 0) {
        const { error: acabadosError } = await supabase
          .from('productos_plotter_corte_acabados')
          .insert(acabadosInserts);

        if (acabadosError) throw acabadosError;
      }

      return newProducto;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error al crear producto';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const updateProducto = async (id: string, data: CreateProductoPlotterCorteData) => {
    if (!profile?.company_id) {
      throw new Error('No se encontró la empresa del usuario');
    }

    try {
      setIsLoading(true);
      setError(null);

      const { error: productoError } = await supabase
        .from('productos_plotter_corte')
        .update({
          nombre: data.nombre,
          material_id: data.material_id,
          variante_nombre: data.variante_nombre,
          espesor: data.espesor || null,
          anchos_disponibles: data.anchos_disponibles,
          cantidad_minima: data.cantidad_minima || null,
          color: data.color,
          marca: data.marca || null,
          impuesto_iva: data.impuesto_iva,
          rango_precio_id: data.rango_precio_id || null,
          ruta_produccion_id: data.ruta_produccion_id || null,
        })
        .eq('id', id)
        .eq('company_id', profile.company_id);

      if (productoError) throw productoError;

      await supabase.from('productos_plotter_corte_servicios').delete().eq('producto_id', id);
      await supabase.from('productos_plotter_corte_acabados').delete().eq('producto_id', id);

      const serviciosInserts = data.servicios.map((servicio_id) => ({
        producto_id: id,
        servicio_id,
      }));

      const acabadosInserts = data.acabados.map((acabado_id) => ({
        producto_id: id,
        acabado_id,
      }));

      if (serviciosInserts.length > 0) {
        const { error: serviciosError } = await supabase
          .from('productos_plotter_corte_servicios')
          .insert(serviciosInserts);

        if (serviciosError) throw serviciosError;
      }

      if (acabadosInserts.length > 0) {
        const { error: acabadosError } = await supabase
          .from('productos_plotter_corte_acabados')
          .insert(acabadosInserts);

        if (acabadosError) throw acabadosError;
      }

      await fetchProducto();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error al actualizar producto';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleStatus = async (id: string) => {
    if (!profile?.company_id) {
      throw new Error('No se encontró la empresa del usuario');
    }

    try {
      const { data: currentProducto, error: fetchError } = await supabase
        .from('productos_plotter_corte')
        .select('is_active')
        .eq('id', id)
        .eq('company_id', profile.company_id)
        .maybeSingle();

      if (fetchError) throw fetchError;
      if (!currentProducto) throw new Error('Producto no encontrado');

      const { error: updateError } = await supabase
        .from('productos_plotter_corte')
        .update({ is_active: !currentProducto.is_active })
        .eq('id', id)
        .eq('company_id', profile.company_id);

      if (updateError) throw updateError;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error al cambiar estado';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  };

  const deleteProducto = async (id: string) => {
    if (!profile?.company_id) {
      throw new Error('No se encontró la empresa del usuario');
    }

    try {
      const { error } = await supabase
        .from('productos_plotter_corte')
        .delete()
        .eq('id', id)
        .eq('company_id', profile.company_id);

      if (error) throw error;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error al eliminar producto';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  };

  return {
    producto,
    isLoading,
    error,
    refetch: fetchProducto,
    createProducto,
    updateProducto,
    toggleStatus,
    deleteProducto,
  };
}
