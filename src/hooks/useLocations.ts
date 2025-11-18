import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Country, Province, City } from '../types/database';

export function useLocations() {
  const [countries, setCountries] = useState<Country[]>([]);
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCountries = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('countries')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setCountries(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar países');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchProvinces = useCallback(async (countryId: string) => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('provinces')
        .select('*')
        .eq('country_id', countryId)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setProvinces(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar provincias');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchCities = useCallback(async (provinceId: string) => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('cities')
        .select('*')
        .eq('province_id', provinceId)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setCities(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar ciudades');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCountries();
  }, [fetchCountries]);

  const getArgentinaId = useCallback(() => {
    return countries.find(c => c.iso_code === 'AR')?.id || '';
  }, [countries]);

  return {
    countries,
    provinces,
    cities,
    loading,
    error,
    fetchProvinces,
    fetchCities,
    refetchCountries: fetchCountries,
    getArgentinaId,
  };
}
