import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import type {
  ProductoPortabanner,
  ProductoPortabannerConRelaciones,
  CreateProductoPortabannerData,
} from '../types/database';

interface UseProductosPortabannersFilters {
  search?: string;
  isActive?: boolean;
}

export function useProductosPortabanners(filters?: UseProductosPortabannersFilters) {
  const [productos, setProductos] = useState<ProductoPortabanner[]>([]);
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
        .from('productos_portabanners')
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
      console.error('Error fetching productos portabanners:', err);
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

export function useProductoPortabanner(id?: string) {
  const [producto, setProducto] = useState<ProductoPortabannerConRelaciones | null>(null);
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
        .from('productos_portabanners')
        .select('*')
        .eq('id', id)
        .eq('company_id', profile?.company_id)
        .maybeSingle();

      if (productoError) throw productoError;
      if (!productoData) throw new Error('Producto no encontrado');

      const [serviciosResult, acabadosResult, tecnologiasResult, rangoPrecioResult, tecnologiaResult] = await Promise.all([
        supabase
          .from('productos_portabanners_servicios')
          .select(`
            id,
            servicio_id,
            servicios (
              id,
              nombre
            )
          `)
          .eq('producto_id', id),
        supabase
          .from('productos_portabanners_acabados')
          .select(`
            id,
            acabado_id,
            acabados (
              id,
              nombre
            )
          `)
          .eq('producto_id', id),
        supabase
          .from('productos_portabanners_tecnologias')
          .select(`
            id,
            tecnologia_id,
            created_at,
            tecnologias (
              id,
              nombre
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
        productoData.tecnologia_id
          ? supabase
              .from('tecnologias')
              .select('id, nombre')
              .eq('id', productoData.tecnologia_id)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
      ]);

      if (serviciosResult.error) throw serviciosResult.error;
      if (acabadosResult.error) throw acabadosResult.error;
      if (tecnologiasResult.error) throw tecnologiasResult.error;
      if (rangoPrecioResult.error) throw rangoPrecioResult.error;
      if (tecnologiaResult.error) throw tecnologiaResult.error;

      const servicios = (serviciosResult.data || []).map((rel: any) => ({
        id: rel.id,
        producto_id: id,
        servicio_id: rel.servicio_id,
        servicio_nombre: rel.servicios?.nombre || '',
      }));

      const acabados = (acabadosResult.data || []).map((rel: any) => ({
        id: rel.id,
        producto_id: id,
        acabado_id: rel.acabado_id,
        acabado_nombre: rel.acabados?.nombre || '',
      }));

      const tecnologias = (tecnologiasResult.data || []).map((rel: any) => ({
        id: rel.id,
        producto_id: id,
        tecnologia_id: rel.tecnologia_id,
        tecnologia_nombre: rel.tecnologias?.nombre || '',
        created_at: rel.created_at,
      }));

      const productoCompleto: ProductoPortabannerConRelaciones = {
        ...productoData,
        servicios,
        acabados,
        tecnologias,
        rango_precio: rangoPrecioResult.data,
        tecnologia: tecnologiaResult.data,
      };

      setProducto(productoCompleto);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar producto');
      console.error('Error fetching producto portabanner:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const createProducto = async (data: CreateProductoPortabannerData) => {
    if (!profile?.company_id) {
      throw new Error('No se encontró la empresa del usuario');
    }

    try {
      setIsLoading(true);
      setError(null);

      const { data: newProducto, error: productoError } = await supabase
        .from('productos_portabanners')
        .insert({
          company_id: profile.company_id,
          nombre: data.nombre,
          ancho_cm: data.ancho_cm,
          alto_cm: data.alto_cm,
          tecnologia_id: data.tecnologia_id,
          tintas: ['CMYK'],
          impuesto_iva: data.impuesto_iva,
          rango_precio_id: data.rango_precio_id || null,
          ruta_produccion_id: data.ruta_produccion_id || null,
        })
        .select()
        .single();

      if (productoError) throw productoError;
      if (!newProducto) throw new Error('No se pudo crear el producto');

      const tecnologiasInserts = data.tecnologias_ids.map((tecnologia_id) => ({
        producto_id: newProducto.id,
        tecnologia_id,
      }));

      const serviciosInserts = data.servicios.map((servicio_id) => ({
        producto_id: newProducto.id,
        servicio_id,
      }));

      const acabadosInserts = data.acabados.map((acabado_id) => ({
        producto_id: newProducto.id,
        acabado_id,
      }));

      if (tecnologiasInserts.length > 0) {
        const { error: tecnologiasError } = await supabase
          .from('productos_portabanners_tecnologias')
          .insert(tecnologiasInserts);

        if (tecnologiasError) throw tecnologiasError;
      }

      if (serviciosInserts.length > 0) {
        const { error: serviciosError } = await supabase
          .from('productos_portabanners_servicios')
          .insert(serviciosInserts);

        if (serviciosError) throw serviciosError;
      }

      if (acabadosInserts.length > 0) {
        const { error: acabadosError } = await supabase
          .from('productos_portabanners_acabados')
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

  const updateProducto = async (id: string, data: CreateProductoPortabannerData) => {
    if (!profile?.company_id) {
      throw new Error('No se encontró la empresa del usuario');
    }

    try {
      setIsLoading(true);
      setError(null);

      const { error: productoError } = await supabase
        .from('productos_portabanners')
        .update({
          nombre: data.nombre,
          ancho_cm: data.ancho_cm,
          alto_cm: data.alto_cm,
          tecnologia_id: data.tecnologia_id,
          tintas: ['CMYK'],
          impuesto_iva: data.impuesto_iva,
          rango_precio_id: data.rango_precio_id || null,
          ruta_produccion_id: data.ruta_produccion_id || null,
        })
        .eq('id', id)
        .eq('company_id', profile.company_id);

      if (productoError) throw productoError;

      await supabase.from('productos_portabanners_tecnologias').delete().eq('producto_id', id);
      await supabase.from('productos_portabanners_servicios').delete().eq('producto_id', id);
      await supabase.from('productos_portabanners_acabados').delete().eq('producto_id', id);

      const tecnologiasInserts = data.tecnologias_ids.map((tecnologia_id) => ({
        producto_id: id,
        tecnologia_id,
      }));

      const serviciosInserts = data.servicios.map((servicio_id) => ({
        producto_id: id,
        servicio_id,
      }));

      const acabadosInserts = data.acabados.map((acabado_id) => ({
        producto_id: id,
        acabado_id,
      }));

      if (tecnologiasInserts.length > 0) {
        const { error: tecnologiasError } = await supabase
          .from('productos_portabanners_tecnologias')
          .insert(tecnologiasInserts);

        if (tecnologiasError) throw tecnologiasError;
      }

      if (serviciosInserts.length > 0) {
        const { error: serviciosError } = await supabase
          .from('productos_portabanners_servicios')
          .insert(serviciosInserts);

        if (serviciosError) throw serviciosError;
      }

      if (acabadosInserts.length > 0) {
        const { error: acabadosError } = await supabase
          .from('productos_portabanners_acabados')
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
        .from('productos_portabanners')
        .select('is_active')
        .eq('id', id)
        .eq('company_id', profile.company_id)
        .maybeSingle();

      if (fetchError) throw fetchError;
      if (!currentProducto) throw new Error('Producto no encontrado');

      const { error: updateError } = await supabase
        .from('productos_portabanners')
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
        .from('productos_portabanners')
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
