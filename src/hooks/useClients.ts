import { useState, useEffect, useCallback, useMemo } from 'react';
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
  sortCriteria?: Array<{
    key: string;
    direction: 'asc' | 'desc';
  }>;
  riesgoComercial?: 'alto' | 'medio' | 'bajo' | null;
  sinCompraDiasMin?: number | null;
  page?: number;
  itemsPerPage?: number;
}

export interface ClientWithCommercialMetrics extends Client {
  status_aprobacion?: 'pending' | 'approved' | 'rejected';
  ip_registro?: string | null;
  ltv_total: number;
  dias_sin_comprar: number | null;
  ordenes_90d: number;
  ticket_promedio: number;
  canal_preferido: string | null;
  mix_ot_pct: number;
  mix_copiado_pct: number;
  riesgo_comercial: 'alto' | 'medio' | 'bajo';
}

interface RpcAggregateMeta {
  full_count: number;
  avg_ltv: number;
  total_ltv: number;
}

interface LegacyClientWithLtv extends Client, RpcAggregateMeta {
  ltv_total: number;
}

export function useClients({
  searchTerm = '',
  isActive = null,
  hasCuentaCorriente = null,
  statusAprobacion = null,
  sortBy = 'created_at_desc',
  sortCriteria,
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
  const sortCriteriaSignature = useMemo(() => JSON.stringify(sortCriteria || []), [sortCriteria]);
  const effectiveSortCriteria = useMemo(
    () => (sortCriteriaSignature ? (JSON.parse(sortCriteriaSignature) as Array<{ key: string; direction: 'asc' | 'desc' }>) : []),
    [sortCriteriaSignature]
  );

  const fetchClients = useCallback(async () => {
    if (!profile?.company_id) return;

    try {
      setLoading(true);
      setError(null);

      const commercialParams = {
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
      };

      const commercialParamsWithMultiSort =
        effectiveSortCriteria.length > 1
          ? { ...commercialParams, p_sort_criteria: effectiveSortCriteria }
          : commercialParams;

      const { data: commercialData, error: commercialError } = await supabase.rpc(
        'fn_list_clients_commercial_metrics',
        commercialParamsWithMultiSort
      );

      let resolvedCommercialData = commercialData;
      let resolvedCommercialError = commercialError;

      // Compatibilidad: si el backend aún no soporta p_sort_criteria, reintentar sin ese parámetro.
      if (resolvedCommercialError && effectiveSortCriteria.length > 1) {
        const isMissingSortCriteriaSignature = resolvedCommercialError.code === 'PGRST202';
        if (isMissingSortCriteriaSignature) {
          const retry = await supabase.rpc('fn_list_clients_commercial_metrics', commercialParams);
          resolvedCommercialData = retry.data;
          resolvedCommercialError = retry.error;
        }
      }

      if (!resolvedCommercialError) {
        const rows = (resolvedCommercialData || []) as Array<ClientWithCommercialMetrics & RpcAggregateMeta>;
        setClients(rows);
        setTotalCount(rows.length > 0 ? Number(rows[0].full_count || 0) : 0);
        setAvgLtv(rows.length > 0 ? Number(rows[0].avg_ltv || 0) : 0);
        setTotalLtv(rows.length > 0 ? Number(rows[0].total_ltv || 0) : 0);
        return;
      }

      if (resolvedCommercialError.code !== 'PGRST202') {
        throw resolvedCommercialError;
      }

      const legacySortBy = sortBy === 'name_asc' || sortBy === 'ltv_desc' || sortBy === 'created_at_desc'
        ? sortBy
        : 'created_at_desc';

      const { data: legacyData, error: legacyError } = await supabase.rpc(
        'fn_list_clients_with_ltv',
        {
          p_company_id: profile.company_id,
          p_search_term: searchTerm || null,
          p_is_active: isActive,
          p_has_cuenta_corriente: hasCuentaCorriente,
          p_status_aprobacion: statusAprobacion,
          p_sort_by: legacySortBy,
          p_limit: itemsPerPage,
          p_offset: (page - 1) * itemsPerPage,
        }
      );

      if (legacyError) throw legacyError;

      const legacyRows = (legacyData || []) as LegacyClientWithLtv[];
      const mappedRows: ClientWithCommercialMetrics[] = legacyRows.map((row) => ({
        ...row,
        dias_sin_comprar: null,
        ordenes_90d: 0,
        ticket_promedio: 0,
        canal_preferido: null,
        mix_ot_pct: 0,
        mix_copiado_pct: 0,
        riesgo_comercial: 'bajo',
      }));

      setClients(mappedRows);
      setTotalCount(legacyRows.length > 0 ? Number(legacyRows[0].full_count || 0) : 0);
      setAvgLtv(legacyRows.length > 0 ? Number(legacyRows[0].avg_ltv || 0) : 0);
      setTotalLtv(legacyRows.length > 0 ? Number(legacyRows[0].total_ltv || 0) : 0);
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
    effectiveSortCriteria,
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
