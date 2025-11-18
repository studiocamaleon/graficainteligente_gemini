import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Country, CountryFormData } from '../types/database';
import { useAuth } from './useAuth';

interface UseCountriesParams {
  searchTerm?: string;
  isActive?: boolean | null;
  page?: number;
  itemsPerPage?: number;
}

export function useCountries(params: UseCountriesParams = {}) {
  const { profile } = useAuth();
  const [countries, setCountries] = useState<Country[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCountries = useCallback(async () => {
    if (!profile?.company_id) return;

    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from('countries')
        .select('*', { count: 'exact' });

      if (params.searchTerm) {
        query = query.ilike('name', `%${params.searchTerm}%`);
      }

      if (params.isActive !== null && params.isActive !== undefined) {
        query = query.eq('is_active', params.isActive);
      }

      query = query.order('is_global', { ascending: false });
      query = query.order('name');

      if (params.page && params.itemsPerPage) {
        const from = (params.page - 1) * params.itemsPerPage;
        const to = from + params.itemsPerPage - 1;
        query = query.range(from, to);
      }

      const { data, error: fetchError, count } = await query;

      if (fetchError) throw fetchError;

      setCountries(data || []);
      setTotalCount(count || 0);
    } catch (err) {
      console.error('Error fetching countries:', err);
      setError(err instanceof Error ? err.message : 'Error al cargar países');
    } finally {
      setLoading(false);
    }
  }, [profile?.company_id, params.searchTerm, params.isActive, params.page, params.itemsPerPage]);

  useEffect(() => {
    fetchCountries();
  }, [fetchCountries]);

  return {
    countries,
    totalCount,
    loading,
    error,
    refetch: fetchCountries,
  };
}

export function useCountry() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);

  const createCountry = useCallback(async (data: CountryFormData): Promise<Country | null> => {
    if (!profile?.company_id) {
      alert('No se pudo obtener la información de la compañía');
      return null;
    }

    try {
      setLoading(true);

      const { data: existing } = await supabase
        .from('countries')
        .select('id')
        .eq('iso_code', data.iso_code.toUpperCase())
        .maybeSingle();

      if (existing) {
        alert('Ya existe un país con ese código ISO');
        return null;
      }

      const { data: newCountry, error } = await supabase
        .from('countries')
        .insert({
          name: data.name.trim(),
          iso_code: data.iso_code.toUpperCase().trim(),
          phone_code: data.phone_code.trim(),
          company_id: profile.company_id,
          is_global: false,
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;

      return newCountry;
    } catch (err) {
      console.error('Error creating country:', err);
      alert(err instanceof Error ? err.message : 'Error al crear el país');
      return null;
    } finally {
      setLoading(false);
    }
  }, [profile?.company_id]);

  const updateCountry = useCallback(async (id: string, data: CountryFormData): Promise<Country | null> => {
    try {
      setLoading(true);

      const { data: existing } = await supabase
        .from('countries')
        .select('id, iso_code')
        .eq('iso_code', data.iso_code.toUpperCase())
        .neq('id', id)
        .maybeSingle();

      if (existing) {
        alert('Ya existe un país con ese código ISO');
        return null;
      }

      const { data: updated, error } = await supabase
        .from('countries')
        .update({
          name: data.name.trim(),
          iso_code: data.iso_code.toUpperCase().trim(),
          phone_code: data.phone_code.trim(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      return updated;
    } catch (err) {
      console.error('Error updating country:', err);
      alert(err instanceof Error ? err.message : 'Error al actualizar el país');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const toggleCountryStatus = useCallback(async (id: string, currentStatus: boolean): Promise<boolean> => {
    try {
      setLoading(true);

      const { error } = await supabase
        .from('countries')
        .update({ is_active: !currentStatus })
        .eq('id', id);

      if (error) throw error;

      return true;
    } catch (err) {
      console.error('Error toggling country status:', err);
      alert(err instanceof Error ? err.message : 'Error al cambiar el estado del país');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteCountry = useCallback(async (id: string): Promise<boolean> => {
    try {
      setLoading(true);

      const { count: provinceCount } = await supabase
        .from('provinces')
        .select('id', { count: 'exact', head: true })
        .eq('country_id', id);

      if (provinceCount && provinceCount > 0) {
        alert(`No se puede eliminar el país porque tiene ${provinceCount} provincia(s) asociada(s)`);
        return false;
      }

      const { error } = await supabase
        .from('countries')
        .delete()
        .eq('id', id);

      if (error) throw error;

      return true;
    } catch (err) {
      console.error('Error deleting country:', err);
      alert(err instanceof Error ? err.message : 'Error al eliminar el país');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    createCountry,
    updateCountry,
    toggleCountryStatus,
    deleteCountry,
    loading,
  };
}
