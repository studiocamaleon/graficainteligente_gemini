import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { Categoria } from '../types/database';

/**
 * Hook para obtener categorías del sistema (solo lectura)
 *
 * Las categorías son entidades inmutables del sistema, disponibles
 * globalmente para todas las empresas. No pueden ser creadas, editadas
 * o eliminadas desde el frontend.
 */

interface UseCategoriasParams {
  searchTerm?: string;
  isActive?: boolean | null;
  page?: number;
  itemsPerPage?: number;
}

export function useCategorias(params: UseCategoriasParams = {}) {
  const { searchTerm = '', isActive = null, page = 1, itemsPerPage = 25 } = params;

  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchCategorias = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('categorias')
        .select('*', { count: 'exact' })
        .order('nombre', { ascending: true });

      if (searchTerm) {
        query = query.ilike('nombre', `%${searchTerm}%`);
      }

      if (isActive !== null) {
        query = query.eq('is_active', isActive);
      }

      const from = (page - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;
      query = query.range(from, to);

      const { data, count, error } = await query;

      if (error) throw error;

      setCategorias(data || []);
      setTotalCount(count || 0);
    } catch (error) {
      console.error('Error fetching categorias:', error);
      setCategorias([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategorias();
  }, [searchTerm, isActive, page, itemsPerPage]);

  return {
    categorias,
    totalCount,
    loading,
    refetch: fetchCategorias,
  };
}
