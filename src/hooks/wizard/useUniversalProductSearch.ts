import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useDebounce } from '../useDebounce';
import { useAuth } from '../useAuth';

export type ProductCategory =
  | 'Impresion Laser'
  | 'Talonarios'
  | 'Impresion Gran Formato'
  | 'Materiales Rigidos'
  | 'Plotter de Corte'
  | 'Portabanners'
  | 'Sellos'
  | 'Centro de Copiado';

export interface UniversalProductSearchResult {
  id: string;
  nombre: string;
  categoria: ProductCategory;
  categoria_id: string;
  descripcion: string | null;
  precio_desde: number | null;
  tiene_precios: boolean;
  unidad_medida?: string;
  config_disponible: ProductConfig;
  es_compuesto?: boolean;
}

export interface ProductConfig {
  // Campos comunes
  tiene_medidas: boolean;
  medidas_disponibles?: { ancho: number; alto: number }[];

  tiene_cantidad: boolean;
  tipo_venta?: 'unidad' | 'cantidad_fija' | null;
  cantidades_fijas?: number[];
  cantidad_minima?: number | null;

  tiene_material: boolean;
  materiales?: { id: string; nombre: string; variante?: string }[];

  tiene_tecnologia: boolean;
  tecnologias?: { id: string; nombre: string; tintas?: string[] }[];

  tiene_tintas: boolean;
  tintas_disponibles?: string[];

  tiene_caras_impresion: boolean;
  caras_disponibles?: string[];

  tiene_espesor: boolean;
  espesores_disponibles?: number[];

  tiene_color: boolean;
  colores_disponibles?: string[];

  tiene_marca: boolean;
  marcas_disponibles?: string[];

  // Campos específicos
  config_especifica?: Record<string, any>;
}

export function useUniversalProductSearch(searchTerm: string) {
  const [products, setProducts] = useState<UniversalProductSearchResult[]>([]);
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
        const results: UniversalProductSearchResult[] = [];

        // Buscar en paralelo en todas las categorías usando allSettled para resiliencia
        const searchPromises = [
          searchImpresionLaser(profile.company_id!, debouncedSearch),
          searchTalonarios(profile.company_id!, debouncedSearch),
          searchGranFormato(profile.company_id!, debouncedSearch),
          searchMaterialesRigidos(profile.company_id!, debouncedSearch),
          searchPlotterCorte(profile.company_id!, debouncedSearch),
          searchPortabanners(profile.company_id!, debouncedSearch),
          searchSellos(profile.company_id!, debouncedSearch),
          searchProductosPersonalizados(profile.company_id!, debouncedSearch)
        ];

        const settlement = await Promise.allSettled(searchPromises);

        // Recopilar resultados exitosos e informar errores en consola por categoría
        settlement.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            results.push(...result.value);
          } else {
            console.warn(`[Search] Falló una de las categorías de búsqueda (index ${index}):`, result.reason);
          }
        });

        // Ordenar por nombre
        results.sort((a, b) => a.nombre.localeCompare(b.nombre));

        setProducts(results);
      } catch (err) {
        console.error('Error buscando productos:', err);
        setError(err instanceof Error ? err.message : 'Error al buscar productos');
        setProducts([]);
      } finally {
        setIsLoading(false);
      }
    };

    searchProducts();
  }, [debouncedSearch, profile?.company_id]);

  return { products, isLoading, error };
}

// ========================================
// BÚSQUEDA POR CATEGORÍA
// ========================================

async function searchImpresionLaser(
  companyId: string,
  searchTerm: string
): Promise<UniversalProductSearchResult[]> {
  const { data, error } = await supabase
    .from('productos_impresion_laser')
    .select('id, nombre, rango_precio:rangos_precio(unidad_medida)')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .ilike('nombre', `%${searchTerm}%`)
    .order('nombre')
    .limit(10);

  if (error) throw error;
  if (!data) return [];

  // Obtener categoría ID
  const { data: catData } = await (supabase as any)
    .from('categorias')
    .select('id')
    .eq('nombre', 'Impresion Laser')
    .eq('is_system_category', true)
    .single();

  return (data as any[]).map(p => ({
    id: p.id,
    nombre: p.nombre,
    categoria: 'Impresion Laser',
    categoria_id: catData?.id || '',
    descripcion: null,
    precio_desde: null,
    tiene_precios: false,
    unidad_medida: p.rango_precio?.unidad_medida,
    config_disponible: {
      tiene_medidas: true,
      tiene_cantidad: true,
      tiene_material: true,
      tiene_tecnologia: true,
      tiene_tintas: true,
      tiene_caras_impresion: true,
      tiene_espesor: false,
      tiene_color: false,
      tiene_marca: false,
    }
  }));
}

async function searchTalonarios(
  companyId: string,
  searchTerm: string
): Promise<UniversalProductSearchResult[]> {
  const { data, error } = await supabase
    .from('productos_talonarios')
    .select('id, nombre')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .ilike('nombre', `%${searchTerm}%`)
    .order('nombre')
    .limit(10);

  if (error) throw error;
  if (!data) return [];

  const { data: catData } = await (supabase as any)
    .from('categorias')
    .select('id')
    .eq('nombre', 'Talonarios')
    .eq('is_system_category', true)
    .single();

  return (data as any[]).map(p => ({
    id: p.id,
    nombre: p.nombre,
    categoria: 'Talonarios',
    categoria_id: catData?.id || '',
    descripcion: null,
    precio_desde: null,
    tiene_precios: false,
    config_disponible: {
      tiene_medidas: true,
      tiene_cantidad: true,
      tiene_material: true,
      tiene_tecnologia: true,
      tiene_tintas: true,
      tiene_caras_impresion: true,
      tiene_espesor: false,
      tiene_color: false,
      tiene_marca: false,
    }
  }));
}

async function searchGranFormato(
  companyId: string,
  searchTerm: string
): Promise<UniversalProductSearchResult[]> {
  const { data, error } = await supabase
    .from('productos_gran_formato')
    .select('id, nombre')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .ilike('nombre', `%${searchTerm}%`)
    .order('nombre')
    .limit(10);

  if (error) throw error;
  if (!data) return [];

  const { data: catData } = await (supabase as any)
    .from('categorias')
    .select('id')
    .eq('nombre', 'Impresion Gran Formato')
    .eq('is_system_category', true)
    .single();

  return (data as any[]).map(p => ({
    id: p.id,
    nombre: p.nombre,
    categoria: 'Impresion Gran Formato',
    categoria_id: catData?.id || '',
    descripcion: null,
    precio_desde: null,
    tiene_precios: false,
    config_disponible: {
      tiene_medidas: true,
      tiene_cantidad: true,
      tiene_material: true,
      tiene_tecnologia: true,
      tiene_tintas: true,
      tiene_caras_impresion: false,
      tiene_espesor: false,
      tiene_color: false,
      tiene_marca: false,
    }
  }));
}

async function searchMaterialesRigidos(
  companyId: string,
  searchTerm: string
): Promise<UniversalProductSearchResult[]> {
  const { data, error } = await supabase
    .from('productos_materiales_rigidos')
    .select('id, nombre')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .ilike('nombre', `%${searchTerm}%`)
    .order('nombre')
    .limit(10);

  if (error) throw error;
  if (!data) return [];

  const { data: catData } = await (supabase as any)
    .from('categorias')
    .select('id')
    .eq('nombre', 'Materiales Rigidos')
    .eq('is_system_category', true)
    .single();

  return (data as any[]).map(p => ({
    id: p.id,
    nombre: p.nombre,
    categoria: 'Materiales Rigidos',
    categoria_id: catData?.id || '',
    descripcion: null,
    precio_desde: null,
    tiene_precios: false,
    config_disponible: {
      tiene_medidas: true,
      tiene_cantidad: true,
      tiene_material: true,
      tiene_tecnologia: false,
      tiene_tintas: false,
      tiene_caras_impresion: false,
      tiene_espesor: true,
      tiene_color: false,
      tiene_marca: false,
    }
  }));
}

async function searchPlotterCorte(
  companyId: string,
  searchTerm: string
): Promise<UniversalProductSearchResult[]> {
  const { data, error } = await supabase
    .from('productos_plotter_corte')
    .select('id, nombre')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .ilike('nombre', `%${searchTerm}%`)
    .order('nombre')
    .limit(10);

  if (error) throw error;
  if (!data) return [];

  const { data: catData } = await (supabase as any)
    .from('categorias')
    .select('id')
    .eq('nombre', 'Plotter de Corte')
    .eq('is_system_category', true)
    .single();

  return (data as any[]).map(p => ({
    id: p.id,
    nombre: p.nombre,
    categoria: 'Plotter de Corte',
    categoria_id: catData?.id || '',
    descripcion: null,
    precio_desde: null,
    tiene_precios: false,
    config_disponible: {
      tiene_medidas: true,
      tiene_cantidad: true,
      tiene_material: false,
      tiene_tecnologia: false,
      tiene_tintas: false,
      tiene_caras_impresion: false,
      tiene_espesor: false,
      tiene_color: true,
      tiene_marca: true,
    }
  }));
}

async function searchPortabanners(
  companyId: string,
  searchTerm: string
): Promise<UniversalProductSearchResult[]> {
  const { data, error } = await supabase
    .from('productos_portabanners')
    .select('id, nombre')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .ilike('nombre', `%${searchTerm}%`)
    .order('nombre')
    .limit(10);

  if (error) throw error;
  if (!data) return [];

  const { data: catData } = await (supabase as any)
    .from('categorias')
    .select('id')
    .eq('nombre', 'Portabanners')
    .eq('is_system_category', true)
    .single();

  return (data as any[]).map(p => ({
    id: p.id,
    nombre: p.nombre,
    categoria: 'Portabanners',
    categoria_id: catData?.id || '',
    descripcion: null,
    precio_desde: null,
    tiene_precios: false,
    config_disponible: {
      tiene_medidas: true,
      tiene_cantidad: true,
      tiene_material: false,
      tiene_tecnologia: true,
      tiene_tintas: false,
      tiene_caras_impresion: false,
      tiene_espesor: false,
      tiene_color: false,
      tiene_marca: false,
    }
  }));
}

async function searchSellos(
  companyId: string,
  searchTerm: string
): Promise<UniversalProductSearchResult[]> {
  const { data, error } = await supabase
    .from('productos_sellos')
    .select('id, nombre')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .ilike('nombre', `%${searchTerm}%`)
    .order('nombre')
    .limit(10);

  if (error) throw error;
  if (!data) return [];

  const { data: catData } = await (supabase as any)
    .from('categorias')
    .select('id')
    .eq('nombre', 'Sellos')
    .eq('is_system_category', true)
    .single();

  return (data as any[]).map(p => ({
    id: p.id,
    nombre: p.nombre,
    categoria: 'Sellos',
    categoria_id: (catData as any)?.id || '',
    descripcion: null,
    precio_desde: null,
    tiene_precios: false,
    config_disponible: {
      tiene_medidas: true,
      tiene_cantidad: true,
      tiene_material: false,
      tiene_tecnologia: false,
      tiene_tintas: false,
      tiene_caras_impresion: false,
      tiene_espesor: false,
      tiene_color: false,
      tiene_marca: true,
    }
  }));
}

async function searchProductosPersonalizados(
  companyId: string,
  searchTerm: string
): Promise<UniversalProductSearchResult[]> {
  const { data, error } = await supabase
    .from('productos_personalizados')
    .select(`
      id, 
      nombre, 
      descripcion, 
      categoria_id,
      categorias!inner(nombre),
      medidas_ancho,
      medidas_alto
    `)
    .eq('company_id', companyId)
    .eq('es_plantilla', true)
    .eq('is_active', true)
    .ilike('nombre', `%${searchTerm}%`)
    .limit(10);

  if (error) throw error;
  if (!data) return [];

  return (data as any[]).map(p => ({
    id: p.id,
    nombre: p.nombre,
    categoria: (p.categorias as any).nombre as ProductCategory,
    categoria_id: p.categoria_id,
    descripcion: p.descripcion,
    precio_desde: null,
    tiene_precios: false,
    es_compuesto: true,
    config_disponible: {
      tiene_medidas: true,
      medidas_disponibles: [{ ancho: p.medidas_ancho, alto: p.medidas_alto }],
      tiene_cantidad: true,
      tiene_material: false,
      tiene_tecnologia: false,
      tiene_tintas: false,
      tiene_caras_impresion: false,
      tiene_espesor: false,
      tiene_color: false,
      tiene_marca: false,
    }
  }));
}
