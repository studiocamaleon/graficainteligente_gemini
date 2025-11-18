import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import type { Provider } from '../types/database';

interface UseProvidersOptions {
  searchTerm?: string;
  isActive?: boolean | null;
  acceptsTransfers?: boolean;
  acceptsChecks?: boolean;
  acceptsCreditCards?: boolean;
  acceptsOthers?: boolean;
  page?: number;
  pageSize?: number;
}

interface UseProvidersResult {
  providers: Provider[];
  loading: boolean;
  error: string | null;
  totalCount: number;
  totalPages: number;
  refetch: () => Promise<void>;
}

export function useProviders(options: UseProvidersOptions = {}): UseProvidersResult {
  const {
    searchTerm = '',
    isActive = null,
    acceptsTransfers,
    acceptsChecks,
    acceptsCreditCards,
    acceptsOthers,
    page = 1,
    pageSize = 10,
  } = options;

  const { profile } = useAuth();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    if (profile?.company_id) {
      fetchProviders();
    }
  }, [
    profile?.company_id,
    searchTerm,
    isActive,
    acceptsTransfers,
    acceptsChecks,
    acceptsCreditCards,
    acceptsOthers,
    page,
    pageSize,
  ]);

  const fetchProviders = async () => {
    if (!profile?.company_id) return;

    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from('providers')
        .select('*', { count: 'exact' })
        .eq('company_id', profile.company_id);

      if (searchTerm) {
        query = query.or(
          `nombre_fantasia.ilike.%${searchTerm}%,razon_social.ilike.%${searchTerm}%,numero_documento.ilike.%${searchTerm}%`
        );
      }

      if (isActive !== null) {
        query = query.eq('is_active', isActive);
      }

      if (acceptsTransfers !== undefined) {
        query = query.eq('acepta_transferencias', acceptsTransfers);
      }

      if (acceptsChecks !== undefined) {
        query = query.eq('acepta_cheques', acceptsChecks);
      }

      if (acceptsCreditCards !== undefined) {
        query = query.eq('acepta_tarjetas_credito', acceptsCreditCards);
      }

      if (acceptsOthers !== undefined) {
        query = query.eq('acepta_otros', acceptsOthers);
      }

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      query = query
        .order('nombre_fantasia')
        .range(from, to);

      const { data, error: fetchError, count } = await query;

      if (fetchError) throw fetchError;

      setProviders(data || []);
      setTotalCount(count || 0);
    } catch (err) {
      console.error('Error fetching providers:', err);
      setError(err instanceof Error ? err.message : 'Error al cargar los proveedores');
    } finally {
      setLoading(false);
    }
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  return {
    providers,
    loading,
    error,
    totalCount,
    totalPages,
    refetch: fetchProviders,
  };
}
