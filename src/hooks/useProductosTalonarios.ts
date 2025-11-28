import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';

export interface MedidaDisponible {
  ancho: number;
  alto: number;
}

export interface ProductoTalonarios {
  id: string;
  company_id: string;
  nombre: string;
  medidas_disponibles: MedidaDisponible[];
  tipo_copia: string[];
  producto_impreso: boolean;
  tipo_venta: 'unidades' | 'cantidades_fijas';
  cantidades_fijas: number[];
  impuesto_iva: number;
  ruta_produccion_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProductoTalonarioConRelaciones extends ProductoTalonarios {
  tecnologias: Array<{
    id: string;
    tecnologia_id: string;
    tecnologia_nombre: string;
    tintas: string[];
  }>;
  materiales: Array<{
    id: string;
    material_id: string;
    material_nombre: string;
    variante_nombre: string;
    espesor: number | null;
    unidad_espesor: string | null;
  }>;
  servicios: Array<{
    id: string;
    servicio_id: string;
    servicio_nombre: string;
    is_active: boolean;
  }>;
  acabados: Array<{
    id: string;
    acabado_id: string;
    acabado_nombre: string;
    is_active: boolean;
  }>;
}

export interface CreateProductoTalonarioData {
  nombre: string;
  medidas_disponibles: MedidaDisponible[];
  tipo_copia: string[];
  producto_impreso: boolean;
  tipo_venta: 'unidades' | 'cantidades_fijas';
  cantidades_fijas: number[];
  impuesto_iva: number;
  ruta_produccion_id?: string;
  tecnologia_id: string;
  tintas: string[];
  material_id: string;
  variante_nombre: string;
  espesor?: number;
  servicios: string[];
  acabados: string[];
}

interface UseProductosTalonarioFilters {
  search?: string;
  isActive?: boolean;
  materialId?: string;
}

export function useProductosTalonarios(filters?: UseProductosTalonarioFilters) {
  const [productos, setProductos] = useState<ProductoTalonarios[]>([]);
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
  }, [profile?.company_id, filters?.search, filters?.isActive, filters?.materialId, user]);

  const fetchProductos = async () => {
    try {
      setIsLoading(true);
      setError(null);

      let query = supabase
        .from('productos_talonarios')
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
      console.error('Error fetching productos:', err);
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

export function useProductoTalonario(id?: string) {
  const [producto, setProducto] = useState<ProductoTalonarioConRelaciones | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user, profile } = useAuth();

  useEffect(() => {
    if (id && profile?.company_id) {
      fetchProducto();
    }
  }, [id, profile?.company_id]);

  const fetchProducto = async () => {
    if (!id) return;

    try {
      setIsLoading(true);
      setError(null);

      const { data: productoData, error: productoError } = await supabase
        .from('productos_talonarios')
        .select('*')
        .eq('id', id)
        .eq('company_id', profile?.company_id)
        .maybeSingle();

      if (productoError) throw productoError;
      if (!productoData) throw new Error('Producto no encontrado');

      const [tecnologiasRes, materialesRes, serviciosRes, acabadosRes] = await Promise.all([
        supabase
          .from('productos_talonarios_tecnologias')
          .select('id, tecnologia_id, tintas, tecnologias(nombre)')
          .eq('producto_talonario_id', id),
        supabase
          .from('productos_talonarios_materiales')
          .select('id, material_id, variante_nombre, espesor, materiales(nombre, unidad_espesor)')
          .eq('producto_talonario_id', id),
        supabase
          .from('productos_talonarios_servicios')
          .select('id, servicio_id, is_active, servicios(nombre)')
          .eq('producto_talonario_id', id),
        supabase
          .from('productos_talonarios_acabados')
          .select('id, acabado_id, is_active, acabados(nombre)')
          .eq('producto_talonario_id', id),
      ]);

      if (tecnologiasRes.error) throw tecnologiasRes.error;
      if (materialesRes.error) throw materialesRes.error;
      if (serviciosRes.error) throw serviciosRes.error;
      if (acabadosRes.error) throw acabadosRes.error;

      const productoCompleto: ProductoTalonarioConRelaciones = {
        ...productoData,
        tecnologias: (tecnologiasRes.data || []).map((t: any) => ({
          id: t.id,
          tecnologia_id: t.tecnologia_id,
          tecnologia_nombre: t.tecnologias?.nombre || '',
          tintas: t.tintas || [],
        })),
        materiales: (materialesRes.data || []).map((m: any) => ({
          id: m.id,
          material_id: m.material_id,
          material_nombre: m.materiales?.nombre || '',
          variante_nombre: m.variante_nombre,
          espesor: m.espesor,
          unidad_espesor: m.materiales?.unidad_espesor || null,
        })),
        servicios: (serviciosRes.data || []).map((s: any) => ({
          id: s.id,
          servicio_id: s.servicio_id,
          servicio_nombre: s.servicios?.nombre || '',
          is_active: s.is_active,
        })),
        acabados: (acabadosRes.data || []).map((a: any) => ({
          id: a.id,
          acabado_id: a.acabado_id,
          acabado_nombre: a.acabados?.nombre || '',
          is_active: a.is_active,
        })),
      };

      setProducto(productoCompleto);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar producto');
      console.error('Error fetching producto:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const createProducto = async (data: CreateProductoTalonarioData) => {
    try {
      setIsLoading(true);
      setError(null);

      console.log('=== CREANDO PRODUCTO LASER ===');
      console.log('Datos recibidos:', data);
      console.log('Tecnología ID:', data.tecnologia_id);
      console.log('Tintas:', data.tintas);

      const { data: productoData, error: productoError } = await supabase
        .from('productos_talonarios')
        .insert({
          company_id: profile?.company_id,
          nombre: data.nombre,
          medidas_disponibles: data.medidas_disponibles,
          tipo_copia: data.tipo_copia,
          producto_impreso: data.producto_impreso,
          tipo_venta: data.tipo_venta,
          cantidades_fijas: data.cantidades_fijas,
          impuesto_iva: data.impuesto_iva,
          ruta_produccion_id: data.ruta_produccion_id || null,
        })
        .select()
        .single();

      if (productoError) throw productoError;

      const productoId = productoData.id;
      console.log('Producto creado con ID:', productoId);

      const insertPromises = [];

      const tecnologiaInsert = {
        producto_talonario_id: productoId,
        tecnologia_id: data.tecnologia_id,
        tintas: data.tintas,
      };
      console.log('Insertando tecnología:', tecnologiaInsert);
      insertPromises.push(
        supabase.from('productos_talonarios_tecnologias').insert(tecnologiaInsert)
      );

      const materialInsert = {
        producto_talonario_id: productoId,
        material_id: data.material_id,
        variante_nombre: data.variante_nombre,
        espesor: data.espesor || null,
      };
      console.log('Insertando material:', materialInsert);
      insertPromises.push(
        supabase.from('productos_talonarios_materiales').insert(materialInsert)
      );

      if (data.servicios.length > 0) {
        console.log('Insertando servicios:', data.servicios);
        insertPromises.push(
          supabase.from('productos_talonarios_servicios').insert(
            data.servicios.map((servicioId) => ({
              producto_talonario_id: productoId,
              servicio_id: servicioId,
              is_active: true,
            }))
          )
        );
      }

      if (data.acabados.length > 0) {
        console.log('Insertando acabados:', data.acabados);
        insertPromises.push(
          supabase.from('productos_talonarios_acabados').insert(
            data.acabados.map((acabadoId) => ({
              producto_talonario_id: productoId,
              acabado_id: acabadoId,
              is_active: true,
            }))
          )
        );
      }

      console.log('Ejecutando inserciones...');
      const results = await Promise.all(insertPromises);

      console.log('Resultados de inserciones:', results);
      results.forEach((result, index) => {
        if (result.error) {
          console.error(`Error en inserción ${index}:`, result.error);
        } else {
          console.log(`Inserción ${index} exitosa:`, result.data);
        }
      });

      const insertErrors = results.filter((r) => r.error);

      if (insertErrors.length > 0) {
        console.error('Errores encontrados:', insertErrors);
        insertErrors.forEach((err, index) => {
          console.error(`Error detallado ${index}:`, err.error);
        });
        throw new Error(`Error al insertar relaciones: ${insertErrors.map(e => e.error?.message).join(', ')}`);
      }

      console.log('=== PRODUCTO CREADO EXITOSAMENTE ===');
      return productoData;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Error al crear producto';
      setError(errorMsg);
      console.error('Error creating producto:', err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const updateProducto = async (id: string, data: CreateProductoTalonarioData) => {
    try {
      setIsLoading(true);
      setError(null);

      const { error: updateError } = await supabase
        .from('productos_talonarios')
        .update({
          nombre: data.nombre,
          medidas_disponibles: data.medidas_disponibles,
          tipo_copia: data.tipo_copia,
          producto_impreso: data.producto_impreso,
          tipo_venta: data.tipo_venta,
          cantidades_fijas: data.cantidades_fijas,
          impuesto_iva: data.impuesto_iva,
          ruta_produccion_id: data.ruta_produccion_id || null,
        })
        .eq('id', id)
        .eq('company_id', profile?.company_id);

      if (updateError) throw updateError;

      await Promise.all([
        supabase.from('productos_talonarios_tecnologias').delete().eq('producto_talonario_id', id),
        supabase.from('productos_talonarios_materiales').delete().eq('producto_talonario_id', id),
        supabase.from('productos_talonarios_servicios').delete().eq('producto_talonario_id', id),
        supabase.from('productos_talonarios_acabados').delete().eq('producto_talonario_id', id),
      ]);

      const insertPromises = [];

      insertPromises.push(
        supabase.from('productos_talonarios_tecnologias').insert({
          producto_talonario_id: id,
          tecnologia_id: data.tecnologia_id,
          tintas: data.tintas,
        })
      );

      insertPromises.push(
        supabase.from('productos_talonarios_materiales').insert({
          producto_talonario_id: id,
          material_id: data.material_id,
          variante_nombre: data.variante_nombre,
          espesor: data.espesor || null,
        })
      );

      if (data.servicios.length > 0) {
        insertPromises.push(
          supabase.from('productos_talonarios_servicios').insert(
            data.servicios.map((servicioId) => ({
              producto_talonario_id: id,
              servicio_id: servicioId,
              is_active: true,
            }))
          )
        );
      }

      if (data.acabados.length > 0) {
        insertPromises.push(
          supabase.from('productos_talonarios_acabados').insert(
            data.acabados.map((acabadoId) => ({
              producto_talonario_id: id,
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
      console.error('Error updating producto:', err);
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
        .from('productos_talonarios')
        .select('is_active')
        .eq('id', id)
        .eq('company_id', profile?.company_id)
        .single();

      if (!currentData) throw new Error('Producto no encontrado');

      const { error: updateError } = await supabase
        .from('productos_talonarios')
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
        .from('productos_talonarios')
        .delete()
        .eq('id', id)
        .eq('company_id', profile?.company_id);

      if (deleteError) throw deleteError;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Error al eliminar producto';
      setError(errorMsg);
      console.error('Error deleting producto:', err);
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
