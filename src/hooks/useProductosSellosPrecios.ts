import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import type { ProductoSello, ProductoSelloPrecio } from '../types/database';

export interface ProductoSelloConPrecio {
  id: string;
  nombre: string;
  tipo_producto: string;
  precio_unitario: number;
  precio_id: string | null;
}

export interface PrecioSelloInput {
  producto_id: string;
  precio_unitario: number;
}

export function useProductosSellosPrecios() {
  const [productos, setProductos] = useState<ProductoSelloConPrecio[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user, profile } = useAuth();

  useEffect(() => {
    if (profile?.company_id) {
      fetchProductosConPrecios();
    } else if (user && !profile) {
      setIsLoading(true);
    } else {
      setIsLoading(false);
    }
  }, [profile?.company_id, user]);

  const fetchProductosConPrecios = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const { data: productosData, error: productosError } = await supabase
        .from('productos_sellos')
        .select('id, nombre, tipo_producto')
        .eq('company_id', profile?.company_id)
        .eq('is_active', true)
        .order('nombre', { ascending: true });

      if (productosError) throw productosError;

      if (!productosData || productosData.length === 0) {
        setProductos([]);
        setIsLoading(false);
        return;
      }

      const productosIds = productosData.map((p) => p.id);

      const { data: preciosData, error: preciosError } = await supabase
        .from('productos_sellos_precios')
        .select('*')
        .in('producto_id', productosIds);

      if (preciosError) throw preciosError;

      const preciosMap = new Map<string, ProductoSelloPrecio>();
      preciosData?.forEach((precio) => {
        preciosMap.set(precio.producto_id, precio);
      });

      const productosConPrecios: ProductoSelloConPrecio[] = productosData.map((producto) => {
        const precio = preciosMap.get(producto.id);
        return {
          id: producto.id,
          nombre: producto.nombre,
          tipo_producto: producto.tipo_producto,
          precio_unitario: precio?.precio_unitario || 0,
          precio_id: precio?.id || null,
        };
      });

      setProductos(productosConPrecios);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar productos con precios');
      console.error('Error fetching productos sellos con precios:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const saveAllPrecios = async (precios: PrecioSelloInput[]): Promise<boolean> => {
    try {
      setIsSaving(true);
      setError(null);

      const updatePromises: Promise<any>[] = [];
      const insertPromises: Promise<any>[] = [];

      for (const precio of precios) {
        if (precio.precio_unitario <= 0) {
          continue;
        }

        const productoConPrecio = productos.find((p) => p.id === precio.producto_id);

        if (productoConPrecio?.precio_id) {
          updatePromises.push(
            supabase
              .from('productos_sellos_precios')
              .update({ precio_unitario: precio.precio_unitario })
              .eq('id', productoConPrecio.precio_id)
          );
        } else {
          insertPromises.push(
            supabase
              .from('productos_sellos_precios')
              .insert([
                {
                  producto_id: precio.producto_id,
                  precio_unitario: precio.precio_unitario,
                },
              ])
          );
        }
      }

      const allPromises = [...updatePromises, ...insertPromises];

      if (allPromises.length > 0) {
        const results = await Promise.all(allPromises);

        const errors = results.filter((result) => result.error);
        if (errors.length > 0) {
          throw new Error(`Error al guardar algunos precios: ${errors.map((e) => e.error.message).join(', ')}`);
        }
      }

      await fetchProductosConPrecios();

      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar precios');
      console.error('Error saving precios sellos:', err);
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  return {
    productos,
    isLoading,
    isSaving,
    error,
    saveAllPrecios,
    refetch: fetchProductosConPrecios,
  };
}
