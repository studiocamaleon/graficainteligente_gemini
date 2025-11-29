import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';

export interface MaterialUVInfo {
  id: string;
  material_nombre: string;
  variante_nombre: string;
  espesor_mm: number | null;
  ancho_placa_cm: number;
  alto_placa_cm: number;
  precio_placa: number;
  precio_mt2: number;
}

export interface PrecioImpresionUVInfo {
  id: string;
  tinta: string;
  rango_mt2_min: number;
  rango_mt2_max: number | null;
  precio_mt2: number;
}

export interface ProductoImpresionUVParaPrecios {
  id: string;
  nombre: string;
  tecnologia_id: string;
  tintas: string[];
  ancho_minimo: number | null;
  ancho_maximo: number | null;
  alto_minimo: number | null;
  alto_maximo: number | null;
  permite_material_cliente: boolean;
  cantidad_minima: number;
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
        .eq('activo', true)
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
              variante_nombre,
              espesor_mm,
              ancho_placa_cm,
              alto_placa_cm,
              precio_placa,
              precio_mt2,
              materiales!inner (
                id,
                nombre
              )
            `)
            .eq('producto_uv_id', producto.id)
            .eq('is_active', true)
            .order('materiales(nombre)');

          if (materialesError) {
            console.error('Error fetching materiales:', materialesError);
          }

          // Mapear materiales
          const materiales: MaterialUVInfo[] = (materialesData || []).map((mat: any) => ({
            id: mat.id,
            material_nombre: mat.materiales.nombre,
            variante_nombre: mat.variante_nombre,
            espesor_mm: mat.espesor_mm,
            ancho_placa_cm: mat.ancho_placa_cm,
            alto_placa_cm: mat.alto_placa_cm,
            precio_placa: mat.precio_placa,
            precio_mt2: mat.precio_mt2,
          }));

          // Fetch precios de impresión del producto
          const { data: preciosData, error: preciosError } = await supabase
            .from('productos_impresion_uv_rigidos_precios_impresion')
            .select('*')
            .eq('producto_uv_id', producto.id)
            .order('tinta')
            .order('rango_mt2_min');

          if (preciosError) {
            console.error('Error fetching precios:', preciosError);
          }

          const precios_impresion: PrecioImpresionUVInfo[] = (preciosData || []).map((precio) => ({
            id: precio.id,
            tinta: precio.tinta,
            rango_mt2_min: precio.rango_mt2_min,
            rango_mt2_max: precio.rango_mt2_max,
            precio_mt2: precio.precio_mt2,
          }));

          return {
            id: producto.id,
            nombre: producto.nombre,
            tecnologia_id: producto.tecnologia_id,
            tintas: producto.tintas,
            ancho_minimo: producto.ancho_minimo,
            ancho_maximo: producto.ancho_maximo,
            alto_minimo: producto.alto_minimo,
            alto_maximo: producto.alto_maximo,
            permite_material_cliente: producto.permite_material_cliente,
            cantidad_minima: producto.cantidad_minima,
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
