import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import type { Client } from '../types/database';

interface UseClientsParams {
  searchTerm?: string;
  isActive?: boolean | null;
  hasCuentaCorriente?: boolean | null;
  statusAprobacion?: 'pending' | 'approved' | 'rejected' | null;
  sortBy?:
    | 'created_at_desc'
    | 'ltv_desc'
    | 'name_asc'
    | 'recency_desc'
    | 'frequency_90d_desc'
    | 'ticket_promedio_desc';
  riesgoComercial?: 'alto' | 'medio' | 'bajo' | null;
  sinCompraDiasMin?: number | null;
  page?: number;
  itemsPerPage?: number;
}

export interface ClientWithCommercialMetrics extends Client {
  ltv_total: number;
  dias_sin_comprar: number | null;
  ordenes_90d: number;
  ticket_promedio: number;
  canal_preferido: string | null;
  mix_ot_pct: number;
  mix_copiado_pct: number;
  riesgo_comercial: 'alto' | 'medio' | 'bajo';
}

export function useClients({
  searchTerm = '',
  isActive = null,
  hasCuentaCorriente = null,
  statusAprobacion = null,
  sortBy = 'created_at_desc',
  riesgoComercial = null,
  sinCompraDiasMin = null,
  page = 1,
  itemsPerPage = 25,
}: UseClientsParams = {}) {
  const { profile } = useAuth();
  const [clients, setClients] = useState<ClientWithCommercialMetrics[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [avgLtv, setAvgLtv] = useState(0);
  const [totalLtv, setTotalLtv] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchClients = useCallback(async () => {
    if (!profile?.company_id) return;

    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase.rpc(
        'fn_list_clients_commercial_metrics',
        {
          p_company_id: profile.company_id,
          p_search_term: searchTerm || null,
          p_is_active: isActive,
          p_has_cuenta_corriente: hasCuentaCorriente,
          p_status_aprobacion: statusAprobacion,
          p_riesgo_comercial: riesgoComercial,
          p_sin_compra_dias: sinCompraDiasMin,
          p_sort_by: sortBy,
          p_limit: itemsPerPage,
          p_offset: (page - 1) * itemsPerPage,
        }
      );

      if (fetchError) throw fetchError;

      const rows = (data || []) as Array<
        ClientWithCommercialMetrics & {
          full_count: number;
          avg_ltv: number;
          total_ltv: number;
        }
      >;
      setClients(rows);
      setTotalCount(rows.length > 0 ? Number(rows[0].full_count || 0) : 0);
      setAvgLtv(rows.length > 0 ? Number(rows[0].avg_ltv || 0) : 0);
      setTotalLtv(rows.length > 0 ? Number(rows[0].total_ltv || 0) : 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar clientes');
      console.error('Error fetching clients:', err);
    } finally {
      setLoading(false);
    }
  }, [
    profile?.company_id,
    searchTerm,
    isActive,
    hasCuentaCorriente,
    statusAprobacion,
    sortBy,
    riesgoComercial,
    sinCompraDiasMin,
    page,
    itemsPerPage
  ]);

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
    totalLtv,
    loading,
    error,
    refetch,
  };
}
