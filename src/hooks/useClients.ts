import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import type { Client } from '../types/database';

interface UseClientsParams {
  searchTerm?: string;
  isActive?: boolean | null;
  hasCuentaCorriente?: boolean | null;
  statusAprobacion?: 'pending' | 'approved' | 'rejected' | null;
  page?: number;
  itemsPerPage?: number;
}

export function useClients({
  searchTerm = '',
  isActive = null,
  hasCuentaCorriente = null,
  statusAprobacion = null,
  page = 1,
  itemsPerPage = 25,
}: UseClientsParams = {}) {
  const { profile } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchClients = useCallback(async () => {
    if (!profile?.company_id) return;

    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from('clients')
        .select('*', { count: 'exact' })
        .eq('company_id', profile.company_id);

      if (isActive !== null) {
        query = query.eq('is_active', isActive);
      }

      if (hasCuentaCorriente !== null) {
        query = query.eq('tiene_cuenta_corriente', hasCuentaCorriente);
      }

      if (statusAprobacion !== null) {
        query = query.eq('status_aprobacion', statusAprobacion);
      }

      if (searchTerm) {
        query = query.or(
          `nombre_fantasia.ilike.%${searchTerm}%,razon_social.ilike.%${searchTerm}%,numero_documento.ilike.%${searchTerm}%`
        );
      }

      const from = (page - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;

      query = query.order('created_at', { ascending: false }).range(from, to);

      const { data, error: fetchError, count } = await query;

      if (fetchError) throw fetchError;

      setClients(data || []);
      setTotalCount(count || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar clientes');
      console.error('Error fetching clients:', err);
    } finally {
      setLoading(false);
    }
  }, [profile?.company_id, searchTerm, isActive, hasCuentaCorriente, page, itemsPerPage]);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  const refetch = () => {
    fetchClients();
  };

  return {
    clients,
    totalCount,
    loading,
    error,
    refetch,
  };
}
