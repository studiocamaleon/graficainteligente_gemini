import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import type { Paso, EtapaPaso } from '../types/database';

interface UsePasosParams {
  searchTerm?: string;
  isActive?: boolean | null;
  etapaFilter?: EtapaPaso | null;
  page?: number;
  itemsPerPage?: number;
  orderBy?: 'nombre' | 'etapa';
}

export function usePasos(params: UsePasosParams = {}) {
  const { company } = useAuth();
  const { searchTerm = '', isActive = null, etapaFilter = null, page = 1, itemsPerPage = 25, orderBy = 'nombre' } = params;

  const [pasos, setPasos] = useState<Paso[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchPasos = async () => {
    if (!company) return;

    setLoading(true);
    try {
      let query = supabase
        .from('pasos')
        .select('*, estaciones_trabajo!inner(nombre)', { count: 'exact' })
        .eq('company_id', company.id);

      if (orderBy === 'nombre') {
        query = query.order('nombre', { ascending: true });
      } else if (orderBy === 'etapa') {
        query = query.order('etapa', { ascending: true }).order('nombre', { ascending: true });
      }

      if (searchTerm) {
        // 1. Find matching stations first
        const { data: matchingStations } = await supabase
          .from('estaciones_trabajo')
          .select('id')
          .ilike('nombre', `%${searchTerm}%`)
          .eq('company_id', company.id)
          .limit(50);

        const stationIds = matchingStations?.map(s => s.id) || [];

        // 2. Build OR clause: match step name OR match station ID
        let orClause = `nombre.ilike.%${searchTerm}%`;
        if (stationIds.length > 0) {
          orClause += `,estacion_id.in.(${stationIds.join(',')})`;
        }

        query = query.or(orClause);
      }

      if (isActive !== null) {
        query = query.eq('is_active', isActive);
      }

      if (etapaFilter) {
        query = query.eq('etapa', etapaFilter);
      }

      const from = (page - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;
      query = query.range(from, to);

      const { data, count, error } = await query;

      if (error) throw error;

      setPasos(data || []);
      setTotalCount(count || 0);
    } catch (error) {
      console.error('Error fetching pasos:', error);
      setPasos([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPasos();
  }, [company, searchTerm, isActive, etapaFilter, page, itemsPerPage, orderBy]);

  return {
    pasos,
    totalCount,
    loading,
    refetch: fetchPasos,
  };
}

export function usePaso() {
  const { company } = useAuth();
  const [loading, setLoading] = useState(false);

  const createPaso = async (data: {
    nombre: string;
    etapa: EtapaPaso;
    estacion_id: string;
  }) => {
    if (!company) return null;

    setLoading(true);
    try {
      const { data: newPaso, error } = await supabase
        .from('pasos')
        .insert({
          company_id: company.id,
          nombre: data.nombre.trim(),
          etapa: data.etapa,
          estacion_id: data.estacion_id,
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;

      return newPaso;
    } catch (error) {
      console.error('Error creating paso:', error);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const updatePaso = async (
    id: string,
    data: {
      nombre: string;
      etapa: EtapaPaso;
      estacion_id: string;
    }
  ) => {
    setLoading(true);
    try {
      const { data: updatedPaso, error } = await supabase
        .from('pasos')
        .update({
          nombre: data.nombre.trim(),
          etapa: data.etapa,
          estacion_id: data.estacion_id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      return updatedPaso;
    } catch (error) {
      console.error('Error updating paso:', error);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const togglePasoStatus = async (id: string, currentStatus: boolean) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('pasos')
        .update({
          is_active: !currentStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;

      return true;
    } catch (error) {
      console.error('Error toggling paso status:', error);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const deletePaso = async (id: string) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('pasos')
        .delete()
        .eq('id', id);

      if (error) throw error;

      return true;
    } catch (error) {
      console.error('Error deleting paso:', error);
      return false;
    } finally {
      setLoading(false);
    }
  };

  return {
    createPaso,
    updatePaso,
    togglePasoStatus,
    deletePaso,
    loading,
  };
}
