import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';

export interface ProductoMaterialesRigidos {
  id: string;
  company_id: string;
  nombre: string;
  medidas_ancho: number;
  medidas_alto: number;
  tipo_venta: string;
  rango_precio_id: string | null;
  ruta_produccion_id: string | null;
  impuesto_iva: number;
  cantidad_minima: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface MaterialRelacion {
  id: string;
  material_id: string;
  variante_nombre: string;
  espesor: number | null;
}

export interface VarianteEspesorCombinacion {
  variante_nombre: string;
  espesor: number | null;
}

export interface ServicioRelacion {
  id: string;
  servicio_id: string;
  is_active: boolean;
}

export interface AcabadoRelacion {
  id: string;
  acabado_id: string;
  is_active: boolean;
}

export interface ProductoMaterialesRigidosConRelaciones extends ProductoMaterialesRigidos {
  materiales?: MaterialRelacion[];
  servicios?: ServicioRelacion[];
  acabados?: AcabadoRelacion[];
  rango_precio?: {
    id: string;
    nombre: string;
    unidad_medida: string;
  } | null;
}

export interface ProductoMaterialesRigidosFormData {
  nombre: string;
  medidas_ancho: number;
  medidas_alto: number;
  rango_precio_id: string | null;
  ruta_produccion_id?: string;
  impuesto_iva: number;
  cantidad_minima?: number;
  materiales: Array<{
    material_id: string;
    variante_nombre: string;
    espesor: number | null;
  }>;
  servicios_ids: string[];
  acabados_ids: string[];
}

interface UseProductosMaterialesRigidosFilters {
  search?: string;
  isActive?: boolean;
}

export function useProductosMaterialesRigidos(filters: UseProductosMaterialesRigidosFilters = {}) {
  const { user } = useAuth();
  const [productos, setProductos] = useState<ProductoMaterialesRigidos[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProductos = async () => {
    if (!user) return;

    try {
      setIsLoading(true);
      setError(null);

      let query = supabase
        .from('productos_materiales_rigidos')
        .select('*')
        .order('nombre', { ascending: true });

      if (filters.search) {
        query = query.ilike('nombre', `%${filters.search}%`);
      }

      if (filters.isActive !== undefined) {
        query = query.eq('is_active', filters.isActive);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;

      setProductos(data || []);
    } catch (err) {
      console.error('Error fetching productos materiales rigidos:', err);
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProductos();
  }, [user, filters.search, filters.isActive]);

  const createProducto = async (formData: ProductoMaterialesRigidosFormData) => {
    if (!user) throw new Error('Usuario no autenticado');

    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .single();

      if (!profile?.company_id) throw new Error('No se encontró la empresa del usuario');

      const { data: producto, error: productoError } = await supabase
        .from('productos_materiales_rigidos')
        .insert({
          company_id: profile.company_id,
          nombre: formData.nombre,
          medidas_ancho: formData.medidas_ancho,
          medidas_alto: formData.medidas_alto,
          tipo_venta: 'mt2',
          rango_precio_id: formData.rango_precio_id,
          ruta_produccion_id: formData.ruta_produccion_id || null,
          impuesto_iva: formData.impuesto_iva,
          cantidad_minima: formData.cantidad_minima || null,
          is_active: true,
        })
        .select()
        .single();

      if (productoError) throw productoError;

      // Insert cada combinación de material como un registro separado
      if (formData.materiales && formData.materiales.length > 0) {
        const materialesData = formData.materiales.map((mat) => ({
          producto_materiales_rigidos_id: producto.id,
          material_id: mat.material_id,
          variante_nombre: mat.variante_nombre,
          espesor: mat.espesor,
          espesores: mat.espesor !== null ? [mat.espesor] : [], // Mantener array para compatibilidad
        }));

        await supabase
          .from('productos_materiales_rigidos_materiales')
          .insert(materialesData);
      }

      if (formData.servicios_ids.length > 0) {
        const serviciosData = formData.servicios_ids.map((servicio_id) => ({
          producto_materiales_rigidos_id: producto.id,
          servicio_id,
          is_active: true,
        }));

        await supabase
          .from('productos_materiales_rigidos_servicios')
          .insert(serviciosData);
      }

      if (formData.acabados_ids.length > 0) {
        const acabadosData = formData.acabados_ids.map((acabado_id) => ({
          producto_materiales_rigidos_id: producto.id,
          acabado_id,
          is_active: true,
        }));

        await supabase
          .from('productos_materiales_rigidos_acabados')
          .insert(acabadosData);
      }

      return producto;
    } catch (err) {
      console.error('Error creating producto materiales rigidos:', err);
      throw err;
    }
  };

  const updateProducto = async (id: string, formData: ProductoMaterialesRigidosFormData) => {
    if (!user) throw new Error('Usuario no autenticado');

    try {
      const { error: productoError } = await supabase
        .from('productos_materiales_rigidos')
        .update({
          nombre: formData.nombre,
          medidas_ancho: formData.medidas_ancho,
          medidas_alto: formData.medidas_alto,
          rango_precio_id: formData.rango_precio_id,
          ruta_produccion_id: formData.ruta_produccion_id || null,
          impuesto_iva: formData.impuesto_iva,
          cantidad_minima: formData.cantidad_minima || null,
        })
        .eq('id', id);

      if (productoError) throw productoError;

      // Delete existing material relations
      await supabase
        .from('productos_materiales_rigidos_materiales')
        .delete()
        .eq('producto_materiales_rigidos_id', id);

      // Insert new material combinations
      if (formData.materiales && formData.materiales.length > 0) {
        const materialesData = formData.materiales.map((mat) => ({
          producto_materiales_rigidos_id: id,
          material_id: mat.material_id,
          variante_nombre: mat.variante_nombre,
          espesor: mat.espesor,
          espesores: mat.espesor !== null ? [mat.espesor] : [], // Mantener array para compatibilidad
        }));

        await supabase
          .from('productos_materiales_rigidos_materiales')
          .insert(materialesData);
      }

      await supabase
        .from('productos_materiales_rigidos_servicios')
        .delete()
        .eq('producto_materiales_rigidos_id', id);

      if (formData.servicios_ids.length > 0) {
        const serviciosData = formData.servicios_ids.map((servicio_id) => ({
          producto_materiales_rigidos_id: id,
          servicio_id,
          is_active: true,
        }));

        await supabase
          .from('productos_materiales_rigidos_servicios')
          .insert(serviciosData);
      }

      await supabase
        .from('productos_materiales_rigidos_acabados')
        .delete()
        .eq('producto_materiales_rigidos_id', id);

      if (formData.acabados_ids.length > 0) {
        const acabadosData = formData.acabados_ids.map((acabado_id) => ({
          producto_materiales_rigidos_id: id,
          acabado_id,
          is_active: true,
        }));

        await supabase
          .from('productos_materiales_rigidos_acabados')
          .insert(acabadosData);
      }
    } catch (err) {
      console.error('Error updating producto materiales rigidos:', err);
      throw err;
    }
  };

  const toggleStatus = async (id: string) => {
    try {
      const producto = productos.find((p) => p.id === id);
      if (!producto) throw new Error('Producto no encontrado');

      const { error } = await supabase
        .from('productos_materiales_rigidos')
        .update({ is_active: !producto.is_active })
        .eq('id', id);

      if (error) throw error;
    } catch (err) {
      console.error('Error toggling producto status:', err);
      throw err;
    }
  };

  const deleteProducto = async (id: string) => {
    try {
      const { error } = await supabase
        .from('productos_materiales_rigidos')
        .delete()
        .eq('id', id);

      if (error) throw error;
    } catch (err) {
      console.error('Error deleting producto materiales rigidos:', err);
      throw err;
    }
  };

  return {
    productos,
    isLoading,
    error,
    refetch: fetchProductos,
    createProducto,
    updateProducto,
    toggleStatus,
    deleteProducto,
  };
}

export function useProductoMaterialesRigidos(id: string | undefined) {
  const { user } = useAuth();
  const [producto, setProducto] = useState<ProductoMaterialesRigidosConRelaciones | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProducto = async () => {
    if (!user || !id) return;

    try {
      setIsLoading(true);
      setError(null);

      const { data: productoData, error: productoError } = await supabase
        .from('productos_materiales_rigidos')
        .select('*')
        .eq('id', id)
        .single();

      if (productoError) throw productoError;

      const { data: materialesData } = await supabase
        .from('productos_materiales_rigidos_materiales')
        .select('*')
        .eq('producto_materiales_rigidos_id', id);

      const { data: serviciosData } = await supabase
        .from('productos_materiales_rigidos_servicios')
        .select('*')
        .eq('producto_materiales_rigidos_id', id);

      const { data: acabadosData } = await supabase
        .from('productos_materiales_rigidos_acabados')
        .select('*')
        .eq('producto_materiales_rigidos_id', id);

      let rangoPrecioData = null;
      if (productoData.rango_precio_id) {
        const { data } = await supabase
          .from('rangos_precio')
          .select('id, nombre, unidad_medida')
          .eq('id', productoData.rango_precio_id)
          .single();
        rangoPrecioData = data;
      }

      setProducto({
        ...productoData,
        materiales: materialesData || [],
        servicios: serviciosData || [],
        acabados: acabadosData || [],
        rango_precio: rangoPrecioData,
      });
    } catch (err) {
      console.error('Error fetching producto materiales rigidos:', err);
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProducto();
  }, [user, id]);

  const toggleStatus = async (productoId: string) => {
    try {
      setIsLoading(true);
      setError(null);

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user?.id)
        .single();

      const { data: currentData } = await supabase
        .from('productos_materiales_rigidos')
        .select('is_active')
        .eq('id', productoId)
        .single();

      if (!currentData) throw new Error('Producto no encontrado');

      const { error: updateError } = await supabase
        .from('productos_materiales_rigidos')
        .update({ is_active: !currentData.is_active })
        .eq('id', productoId)
        .eq('company_id', profile?.company_id);

      if (updateError) throw updateError;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Error al cambiar estado';
      setError(errorMsg);
      console.error('Error toggling status:', err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const deleteProducto = async (productoId: string) => {
    try {
      setIsLoading(true);
      setError(null);

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user?.id)
        .single();

      const { error: deleteError } = await supabase
        .from('productos_materiales_rigidos')
        .delete()
        .eq('id', productoId)
        .eq('company_id', profile?.company_id);

      if (deleteError) throw deleteError;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Error al eliminar producto';
      setError(errorMsg);
      console.error('Error deleting producto materiales rigidos:', err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    producto,
    isLoading,
    error,
    toggleStatus,
    deleteProducto,
    refetch: fetchProducto,
  };
}
