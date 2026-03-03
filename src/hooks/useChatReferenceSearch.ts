import { useCallback, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import type { ChatReferenceTarget, ChatReferenceType } from '../types/chat';

interface SearchOtRow {
  id: string;
  numero_orden: string | null;
  cliente_nombre: string | null;
  estado: string | null;
}

interface SearchCcRow {
  id: string;
  numero_orden: string | null;
  cliente_nombre: string | null;
  estado: string | null;
}

export function useChatReferenceSearch() {
  const { profile } = useAuth();
  const [results, setResults] = useState<ChatReferenceTarget[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(
    async (searchTerm: string, filter: ChatReferenceType | 'all' = 'all') => {
      if (!profile?.company_id) {
        setResults([]);
        return [];
      }

      const trimmedSearch = searchTerm.trim();
      if (!trimmedSearch) {
        setResults([]);
        return [];
      }

      try {
        setLoading(true);
        setError(null);

        const requests: Promise<any>[] = [];

        if (filter === 'all' || filter === 'orden_trabajo') {
          requests.push(
            supabase.rpc('fn_search_ordenes_trabajo', {
              p_search_term: trimmedSearch,
              p_company_id: profile.company_id,
              p_limit: 8,
              p_offset: 0,
              p_include_drafts: true,
              p_drafts_only: false,
            })
          );
        } else {
          requests.push(Promise.resolve({ data: [], error: null }));
        }

        if (filter === 'all' || filter === 'orden_copiado') {
          requests.push(
            supabase.rpc('fn_search_centro_copiado_ordenes', {
              p_company_id: profile.company_id,
              p_search_term: trimmedSearch,
              p_estado: null,
              p_estados: null,
              p_cliente_id: null,
              p_fecha_desde: null,
              p_fecha_hasta: null,
              p_limit: 8,
              p_offset: 0,
            })
          );
        } else {
          requests.push(Promise.resolve({ data: [], error: null }));
        }

        const [otResponse, ccResponse] = await Promise.all(requests);

        if (otResponse.error) throw otResponse.error;
        if (ccResponse.error) throw ccResponse.error;

        const otResults = ((otResponse.data as SearchOtRow[]) || []).map<ChatReferenceTarget>((row) => ({
          entity_type: 'orden_trabajo',
          entity_id: row.id,
          entity_label: row.numero_orden || 'OT sin número',
          entity_status: row.estado,
          client_name: row.cliente_nombre,
          href: `/app/orders/${row.id}`,
        }));

        const ccResults = ((ccResponse.data as SearchCcRow[]) || []).map<ChatReferenceTarget>((row) => ({
          entity_type: 'orden_copiado',
          entity_id: row.id,
          entity_label: row.numero_orden || 'OC sin número',
          entity_status: row.estado,
          client_name: row.cliente_nombre,
          href: `/app/centro-copiado/ordenes/${row.id}`,
        }));

        const nextResults = [...otResults, ...ccResults];
        setResults(nextResults);
        return nextResults;
      } catch (err) {
        console.error('Error buscando referencias para chat:', err);
        setError(err instanceof Error ? err.message : 'No se pudieron buscar órdenes');
        setResults([]);
        return [];
      } finally {
        setLoading(false);
      }
    },
    [profile?.company_id]
  );

  return {
    results,
    loading,
    error,
    search,
  };
}
