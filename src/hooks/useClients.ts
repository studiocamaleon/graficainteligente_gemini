import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import type { Client } from '../types/database';

interface UseClientsParams {
  searchTerm?: string;
  isActive?: boolean | null;
  hasCuentaCorriente?: boolean | null;
  statusAprobacion?: 'pending' | 'approved' | 'rejected' | null;
  sortBy?: 'created_at_desc' | 'ltv_desc' | 'name_asc';
  page?: number;
  itemsPerPage?: number;
}

export interface ClientWithLtv extends Client {
  ltv_total: number;
}

export function useClients({
  searchTerm = '',
  isActive = null,
  hasCuentaCorriente = null,
  statusAprobacion = null,
  sortBy = 'created_at_desc',
  page = 1,
  itemsPerPage = 25,
}: UseClientsParams = {}) {
  const { profile } = useAuth();
  const [clients, setClients] = useState<ClientWithLtv[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [avgLtv, setAvgLtv] = useState(0);
  const [avgLtvGlobal, setAvgLtvGlobal] = useState(0);
  const [totalLtv, setTotalLtv] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchClients = useCallback(async () => {
    if (!profile?.company_id) return;

    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase.rpc(
        'fn_list_clients_with_ltv',
        {
          p_company_id: profile.company_id,
          p_search_term: searchTerm || null,
          p_is_active: isActive,
          p_has_cuenta_corriente: hasCuentaCorriente,
          p_status_aprobacion: statusAprobacion,
          p_sort_by: sortBy,
          p_limit: itemsPerPage,
          p_offset: (page - 1) * itemsPerPage,
        }
      );

      if (fetchError) throw fetchError;

      const rows = (data || []) as Array<ClientWithLtv & { full_count: number; avg_ltv: number; avg_ltv_global: number; total_ltv: number }>;
      setClients(rows);
      setTotalCount(rows.length > 0 ? Number(rows[0].full_count || 0) : 0);
      setAvgLtv(rows.length > 0 ? Number(rows[0].avg_ltv || 0) : 0);
      setAvgLtvGlobal(rows.length > 0 ? Number(rows[0].avg_ltv_global || 0) : 0);
      setTotalLtv(rows.length > 0 ? Number(rows[0].total_ltv || 0) : 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar clientes');
      console.error('Error fetching clients:', err);
    } finally {
      setLoading(false);
    }
  }, [profile?.company_id, searchTerm, isActive, hasCuentaCorriente, statusAprobacion, sortBy, page, itemsPerPage]);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  const refetch = () => {
    fetchClients();
  };

  return {
    clients,
    totalCount,
    avgLtv,
    avgLtvGlobal,
    totalLtv,
    loading,
    error,
    refetch,
  };
}
