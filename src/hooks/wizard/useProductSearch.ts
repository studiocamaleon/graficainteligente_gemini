import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useDebounce } from '../useDebounce';
import { useAuth } from '../useAuth';
import type { ProductSearchResult } from '../../types/wizard';

export function useProductSearch(searchTerm: string) {
  const [products, setProducts] = useState<ProductSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { profile } = useAuth();

  const debouncedSearch = useDebounce(searchTerm, 300);

  useEffect(() => {
    if (!debouncedSearch || debouncedSearch.length < 2) {
      setProducts([]);
      return;
    }

    if (!profile?.company_id) {
      setError('No se encontró información de la empresa');
      return;
    }

    const searchProducts = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const { data: productsLaserData, error: productsError } = await supabase
          .from('productos_impresion_laser')
          .select('id, nombre, tipo_venta, cantidades_fijas, caras_impresas, is_active')
          .eq('company_id', profile.company_id)
          .eq('is_active', true)
          .ilike('nombre', `%${debouncedSearch}%`)
          .order('nombre');

        if (productsError) throw productsError;

        if (!productsLaserData || productsLaserData.length === 0) {
          setProducts([]);
          setIsLoading(false);
          return;
        }

        const results: ProductSearchResult[] = [];

        for (const laserData of productsLaserData) {
          const [materialesRes, medidasRes, tecnologiasRes, precioMinRes] = await Promise.all([
            supabase
              .from('productos_impresion_laser_materiales')
              .select('material_id, variante_nombre, materiales(id, nombre)')
              .eq('producto_laser_id', laserData.id)
              .limit(1)
              .maybeSingle(),

            supabase
              .from('productos_impresion_laser_precios')
              .select('medida_ancho, medida_alto')
              .eq('producto_laser_id', laserData.id),

            supabase
              .from('productos_impresion_laser_tecnologias')
              .select('tecnologia_id, tintas, tintas_info:get_tintas_info(tintas)')
              .eq('producto_laser_id', laserData.id)
              .limit(1)
              .maybeSingle(),

            supabase
              .from('productos_impresion_laser_precios')
              .select('precio')
              .eq('producto_laser_id', laserData.id)
              .order('precio', { ascending: true })
              .limit(1)
              .maybeSingle()
          ]);

          if (materialesRes.error || medidasRes.error || tecnologiasRes.error) {
            console.error('Error cargando datos del producto:', {
              materialesRes: materialesRes.error,
              medidasRes: medidasRes.error,
              tecnologiasRes: tecnologiasRes.error
            });
            continue;
          }

          const medidasUnicas = new Map<string, { ancho: number; alto: number }>();
          if (medidasRes.data) {
            medidasRes.data.forEach(m => {
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

          // Obtener información de tintas desde el array de texto
          let tintasDisponibles = [];
          if (tecnologiasRes.data && tecnologiasRes.data.tintas && tecnologiasRes.data.tintas.length > 0) {
            tintasDisponibles = tecnologiasRes.data.tintas.map((codigo: string) => {
              const nombresMap: Record<string, string> = {
                'K': 'Negro (K)',
                'CMYK': 'Cuatricromía (CMYK)',
                'CMYK+W': 'CMYK + Blanco',
                'CMYK+V': 'CMYK + Barniz',
                'CMYK+W+V': 'CMYK + Blanco + Barniz'
              };
              return {
                tinta: codigo,
                nombre: nombresMap[codigo] || codigo,
              };
            });
          }

          const material = materialesRes.data?.materiales;
          const materialNombre = Array.isArray(material) ? material[0]?.nombre : material?.nombre;
          const materialId = Array.isArray(material) ? material[0]?.id : material?.id;

          const varianteNombre = materialesRes.data?.variante_nombre || '';
          const varianteId = materialesRes.data?.material_id || '';

          let cantidad_minima = null;
          if (laserData.tipo_venta === 'cantidades_fijas' && laserData.cantidades_fijas && laserData.cantidades_fijas.length > 0) {
            cantidad_minima = Math.min(...laserData.cantidades_fijas);
          }

          results.push({
            producto_id: laserData.id,
            producto_laser_id: laserData.id,
            nombre: laserData.nombre,
            descripcion: null,
            categoria_nombre: 'Impresión Laser',
            tipo_venta: laserData.tipo_venta === 'cantidades_fijas' ? 'cantidad_fija' : 'unidad',
            cantidades_fijas: laserData.cantidades_fijas || [],
            cantidad_minima,
            medidas_disponibles,
            material_id: materialId || '',
            material_nombre: materialNombre || '',
            variante_id: varianteId || '',
            variante_nombre: varianteNombre || '',
            tintas_disponibles: tintasDisponibles,
            caras_disponibles: laserData.caras_impresas || [],
            tiene_precios: medidasRes.data && medidasRes.data.length > 0,
            precio_desde: precioMinRes.data?.precio || null,
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
  }, [debouncedSearch, profile?.company_id]);

  return { products, isLoading, error };
}
