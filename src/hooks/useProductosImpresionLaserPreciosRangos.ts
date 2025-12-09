import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';

export interface ProductoLaserPrecioRango {
  id: string;
  company_id: string;
  producto_laser_id: string;
  medida_ancho: number;
  medida_alto: number;
  tinta: string;
  rango_precio_min: number;
  rango_precio_max: number | null;
  cara_impresa: 'solo_frente' | 'frente_y_dorso';
  precio: number;
  created_at: string;
  updated_at: string;
}

export interface PrecioRangoInput {
  medida_ancho: number;
  medida_alto: number;
  tinta: string;
  rango_precio_min: number;
  rango_precio_max: number | null;
  cara_impresa: 'solo_frente' | 'frente_y_dorso';
  precio: number;
}

export interface PreciosPorCombinacionRangos {
  medida: { ancho: number; alto: number };
  tinta: string;
  cara_impresa: 'solo_frente' | 'frente_y_dorso';
  precios: ProductoLaserPrecioRango[];
}

export function useProductosImpresionLaserPreciosRangos(productoLaserId?: string) {
  const [precios, setPrecios] = useState<ProductoLaserPrecioRango[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { profile } = useAuth();

  useEffect(() => {
    if (productoLaserId && profile?.company_id) {
      fetchPrecios();
    } else {
      setPrecios([]);
    }
  }, [productoLaserId, profile?.company_id]);

  const fetchPrecios = async () => {
    if (!productoLaserId || !profile?.company_id) return;

    try {
      setIsLoading(true);
      setError(null);

      const { data, error: fetchError } = await (supabase
        .from('productos_impresion_laser_precios' as any)
        .select('*') as any)
        .eq('producto_laser_id', productoLaserId)
        .eq('company_id', profile.company_id)
        .order('medida_ancho', { ascending: true })
        .order('medida_alto', { ascending: true })
        .order('rango_precio_min', { ascending: true });

      if (fetchError) throw fetchError;

      console.log('🔍 [PreciosLaser] Precios obtenidos:', data?.length);
      if (data && data.length > 0) {
        console.log('🔍 [PreciosLaser] Ejemplo de precio:', data[0]);
      }

      setPrecios(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar precios');
      console.error('Error fetching precios rangos:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const savePreciosEnLote = async (
    productoLaserId: string,
    preciosInput: PrecioRangoInput[]
  ): Promise<void> => {
    if (!profile?.company_id) {
      throw new Error('No se pudo obtener el company_id del usuario');
    }

    try {
      setIsLoading(true);
      setError(null);

      const { error: deleteError } = await supabase
        .from('productos_impresion_laser_precios')
        .delete()
        .eq('producto_laser_id', productoLaserId)
        .eq('company_id', profile.company_id);


      if (deleteError) throw deleteError;

      const preciosValidos = preciosInput.filter((p) => p.precio > 0);

      if (preciosValidos.length === 0) {
        setPrecios([]);
        return;
      }

      const preciosParaInsertar = preciosValidos.map((p) => ({
        company_id: profile.company_id,
        producto_laser_id: productoLaserId,
        medida_ancho: p.medida_ancho,
        medida_alto: p.medida_alto,
        tinta: p.tinta,
        rango_precio_min: p.rango_precio_min,
        rango_precio_max: p.rango_precio_max,
        cara_impresa: p.cara_impresa,
        precio: p.precio,
        cantidad: null,
      }));

      const { data, error: insertError } = await (supabase
        .from('productos_impresion_laser_precios' as any)
        .insert(preciosParaInsertar as any)
        .select() as any);

      if (insertError) throw insertError;

      console.log('✅ [PreciosLaser] Precios guardados:', data?.length);

      setPrecios(data || []);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Error al guardar precios';
      console.error('❌ [PreciosLaser] Error detallado:', err);
      setError(errorMsg);

      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const buscarPrecioPorRango = async (
    productoLaserId: string,
    medidaAncho: number,
    medidaAlto: number,
    tinta: string,
    caraImpresa: 'solo_frente' | 'frente_y_dorso',
    rangoMin: number,
    rangoMax: number | null
  ): Promise<number | null> => {
    if (!profile?.company_id) return null;

    try {
      const client = supabase as any;
      let query = client
        .from('productos_impresion_laser_precios')
        .select('precio')
        .eq('producto_laser_id', productoLaserId)
        .eq('company_id', profile.company_id)
        .eq('medida_ancho', medidaAncho)
        .eq('medida_alto', medidaAlto)
        .eq('tinta', tinta)
        .eq('cara_impresa', caraImpresa)
        .eq('rango_precio_min', rangoMin);

      if (rangoMax === null) {
        query = query.is('rango_precio_max', null);
      } else {
        query = query.eq('rango_precio_max', rangoMax);
      }

      const { data, error } = await query.maybeSingle();

      if (error) throw error;
      return data?.precio || null;
    } catch (err) {
      console.error('Error buscando precio por rango:', err);
      return null;
    }
  };

  return {
    precios,
    isLoading,
    error,
    refetch: fetchPrecios,
    savePreciosEnLote,
    buscarPrecioPorRango,
  };
}
