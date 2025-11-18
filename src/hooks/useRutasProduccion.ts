import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { RutaProduccion } from '../types/database';

interface UseRutasProduccionParams {
  searchTerm?: string;
  isActive?: boolean | null;
  page?: number;
  itemsPerPage?: number;
  orderBy?: 'nombre' | 'created_at';
}

interface UseRutasProduccionResult {
  rutas: RutaProduccion[];
  totalCount: number;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useRutasProduccion({
  searchTerm = '',
  isActive = null,
  page = 1,
  itemsPerPage = 25,
  orderBy = 'nombre',
}: UseRutasProduccionParams = {}): UseRutasProduccionResult {
  const [rutas, setRutas] = useState<RutaProduccion[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRutas = async () => {
    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from('rutas_produccion')
        .select('*', { count: 'exact' });

      if (searchTerm) {
        query = query.ilike('nombre', `%${searchTerm}%`);
      }

      if (isActive !== null) {
        query = query.eq('is_active', isActive);
      }

      query = query.order(orderBy, { ascending: orderBy === 'nombre' });

      const from = (page - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;
      query = query.range(from, to);

      const { data, error: fetchError, count } = await query;

      if (fetchError) throw fetchError;

      const rutasData = data || [];

      const rutasConConteo = await Promise.all(
        rutasData.map(async (ruta) => {
          const { count: pasosCount } = await supabase
            .from('rutas_produccion_pasos')
            .select('*', { count: 'exact', head: true })
            .eq('ruta_id', ruta.id);

          return {
            ...ruta,
            pasos_count: pasosCount || 0,
          };
        })
      );

      setRutas(rutasConConteo);
      setTotalCount(count || 0);
    } catch (err) {
      console.error('Error fetching rutas de producción:', err);
      setError(err instanceof Error ? err.message : 'Error desconocido');
      setRutas([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRutas();
  }, [searchTerm, isActive, page, itemsPerPage, orderBy]);

  return {
    rutas,
    totalCount,
    loading,
    error,
    refetch: fetchRutas,
  };
}
