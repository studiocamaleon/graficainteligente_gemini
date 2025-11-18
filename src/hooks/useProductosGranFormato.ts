import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import type {
  ProductoGranFormato,
  ProductoGranFormatoConRelaciones,
  CreateProductoGranFormatoData,
} from '../types/database';

interface UseProductosGranFormatoFilters {
  search?: string;
  isActive?: boolean;
}

export function useProductosGranFormato(filters?: UseProductosGranFormatoFilters) {
  const [productos, setProductos] = useState<ProductoGranFormato[]>([]);
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
        .from('productos_gran_formato')
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
      console.error('Error fetching productos gran formato:', err);
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

export function useProductoGranFormato(id?: string) {
  const [producto, setProducto] = useState<ProductoGranFormatoConRelaciones | null>(null);
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
        .from('productos_gran_formato')
        .select('*')
        .eq('id', id)
        .eq('company_id', profile?.company_id)
        .maybeSingle();

      if (productoError) throw productoError;
      if (!productoData) throw new Error('Producto no encontrado');

      const [tecnologiasRes, materialesRes, serviciosRes, acabadosRes, rangoPrecioRes] = await Promise.all([
        supabase
          .from('productos_gran_formato_tecnologias')
          .select('id, producto_gran_formato_id, tecnologia_id, tintas, tecnologias(nombre)')
          .eq('producto_gran_formato_id', id),
        supabase
          .from('productos_gran_formato_materiales')
          .select('id, producto_gran_formato_id, material_id, variante_nombre, espesor, materiales(nombre, unidad_espesor)')
          .eq('producto_gran_formato_id', id),
        supabase
          .from('productos_gran_formato_servicios')
          .select('id, producto_gran_formato_id, servicio_id, is_active, servicios(nombre)')
          .eq('producto_gran_formato_id', id),
        supabase
          .from('productos_gran_formato_acabados')
          .select('id, producto_gran_formato_id, acabado_id, is_active, acabados(nombre)')
          .eq('producto_gran_formato_id', id),
        productoData.rango_precio_id
          ? supabase
              .from('rangos_precio')
              .select('id, nombre, unidad_medida')
              .eq('id', productoData.rango_precio_id)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
      ]);

      if (tecnologiasRes.error) throw tecnologiasRes.error;
      if (materialesRes.error) throw materialesRes.error;
      if (serviciosRes.error) throw serviciosRes.error;
      if (acabadosRes.error) throw acabadosRes.error;

      const productoCompleto: ProductoGranFormatoConRelaciones = {
        ...productoData,
        tecnologias: (tecnologiasRes.data || []).map((t: any) => ({
          id: t.id,
          producto_gran_formato_id: t.producto_gran_formato_id,
          tecnologia_id: t.tecnologia_id,
          tecnologia_nombre: t.tecnologias?.nombre || '',
          tintas: t.tintas || [],
        })),
        materiales: (materialesRes.data || []).map((m: any) => ({
          id: m.id,
          producto_gran_formato_id: m.producto_gran_formato_id,
          material_id: m.material_id,
          material_nombre: m.materiales?.nombre || '',
          variante_nombre: m.variante_nombre,
          espesor: m.espesor,
          unidad_espesor: m.materiales?.unidad_espesor || null,
        })),
        servicios: (serviciosRes.data || []).map((s: any) => ({
          id: s.id,
          producto_gran_formato_id: s.producto_gran_formato_id,
          servicio_id: s.servicio_id,
          servicio_nombre: s.servicios?.nombre || '',
          is_active: s.is_active,
        })),
        acabados: (acabadosRes.data || []).map((a: any) => ({
          id: a.id,
          producto_gran_formato_id: a.producto_gran_formato_id,
          acabado_id: a.acabado_id,
          acabado_nombre: a.acabados?.nombre || '',
          is_active: a.is_active,
        })),
        rango_precio: rangoPrecioRes.data,
      };

      setProducto(productoCompleto);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar producto');
      console.error('Error fetching producto gran formato:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const createProducto = async (data: CreateProductoGranFormatoData) => {
    try {
      setIsLoading(true);
      setError(null);

      console.log('=== CREANDO PRODUCTO GRAN FORMATO ===');
      console.log('Datos recibidos:', data);

      const { data: productoData, error: productoError } = await supabase
        .from('productos_gran_formato')
        .insert({
          company_id: profile?.company_id,
          nombre: data.nombre,
          tipo_venta: data.tipo_venta,
          anchos_disponibles: data.anchos_disponibles,
          impuesto_iva: data.impuesto_iva,
          rango_precio_id: data.rango_precio_id || null,
          ruta_produccion_id: data.ruta_produccion_id || null,
          cantidad_minima: data.cantidad_minima || null,
        })
        .select()
        .single();

      if (productoError) throw productoError;

      const productoId = productoData.id;
      console.log('Producto creado con ID:', productoId);

      const insertPromises = [];

      for (const tecTinta of data.tecnologias_tintas) {
        const tecnologiaInsert = {
          producto_gran_formato_id: productoId,
          tecnologia_id: tecTinta.tecnologia_id,
          tintas: tecTinta.tintas,
        };
        console.log('Insertando tecnología:', tecnologiaInsert);
        insertPromises.push(
          supabase.from('productos_gran_formato_tecnologias').insert(tecnologiaInsert)
        );
      }

      const materialInsert = {
        producto_gran_formato_id: productoId,
        material_id: data.material_id,
        variante_nombre: data.variante_nombre,
        espesor: data.espesor || null,
      };
      console.log('Insertando material:', materialInsert);
      insertPromises.push(
        supabase.from('productos_gran_formato_materiales').insert(materialInsert)
      );

      if (data.servicios.length > 0) {
        console.log('Insertando servicios:', data.servicios);
        insertPromises.push(
          supabase.from('productos_gran_formato_servicios').insert(
            data.servicios.map((servicioId) => ({
              producto_gran_formato_id: productoId,
              servicio_id: servicioId,
              is_active: true,
            }))
          )
        );
      }

      if (data.acabados.length > 0) {
        console.log('Insertando acabados:', data.acabados);
        insertPromises.push(
          supabase.from('productos_gran_formato_acabados').insert(
            data.acabados.map((acabadoId) => ({
              producto_gran_formato_id: productoId,
              acabado_id: acabadoId,
              is_active: true,
            }))
          )
        );
      }

      console.log('Ejecutando inserciones...');
      const results = await Promise.all(insertPromises);

      const insertErrors = results.filter((r) => r.error);

      if (insertErrors.length > 0) {
        console.error('Errores encontrados:', insertErrors);
        throw new Error(`Error al insertar relaciones: ${insertErrors.map(e => e.error?.message).join(', ')}`);
      }

      console.log('=== PRODUCTO GRAN FORMATO CREADO EXITOSAMENTE ===');
      return productoData;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Error al crear producto';
      setError(errorMsg);
      console.error('Error creating producto gran formato:', err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const updateProducto = async (id: string, data: CreateProductoGranFormatoData) => {
    try {
      setIsLoading(true);
      setError(null);

      const { error: updateError } = await supabase
        .from('productos_gran_formato')
        .update({
          nombre: data.nombre,
          tipo_venta: data.tipo_venta,
          anchos_disponibles: data.anchos_disponibles,
          impuesto_iva: data.impuesto_iva,
          rango_precio_id: data.rango_precio_id || null,
          ruta_produccion_id: data.ruta_produccion_id || null,
          cantidad_minima: data.cantidad_minima || null,
        })
        .eq('id', id)
        .eq('company_id', profile?.company_id);

      if (updateError) throw updateError;

      await Promise.all([
        supabase.from('productos_gran_formato_tecnologias').delete().eq('producto_gran_formato_id', id),
        supabase.from('productos_gran_formato_materiales').delete().eq('producto_gran_formato_id', id),
        supabase.from('productos_gran_formato_servicios').delete().eq('producto_gran_formato_id', id),
        supabase.from('productos_gran_formato_acabados').delete().eq('producto_gran_formato_id', id),
      ]);

      const insertPromises = [];

      for (const tecTinta of data.tecnologias_tintas) {
        insertPromises.push(
          supabase.from('productos_gran_formato_tecnologias').insert({
            producto_gran_formato_id: id,
            tecnologia_id: tecTinta.tecnologia_id,
            tintas: tecTinta.tintas,
          })
        );
      }

      insertPromises.push(
        supabase.from('productos_gran_formato_materiales').insert({
          producto_gran_formato_id: id,
          material_id: data.material_id,
          variante_nombre: data.variante_nombre,
          espesor: data.espesor || null,
        })
      );

      if (data.servicios.length > 0) {
        insertPromises.push(
          supabase.from('productos_gran_formato_servicios').insert(
            data.servicios.map((servicioId) => ({
              producto_gran_formato_id: id,
              servicio_id: servicioId,
              is_active: true,
            }))
          )
        );
      }

      if (data.acabados.length > 0) {
        insertPromises.push(
          supabase.from('productos_gran_formato_acabados').insert(
            data.acabados.map((acabadoId) => ({
              producto_gran_formato_id: id,
              acabado_id: acabadoId,
              is_active: true,
            }))
          )
        );
      }

      const results = await Promise.all(insertPromises);
      const insertErrors = results.filter((r) => r.error);

      if (insertErrors.length > 0) {
        throw new Error('Error al actualizar relaciones del producto');
      }

      await fetchProducto();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Error al actualizar producto';
      setError(errorMsg);
      console.error('Error updating producto gran formato:', err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const toggleStatus = async (id: string) => {
    try {
      setIsLoading(true);
      setError(null);

      const { data: currentData } = await supabase
        .from('productos_gran_formato')
        .select('is_active')
        .eq('id', id)
        .eq('company_id', profile?.company_id)
        .single();

      if (!currentData) throw new Error('Producto no encontrado');

      const { error: updateError } = await supabase
        .from('productos_gran_formato')
        .update({ is_active: !currentData.is_active })
        .eq('id', id)
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

  const deleteProducto = async (id: string) => {
    try {
      setIsLoading(true);
      setError(null);

      const { error: deleteError } = await supabase
        .from('productos_gran_formato')
        .delete()
        .eq('id', id)
        .eq('company_id', profile?.company_id);

      if (deleteError) throw deleteError;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Error al eliminar producto';
      setError(errorMsg);
      console.error('Error deleting producto gran formato:', err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    producto,
    isLoading,
    error,
    createProducto,
    updateProducto,
    toggleStatus,
    deleteProducto,
    refetch: fetchProducto,
  };
}
