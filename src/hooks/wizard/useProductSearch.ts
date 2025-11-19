import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useDebounce } from '../useDebounce';
import type { ProductSearchResult } from '../../types/wizard';

export function useProductSearch(searchTerm: string) {
  const [products, setProducts] = useState<ProductSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const debouncedSearch = useDebounce(searchTerm, 300);

  useEffect(() => {
    if (!debouncedSearch || debouncedSearch.length < 2) {
      setProducts([]);
      return;
    }

    const searchProducts = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const { data: productsData, error: productsError } = await supabase
          .from('productos')
          .select(`
            id,
            nombre,
            descripcion,
            activo,
            categorias!inner(nombre),
            productos_impresion_laser!inner(
              id,
              tipo_venta,
              cantidades_fijas,
              cantidad_minima,
              caras_impresas_disponibles,
              materiales!inner(id, nombre),
              material_variantes!inner(id, nombre)
            )
          `)
          .eq('activo', true)
          .eq('categorias.nombre', 'Impresión Laser')
          .or(`nombre.ilike.%${debouncedSearch}%,descripcion.ilike.%${debouncedSearch}%`)
          .order('nombre');

        if (productsError) throw productsError;

        if (!productsData || productsData.length === 0) {
          setProducts([]);
          setIsLoading(false);
          return;
        }

        const results: ProductSearchResult[] = [];

        for (const prod of productsData) {
          const laserData = Array.isArray(prod.productos_impresion_laser)
            ? prod.productos_impresion_laser[0]
            : prod.productos_impresion_laser;

          if (!laserData) continue;

          const { data: medidasData } = await supabase
            .from('productos_impresion_laser_precios')
            .select('medida_ancho, medida_alto')
            .eq('producto_laser_id', laserData.id);

          const medidasUnicas = new Map<string, { ancho: number; alto: number }>();
          if (medidasData) {
            medidasData.forEach(m => {
              const key = `${m.medida_ancho}x${m.medida_alto}`;
              if (!medidasUnicas.has(key)) {
                medidasUnicas.set(key, { ancho: m.medida_ancho, alto: m.medida_alto });
              }
            });
          }

          const medidas_disponibles = Array.from(medidasUnicas.values()).map(m => ({
            ancho: m.ancho,
            alto: m.alto,
            display: `${m.ancho} x ${m.alto} cm`,
          }));

          const { data: tintasData } = await supabase
            .from('productos_impresion_laser_precios')
            .select('tecnologia_tintas!inner(id, nombre, tipo)')
            .eq('producto_laser_id', laserData.id);

          const tintasUnicas = new Map();
          if (tintasData) {
            tintasData.forEach(t => {
              const tinta = Array.isArray(t.tecnologia_tintas) ? t.tecnologia_tintas[0] : t.tecnologia_tintas;
              if (tinta && !tintasUnicas.has(tinta.id)) {
                tintasUnicas.set(tinta.id, {
                  tinta_id: tinta.id,
                  nombre: tinta.nombre,
                  tipo: tinta.tipo,
                });
              }
            });
          }

          const { data: precioMinData } = await supabase
            .from('productos_impresion_laser_precios')
            .select('precio_base')
            .eq('producto_laser_id', laserData.id)
            .order('precio_base', { ascending: true })
            .limit(1)
            .maybeSingle();

          const categoria = Array.isArray(prod.categorias) ? prod.categorias[0] : prod.categorias;
          const material = Array.isArray(laserData.materiales) ? laserData.materiales[0] : laserData.materiales;
          const variante = Array.isArray(laserData.material_variantes) ? laserData.material_variantes[0] : laserData.material_variantes;

          results.push({
            producto_id: prod.id,
            producto_laser_id: laserData.id,
            nombre: prod.nombre,
            descripcion: prod.descripcion,
            categoria_nombre: categoria?.nombre || 'Impresión Laser',
            tipo_venta: laserData.tipo_venta,
            cantidades_fijas: laserData.cantidades_fijas || [],
            cantidad_minima: laserData.cantidad_minima,
            medidas_disponibles,
            material_nombre: material?.nombre || '',
            variante_nombre: variante?.nombre || '',
            tintas_disponibles: Array.from(tintasUnicas.values()),
            caras_disponibles: laserData.caras_impresas_disponibles || [],
            tiene_precios: medidasData && medidasData.length > 0,
            precio_desde: precioMinData?.precio_base || null,
          });
        }

        setProducts(results);
      } catch (err) {
        console.error('Error searching products:', err);
        setError(err instanceof Error ? err.message : 'Error al buscar productos');
      } finally {
        setIsLoading(false);
      }
    };

    searchProducts();
  }, [debouncedSearch]);

  return { products, isLoading, error };
}
