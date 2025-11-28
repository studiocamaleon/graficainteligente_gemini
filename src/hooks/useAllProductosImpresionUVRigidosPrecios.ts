import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';

export interface MaterialUVInfo {
  id: string;
  material_nombre: string;
  variante_nombre: string;
  espesor: number | null;
  unidad_espesor: string | null;
  dim_ancho_cm: number;
  dim_alto_cm: number;
  precio_por_m2: number;
}

export interface PrecioImpresionUVInfo {
  id: string;
  tinta: string;
  rango_minimo: number;
  rango_maximo: number | null;
  precio_por_m2: number;
}

export interface ProductoImpresionUVParaPrecios {
  id: string;
  nombre: string;
  limite_ancho_cm: number | null;
  limite_alto_cm: number | null;
  material_cliente_permitido: boolean;
  materiales: MaterialUVInfo[];
  precios_impresion: PrecioImpresionUVInfo[];
}

export function useAllProductosImpresionUVRigidosPrecios() {
  const [productos, setProductos] = useState<ProductoImpresionUVParaPrecios[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { profile } = useAuth();

  useEffect(() => {
    if (profile?.company_id) {
      fetchAllProductosConPrecios();
    }
  }, [profile?.company_id]);

  const fetchAllProductosConPrecios = async () => {
    if (!profile?.company_id) return;

    try {
      setIsLoading(true);
      setError(null);

      // 1. Fetch todos los productos UV activos
      const { data: productosData, error: productosError } = await supabase
        .from('productos_impresion_uv_rigidos')
        .select('*')
        .eq('company_id', profile.company_id)
        .eq('is_active', true)
        .order('nombre');

      if (productosError) throw productosError;

      if (!productosData || productosData.length === 0) {
        setProductos([]);
        setIsLoading(false);
        return;
      }

      // 2. Para cada producto, fetch sus materiales
      const productosConDatos = await Promise.all(
        productosData.map(async (producto) => {
          // Fetch materiales del producto
          const { data: materialesData, error: materialesError } = await supabase
            .from('productos_impresion_uv_rigidos_materiales')
            .select(`
              id,
              dim_ancho_cm,
              dim_alto_cm,
              precio_por_m2,
              materiales!inner (
                id,
                nombre,
                variante_nombre,
                espesor,
                unidad_espesor
              )
            `)
            .eq('producto_uv_id', producto.id)
            .order('materiales(nombre)');

          if (materialesError) {
            console.error('Error fetching materiales:', materialesError);
          }

          // Mapear materiales
          const materiales: MaterialUVInfo[] = (materialesData || []).map((mat: any) => ({
            id: mat.id,
            material_nombre: mat.materiales.nombre,
            variante_nombre: mat.materiales.variante_nombre,
            espesor: mat.materiales.espesor,
            unidad_espesor: mat.materiales.unidad_espesor,
            dim_ancho_cm: mat.dim_ancho_cm,
            dim_alto_cm: mat.dim_alto_cm,
            precio_por_m2: mat.precio_por_m2,
          }));

          // Fetch precios de impresión del producto
          const { data: preciosData, error: preciosError } = await supabase
            .from('productos_impresion_uv_rigidos_precios_impresion')
            .select('*')
            .eq('producto_uv_id', producto.id)
            .order('tinta')
            .order('rango_minimo');

          if (preciosError) {
            console.error('Error fetching precios:', preciosError);
          }

          const precios_impresion: PrecioImpresionUVInfo[] = (preciosData || []).map((precio) => ({
            id: precio.id,
            tinta: precio.tinta,
            rango_minimo: precio.rango_minimo,
            rango_maximo: precio.rango_maximo,
            precio_por_m2: precio.precio_por_m2,
          }));

          return {
            id: producto.id,
            nombre: producto.nombre,
            limite_ancho_cm: producto.limite_ancho_cm,
            limite_alto_cm: producto.limite_alto_cm,
            material_cliente_permitido: producto.material_cliente_permitido,
            materiales,
            precios_impresion,
          };
        })
      );

      setProductos(productosConDatos);
    } catch (err) {
      console.error('Error fetching productos UV con precios:', err);
      setError(err instanceof Error ? err.message : 'Error al cargar productos UV');
    } finally {
      setIsLoading(false);
    }
  };

  const refetch = () => {
    if (profile?.company_id) {
      fetchAllProductosConPrecios();
    }
  };

  return {
    productos,
    isLoading,
    error,
    refetch,
  };
}

export type { ProductosAgrupados as ProductosAgrupadosPorMaterial };
