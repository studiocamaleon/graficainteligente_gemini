import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { City, CityFormData } from '../types/database';
import { useAuth } from './useAuth';

interface UseCitiesParams {
  provinceId?: string;
  searchTerm?: string;
  isActive?: boolean | null;
  page?: number;
  itemsPerPage?: number;
}

export function useCities(params: UseCitiesParams = {}) {
  const { profile } = useAuth();
  const [cities, setCities] = useState<City[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCities = useCallback(async () => {
    if (!profile?.company_id) return;

    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from('cities')
        .select('*', { count: 'exact' });

      if (params.provinceId) {
        query = query.eq('province_id', params.provinceId);
      }

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

      setCities(data || []);
      setTotalCount(count || 0);
    } catch (err) {
      console.error('Error fetching cities:', err);
      setError(err instanceof Error ? err.message : 'Error al cargar ciudades');
    } finally {
      setLoading(false);
    }
  }, [profile?.company_id, params.provinceId, params.searchTerm, params.isActive, params.page, params.itemsPerPage]);

  useEffect(() => {
    fetchCities();
  }, [fetchCities]);

  return {
    cities,
    totalCount,
    loading,
    error,
    refetch: fetchCities,
  };
}

export function useCity() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);

  const createCity = useCallback(async (data: CityFormData): Promise<City | null> => {
    if (!profile?.company_id) {
      alert('No se pudo obtener la información de la compañía');
      return null;
    }

    try {
      setLoading(true);

      const { data: existing } = await supabase
        .from('cities')
        .select('id')
        .eq('province_id', data.province_id)
        .ilike('name', data.name.trim())
        .maybeSingle();

      if (existing) {
        alert('Ya existe una ciudad con ese nombre en la provincia seleccionada');
        return null;
      }

      const { data: newCity, error } = await supabase
        .from('cities')
        .insert({
          province_id: data.province_id,
          name: data.name.trim(),
          postal_code: data.postal_code ? data.postal_code.trim() : null,
          company_id: profile.company_id,
          is_global: false,
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;

      return newCity;
    } catch (err) {
      console.error('Error creating city:', err);
      alert(err instanceof Error ? err.message : 'Error al crear la ciudad');
      return null;
    } finally {
      setLoading(false);
    }
  }, [profile?.company_id]);

  const updateCity = useCallback(async (id: string, data: CityFormData): Promise<City | null> => {
    try {
      setLoading(true);

      const { data: existing } = await supabase
        .from('cities')
        .select('id')
        .eq('province_id', data.province_id)
        .ilike('name', data.name.trim())
        .neq('id', id)
        .maybeSingle();

      if (existing) {
        alert('Ya existe una ciudad con ese nombre en la provincia seleccionada');
        return null;
      }

      const { data: updated, error } = await supabase
        .from('cities')
        .update({
          province_id: data.province_id,
          name: data.name.trim(),
          postal_code: data.postal_code ? data.postal_code.trim() : null,
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      return updated;
    } catch (err) {
      console.error('Error updating city:', err);
      alert(err instanceof Error ? err.message : 'Error al actualizar la ciudad');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const toggleCityStatus = useCallback(async (id: string, currentStatus: boolean): Promise<boolean> => {
    try {
      setLoading(true);

      const { error } = await supabase
        .from('cities')
        .update({ is_active: !currentStatus })
        .eq('id', id);

      if (error) throw error;

      return true;
    } catch (err) {
      console.error('Error toggling city status:', err);
      alert(err instanceof Error ? err.message : 'Error al cambiar el estado de la ciudad');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteCity = useCallback(async (id: string): Promise<boolean> => {
    try {
      setLoading(true);

      const { error } = await supabase
        .from('cities')
        .delete()
        .eq('id', id);

      if (error) throw error;

      return true;
    } catch (err) {
      console.error('Error deleting city:', err);
      alert(err instanceof Error ? err.message : 'Error al eliminar la ciudad');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    createCity,
    updateCity,
    toggleCityStatus,
    deleteCity,
    loading,
  };
}
