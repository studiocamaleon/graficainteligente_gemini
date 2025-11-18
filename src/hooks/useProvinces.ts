import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Province, ProvinceFormData } from '../types/database';
import { useAuth } from './useAuth';

interface UseProvincesParams {
  countryId?: string;
  searchTerm?: string;
  isActive?: boolean | null;
  page?: number;
  itemsPerPage?: number;
}

export function useProvinces(params: UseProvincesParams = {}) {
  const { profile } = useAuth();
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProvinces = useCallback(async () => {
    if (!profile?.company_id) return;

    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from('provinces')
        .select('*', { count: 'exact' });

      if (params.countryId) {
        query = query.eq('country_id', params.countryId);
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

      setProvinces(data || []);
      setTotalCount(count || 0);
    } catch (err) {
      console.error('Error fetching provinces:', err);
      setError(err instanceof Error ? err.message : 'Error al cargar provincias');
    } finally {
      setLoading(false);
    }
  }, [profile?.company_id, params.countryId, params.searchTerm, params.isActive, params.page, params.itemsPerPage]);

  useEffect(() => {
    fetchProvinces();
  }, [fetchProvinces]);

  return {
    provinces,
    totalCount,
    loading,
    error,
    refetch: fetchProvinces,
  };
}

export function useProvince() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);

  const createProvince = useCallback(async (data: ProvinceFormData): Promise<Province | null> => {
    if (!profile?.company_id) {
      alert('No se pudo obtener la información de la compañía');
      return null;
    }

    try {
      setLoading(true);

      const { data: existing } = await supabase
        .from('provinces')
        .select('id')
        .eq('country_id', data.country_id)
        .ilike('name', data.name.trim())
        .maybeSingle();

      if (existing) {
        alert('Ya existe una provincia con ese nombre en el país seleccionado');
        return null;
      }

      const { data: newProvince, error } = await supabase
        .from('provinces')
        .insert({
          country_id: data.country_id,
          name: data.name.trim(),
          code: data.code ? data.code.toUpperCase().trim() : null,
          company_id: profile.company_id,
          is_global: false,
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;

      return newProvince;
    } catch (err) {
      console.error('Error creating province:', err);
      alert(err instanceof Error ? err.message : 'Error al crear la provincia');
      return null;
    } finally {
      setLoading(false);
    }
  }, [profile?.company_id]);

  const updateProvince = useCallback(async (id: string, data: ProvinceFormData): Promise<Province | null> => {
    try {
      setLoading(true);

      const { data: existing } = await supabase
        .from('provinces')
        .select('id')
        .eq('country_id', data.country_id)
        .ilike('name', data.name.trim())
        .neq('id', id)
        .maybeSingle();

      if (existing) {
        alert('Ya existe una provincia con ese nombre en el país seleccionado');
        return null;
      }

      const { data: updated, error } = await supabase
        .from('provinces')
        .update({
          country_id: data.country_id,
          name: data.name.trim(),
          code: data.code ? data.code.toUpperCase().trim() : null,
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      return updated;
    } catch (err) {
      console.error('Error updating province:', err);
      alert(err instanceof Error ? err.message : 'Error al actualizar la provincia');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const toggleProvinceStatus = useCallback(async (id: string, currentStatus: boolean): Promise<boolean> => {
    try {
      setLoading(true);

      const { error } = await supabase
        .from('provinces')
        .update({ is_active: !currentStatus })
        .eq('id', id);

      if (error) throw error;

      return true;
    } catch (err) {
      console.error('Error toggling province status:', err);
      alert(err instanceof Error ? err.message : 'Error al cambiar el estado de la provincia');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteProvince = useCallback(async (id: string): Promise<boolean> => {
    try {
      setLoading(true);

      const { count: cityCount } = await supabase
        .from('cities')
        .select('id', { count: 'exact', head: true })
        .eq('province_id', id);

      if (cityCount && cityCount > 0) {
        alert(`No se puede eliminar la provincia porque tiene ${cityCount} ciudad(es) asociada(s)`);
        return false;
      }

      const { error } = await supabase
        .from('provinces')
        .delete()
        .eq('id', id);

      if (error) throw error;

      return true;
    } catch (err) {
      console.error('Error deleting province:', err);
      alert(err instanceof Error ? err.message : 'Error al eliminar la provincia');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    createProvince,
    updateProvince,
    toggleProvinceStatus,
    deleteProvince,
    loading,
  };
}
