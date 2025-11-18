import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { Bank } from '../types/database';

export function useBanks(searchTerm: string = '') {
  const [banks, setBanks] = useState<Bank[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchBanks();
  }, [searchTerm]);

  const fetchBanks = async () => {
    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from('banks')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (searchTerm) {
        query = query.ilike('name', `%${searchTerm}%`);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;

      setBanks(data || []);
    } catch (err) {
      console.error('Error fetching banks:', err);
      setError(err instanceof Error ? err.message : 'Error al cargar los bancos');
    } finally {
      setLoading(false);
    }
  };

  return { banks, loading, error, refetch: fetchBanks };
}
