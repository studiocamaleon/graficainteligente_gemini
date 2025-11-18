import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import { normalizeRangoMax, normalizeRangoMin } from '../utils/rangoUtils';

export interface RangoPrecio {
  min: number;
  max: number;
}

export interface ProductoPCParaPrecios {
  id: string;
  nombre: string;
  anchos_disponibles: number[];
  rango_precio_id: string;
  rango_precio: {
    id: string;
    nombre: string;
    unidad_medida: string;
    rangos: RangoPrecio[];
  };
}

export interface ProductoPorAncho {
  producto_id: string;
  producto_nombre: string;
  ancho: number;
  rango_precio_id: string;
  rango_nombre: string;
  unidad_medida: string;
  rangos: RangoPrecio[];
  precios?: Map<string, number>;
}

export interface PrecioPCInput {
  producto_id: string;
  ancho: number;
  cantidad_desde: number;
  cantidad_hasta: number | null;
  precio: number;
}

export function useAllProductosPlotterCortePrecios() {
  const [productos, setProductos] = useState<ProductoPCParaPrecios[]>([]);
  const [productosPorAncho, setProductosPorAncho] = useState<ProductoPorAncho[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { profile } = useAuth();

  useEffect(() => {
    if (profile?.company_id) {
      fetchProductosConPrecios();
    }
  }, [profile?.company_id]);

  const fetchProductosConPrecios = async () => {
    if (!profile?.company_id) return;

    try {
      setIsLoading(true);
      setError(null);

      const { data: productosData, error: productosError } = await supabase
        .from('productos_plotter_corte')
        .select(`
          id,
          nombre,
          anchos_disponibles,
          rango_precio_id,
          is_active
        `)
        .eq('company_id', profile.company_id)
        .eq('is_active', true)
        .not('rango_precio_id', 'is', null)
        .order('nombre', { ascending: true });

      if (productosError) throw productosError;

      if (!productosData || productosData.length === 0) {
        setProductos([]);
        setProductosPorAncho([]);
        setIsLoading(false);
        return;
      }

      const rangosIds = [...new Set(productosData.map(p => p.rango_precio_id).filter(Boolean))];

      const { data: rangosData, error: rangosError } = await supabase
        .from('rangos_precio')
        .select('id, nombre, unidad_medida, rangos')
        .in('id', rangosIds);

      if (rangosError) throw rangosError;

      const rangosMap = new Map(rangosData?.map(r => [r.id, r]) || []);

      const productosConRangos: ProductoPCParaPrecios[] = productosData
        .map(producto => {
          const rango = rangosMap.get(producto.rango_precio_id!);
          if (!rango) return null;

          return {
            id: producto.id,
            nombre: producto.nombre,
            anchos_disponibles: producto.anchos_disponibles || [],
            rango_precio_id: producto.rango_precio_id!,
            rango_precio: {
              id: rango.id,
              nombre: rango.nombre,
              unidad_medida: rango.unidad_medida,
              rangos: rango.rangos || [],
            },
          };
        })
        .filter((p): p is ProductoPCParaPrecios => p !== null);

      setProductos(productosConRangos);

      const productosIds = productosConRangos.map(p => p.id);
      const { data: preciosData, error: preciosError } = await supabase
        .from('productos_plotter_corte_precios')
        .select('producto_id, ancho, cantidad_desde, cantidad_hasta, precio')
        .in('producto_id', productosIds);

      if (preciosError) throw preciosError;

      const preciosMap = new Map<string, Map<string, number>>();
      preciosData?.forEach(precio => {
        const productoAnchoKey = `${precio.producto_id}-${precio.ancho}`;
        if (!preciosMap.has(productoAnchoKey)) {
          preciosMap.set(productoAnchoKey, new Map());
        }
        const rangoKey = `${normalizeRangoMin(precio.cantidad_desde)}-${normalizeRangoMax(precio.cantidad_hasta)}`;
        preciosMap.get(productoAnchoKey)!.set(rangoKey, precio.precio);
      });

      const productosPorAnchoArray: ProductoPorAncho[] = [];
      productosConRangos.forEach(producto => {
        producto.anchos_disponibles.forEach(ancho => {
          const productoAnchoKey = `${producto.id}-${ancho}`;
          const preciosProductoAncho = preciosMap.get(productoAnchoKey);

          productosPorAnchoArray.push({
            producto_id: producto.id,
            producto_nombre: producto.nombre,
            ancho,
            rango_precio_id: producto.rango_precio_id,
            rango_nombre: producto.rango_precio.nombre,
            unidad_medida: producto.rango_precio.unidad_medida,
            rangos: producto.rango_precio.rangos,
            precios: preciosProductoAncho,
          });
        });
      });

      setProductosPorAncho(productosPorAnchoArray);
    } catch (err) {
      console.error('Error fetching productos plotter corte precios:', err);
      setError(err instanceof Error ? err.message : 'Error al cargar datos');
    } finally {
      setIsLoading(false);
    }
  };

  const saveAllPrecios = async (precios: PrecioPCInput[]) => {
    if (!profile?.company_id) {
      throw new Error('No se encontró la empresa del usuario');
    }

    try {
      setIsSaving(true);
      setError(null);

      const combinacionesUnicas = new Map<string, { producto_id: string; ancho: number }>();

      precios.forEach(precio => {
        const key = `${precio.producto_id}-${precio.ancho}`;
        if (!combinacionesUnicas.has(key)) {
          combinacionesUnicas.set(key, {
            producto_id: precio.producto_id,
            ancho: precio.ancho,
          });
        }
      });

      for (const combinacion of combinacionesUnicas.values()) {
        const { error: deleteError } = await supabase
          .from('productos_plotter_corte_precios')
          .delete()
          .eq('producto_id', combinacion.producto_id)
          .eq('ancho', combinacion.ancho);

        if (deleteError) {
          console.error(`Error borrando precios para ${combinacion.producto_id}-${combinacion.ancho}:`, deleteError);
          throw deleteError;
        }
      }

      const preciosToInsert = precios
        .filter(p => p.precio > 0)
        .map(precio => ({
          producto_id: precio.producto_id,
          ancho: precio.ancho,
          cantidad_desde: precio.cantidad_desde,
          cantidad_hasta: precio.cantidad_hasta,
          precio: precio.precio,
        }));

      if (preciosToInsert.length > 0) {
        const { error: insertError } = await supabase
          .from('productos_plotter_corte_precios')
          .insert(preciosToInsert);

        if (insertError) {
          console.error('Error insertando precios:', insertError);
          throw insertError;
        }
      }

      await fetchProductosConPrecios();
    } catch (err) {
      console.error('Error saving precios:', err);
      setError(err instanceof Error ? err.message : 'Error al guardar precios');
      throw err;
    } finally {
      setIsSaving(false);
    }
  };

  return {
    productos,
    productosPorAncho,
    isLoading,
    isSaving,
    error,
    saveAllPrecios,
    refetch: fetchProductosConPrecios,
  };
}
