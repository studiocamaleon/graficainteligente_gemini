import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import type {
  CentroCopiadoTamanioPapel,
  CentroCopiadoPapel,
  CentroCopiadoRangoPrecioImpresion,
  TipoTintaCopiado
} from '../types/database';

export interface PrecioImpresionInput {
  tamanio_papel_id: string;
  papel_id: string;
  tipo_tinta: TipoTintaCopiado;
  rango_precio_id: string;
  cara_impresa: 'frente' | 'frente_y_dorso';
  precio: number;
}

export interface CombinacionTamanioPapel {
  tamanio_id: string;
  tamanio_nombre: string;
  tamanio_ancho_mm: number;
  tamanio_alto_mm: number;
  papel_id: string;
  papel_material_nombre: string;
  papel_variante_nombre: string;
  papel_espesor: number | null;
  papel_unidad_espesor: string | null;
}

export interface TintaData {
  tipo_tinta: TipoTintaCopiado;
  combinaciones: CombinacionTamanioPapel[];
}

interface PrecioCargado {
  tamanio_papel_id: string;
  papel_id: string;
  rango_precio_id: string;
  cara_impresa: 'frente' | 'frente_y_dorso';
  precio: number;
}

const buildCombinacionKey = (tamanioId: string, papelId: string) => `${tamanioId}|${papelId}`;

export function useCentroCopiadoPreciosImpresion() {
  const { company } = useAuth();
  const [tamanios, setTamanios] = useState<CentroCopiadoTamanioPapel[]>([]);
  const [papeles, setPapeles] = useState<CentroCopiadoPapel[]>([]);
  const [rangos, setRangos] = useState<CentroCopiadoRangoPrecioImpresion[]>([]);
  const [tintasData, setTintasData] = useState<TintaData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchConfiguracion = useCallback(async () => {
    if (!company?.id) return;

    try {
      setIsLoading(true);
      setError(null);

      const [tamaniosRes, papelesRes, rangosRes] = await Promise.all([
        supabase
          .from('centro_copiado_tamanios_papel')
          .select('*')
          .eq('company_id', company.id)
          .eq('is_active', true)
          .order('nombre', { ascending: true }),

        supabase
          .from('centro_copiado_papeles')
          .select(`
            *,
            material:materiales(id, nombre)
          `)
          .eq('company_id', company.id)
          .eq('is_active', true)
          .order('orden', { ascending: true })
          .order('variante_nombre', { ascending: true }),

        supabase
          .from('centro_copiado_rangos_precio_impresion')
          .select('*')
          .eq('company_id', company.id)
          .eq('is_active', true)
          .order('orden', { ascending: true })
      ]);

      if (tamaniosRes.error) throw tamaniosRes.error;
      if (papelesRes.error) throw papelesRes.error;
      if (rangosRes.error) throw rangosRes.error;

      setTamanios(tamaniosRes.data || []);
      setPapeles(papelesRes.data || []);
      setRangos(rangosRes.data || []);

      const combinaciones: CombinacionTamanioPapel[] = [];

      (tamaniosRes.data || []).forEach(tamanio => {
        (papelesRes.data || []).forEach(papel => {
          combinaciones.push({
            tamanio_id: tamanio.id,
            tamanio_nombre: tamanio.nombre,
            tamanio_ancho_mm: tamanio.ancho_mm,
            tamanio_alto_mm: tamanio.alto_mm,
            papel_id: papel.id,
            papel_material_nombre: papel.material?.nombre || 'N/A',
            papel_variante_nombre: papel.variante_nombre,
            papel_espesor: papel.espesor,
            papel_unidad_espesor: papel.unidad_espesor,
          });
        });
      });

      const tintasCMYK: TintaData = {
        tipo_tinta: 'CMYK',
        combinaciones: [...combinaciones],
      };

      const tintasColor: TintaData = {
        tipo_tinta: 'COLOR',
        combinaciones: [...combinaciones],
      };

      const tintasK: TintaData = {
        tipo_tinta: 'K',
        combinaciones: [...combinaciones],
      };

      setTintasData([tintasCMYK, tintasColor, tintasK]);

    } catch (err) {
      console.error('Error fetching configuración:', err);
      setError(err instanceof Error ? err.message : 'Error al cargar la configuración');
    } finally {
      setIsLoading(false);
    }
  }, [company?.id]);

  useEffect(() => {
    fetchConfiguracion();
  }, [fetchConfiguracion]);

  const loadPreciosExistentes = useCallback(async (tipoTinta: TipoTintaCopiado): Promise<Map<string, PrecioCargado[]>> => {
    if (!company?.id) return new Map();

    try {
      const { data, error: fetchError } = await supabase
        .from('centro_copiado_precios_impresion')
        .select('tamanio_papel_id, papel_id, rango_precio_id, cara_impresa, precio')
        .eq('company_id', company.id)
        .eq('tipo_tinta', tipoTinta);

      if (fetchError) throw fetchError;

      const preciosMap = new Map<string, PrecioCargado[]>();

      (data || []).forEach(precio => {
        const key = buildCombinacionKey(precio.tamanio_papel_id, precio.papel_id);
        if (!preciosMap.has(key)) {
          preciosMap.set(key, []);
        }
        preciosMap.get(key)!.push(precio);
      });

      return preciosMap;
    } catch (err) {
      console.error('Error loading precios existentes:', err);
      return new Map();
    }
  }, [company?.id]);

  const savePrecios = useCallback(async (precios: PrecioImpresionInput[]): Promise<boolean> => {
    if (!company?.id) {
      setError('No se encontró la empresa');
      return false;
    }

    if (precios.length === 0) {
      return true;
    }

    try {
      setError(null);

      const combinacionesUnicas = new Map<string, {
        tamanio_papel_id: string;
        papel_id: string;
        tipo_tinta: TipoTintaCopiado;
        rango_precio_id: string;
        cara_impresa: 'frente' | 'frente_y_dorso';
      }>();

      precios.forEach(precio => {
        const key = `${precio.tamanio_papel_id}-${precio.papel_id}-${precio.tipo_tinta}-${precio.rango_precio_id}-${precio.cara_impresa}`;
        if (!combinacionesUnicas.has(key)) {
          combinacionesUnicas.set(key, {
            tamanio_papel_id: precio.tamanio_papel_id,
            papel_id: precio.papel_id,
            tipo_tinta: precio.tipo_tinta,
            rango_precio_id: precio.rango_precio_id,
            cara_impresa: precio.cara_impresa,
          });
        }
      });

      console.log('[Centro Copiado] Guardando precios para combinaciones:', Array.from(combinacionesUnicas.values()));

      for (const combinacion of combinacionesUnicas.values()) {
        const { error: deleteError } = await supabase
          .from('centro_copiado_precios_impresion')
          .delete()
          .eq('company_id', company.id)
          .eq('tamanio_papel_id', combinacion.tamanio_papel_id)
          .eq('papel_id', combinacion.papel_id)
          .eq('tipo_tinta', combinacion.tipo_tinta)
          .eq('rango_precio_id', combinacion.rango_precio_id)
          .eq('cara_impresa', combinacion.cara_impresa);

        if (deleteError) {
          console.error('[Centro Copiado] Error borrando precios:', deleteError);
          throw deleteError;
        }
      }

      const preciosToInsert = precios.map(precio => ({
        ...precio,
        company_id: company.id,
      }));

      console.log(`[Centro Copiado] Insertando ${preciosToInsert.length} nuevos precios`);

      const { error: insertError } = await supabase
        .from('centro_copiado_precios_impresion')
        .insert(preciosToInsert);

      if (insertError) {
        console.error('[Centro Copiado] Error insertando precios:', insertError);
        throw insertError;
      }

      console.log('[Centro Copiado] Precios guardados exitosamente');
      return true;
    } catch (err) {
      console.error('Error saving precios:', err);
      setError(err instanceof Error ? err.message : 'Error al guardar los precios');
      return false;
    }
  }, [company?.id]);

  return {
    tamanios,
    papeles,
    rangos,
    tintasData,
    isLoading,
    error,
    loadPreciosExistentes,
    savePrecios,
    refetch: fetchConfiguracion,
  };
}
