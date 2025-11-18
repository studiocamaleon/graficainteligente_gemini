import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import type { EstacionTrabajo } from '../types/database';

interface UseEstacionesParams {
  searchTerm?: string;
  isActive?: boolean | null;
  page?: number;
  itemsPerPage?: number;
}

export function useEstaciones(params: UseEstacionesParams = {}) {
  const { company } = useAuth();
  const { searchTerm = '', isActive = null, page = 1, itemsPerPage = 25 } = params;

  const [estaciones, setEstaciones] = useState<EstacionTrabajo[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchEstaciones = async () => {
    if (!company) return;

    setLoading(true);
    try {
      let query = supabase
        .from('estaciones_trabajo')
        .select('*', { count: 'exact' })
        .eq('company_id', company.id)
        .order('created_at', { ascending: false });

      if (searchTerm) {
        query = query.ilike('nombre', `%${searchTerm}%`);
      }

      if (isActive !== null) {
        query = query.eq('is_active', isActive);
      }

      const from = (page - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;
      query = query.range(from, to);

      const { data, count, error } = await query;

      if (error) throw error;

      setEstaciones(data || []);
      setTotalCount(count || 0);
    } catch (error) {
      console.error('Error fetching estaciones:', error);
      setEstaciones([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEstaciones();
  }, [company, searchTerm, isActive, page, itemsPerPage]);

  return {
    estaciones,
    totalCount,
    loading,
    refetch: fetchEstaciones,
  };
}

export function useEstacion() {
  const { company } = useAuth();
  const [loading, setLoading] = useState(false);

  const createEstacion = async (data: { nombre: string; descripcion?: string }) => {
    if (!company) return null;

    setLoading(true);
    try {
      const { data: newEstacion, error } = await supabase
        .from('estaciones_trabajo')
        .insert({
          company_id: company.id,
          nombre: data.nombre.trim(),
          descripcion: data.descripcion?.trim() || null,
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;

      return newEstacion;
    } catch (error) {
      console.error('Error creating estacion:', error);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const updateEstacion = async (
    id: string,
    data: { nombre: string; descripcion?: string }
  ) => {
    setLoading(true);
    try {
      const { data: updatedEstacion, error } = await supabase
        .from('estaciones_trabajo')
        .update({
          nombre: data.nombre.trim(),
          descripcion: data.descripcion?.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      return updatedEstacion;
    } catch (error) {
      console.error('Error updating estacion:', error);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const toggleEstacionStatus = async (id: string, currentStatus: boolean) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('estaciones_trabajo')
        .update({
          is_active: !currentStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;

      return true;
    } catch (error) {
      console.error('Error toggling estacion status:', error);
      return false;
    } finally {
      setLoading(false);
    }
  };

  return {
    createEstacion,
    updateEstacion,
    toggleEstacionStatus,
    loading,
  };
}
