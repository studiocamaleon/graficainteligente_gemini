import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import type { Tecnologia, TintaType, TecnologiaTintaPasoFormData } from '../types/database';

interface UseTecnologiasParams {
  searchTerm?: string;
  isActive?: boolean | null;
  tintaFilter?: TintaType | null;
  categoriaId?: string | null;
  page?: number;
  itemsPerPage?: number;
}

export function useTecnologias(params: UseTecnologiasParams = {}) {
  const { company } = useAuth();
  const {
    searchTerm = '',
    isActive = null,
    tintaFilter = null,
    categoriaId = null,
    page = 1,
    itemsPerPage = 25
  } = params;

  const [tecnologias, setTecnologias] = useState<Tecnologia[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchTecnologias = async () => {
    if (!company) return;

    setLoading(true);
    try {
      let query = supabase
        .from('tecnologias')
        .select('*', { count: 'exact' })
        .eq('company_id', company.id)
        .order('created_at', { ascending: false });

      if (searchTerm) {
        query = query.ilike('nombre', `%${searchTerm}%`);
      }

      if (isActive !== null) {
        query = query.eq('is_active', isActive);
      }

      if (tintaFilter) {
        query = query.contains('tintas', [tintaFilter]);
      }

      if (categoriaId) {
        query = query.eq('categoria_id', categoriaId);
      }

      const from = (page - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;
      query = query.range(from, to);

      const { data, count, error } = await query;

      if (error) throw error;

      setTecnologias(data || []);
      setTotalCount(count || 0);
    } catch (error) {
      console.error('Error fetching tecnologias:', error);
      setTecnologias([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTecnologias();
  }, [company, searchTerm, isActive, tintaFilter, page, itemsPerPage]);

  return {
    tecnologias,
    totalCount,
    loading,
    refetch: fetchTecnologias,
  };
}

export function useTecnologia() {
  const { company } = useAuth();
  const [loading, setLoading] = useState(false);

  const createTecnologia = async (data: { nombre: string; tintas: TintaType[]; categoria_id?: string | null }) => {
    if (!company) return null;

    setLoading(true);
    try {
      const { data: newTecnologia, error } = await supabase
        .from('tecnologias')
        .insert({
          company_id: company.id,
          nombre: data.nombre.trim(),
          tintas: data.tintas,
          categoria_id: data.categoria_id,
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;

      return newTecnologia;
    } catch (error) {
      console.error('Error creating tecnologia:', error);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const updateTecnologia = async (
    id: string,
    data: { nombre: string; tintas: TintaType[]; categoria_id?: string | null }
  ) => {
    setLoading(true);
    try {
      const { data: updatedTecnologia, error } = await supabase
        .from('tecnologias')
        .update({
          nombre: data.nombre.trim(),
          tintas: data.tintas,
          categoria_id: data.categoria_id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      return updatedTecnologia;
    } catch (error) {
      console.error('Error updating tecnologia:', error);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const createTecnologiaWithTintasPasos = async (
    data: { nombre: string; tintas: TintaType[]; categoria_id?: string | null },
    configuraciones: TecnologiaTintaPasoFormData[]
  ) => {
    if (!company) return null;

    setLoading(true);
    try {
      const { data: newTecnologia, error: tecnologiaError } = await supabase
        .from('tecnologias')
        .insert({
          company_id: company.id,
          nombre: data.nombre.trim(),
          tintas: data.tintas,
          categoria_id: data.categoria_id,
          is_active: true,
        })
        .select()
        .single();

      if (tecnologiaError) throw tecnologiaError;

      if (configuraciones.length > 0) {
        const inserts = configuraciones.map((config) => ({
          tecnologia_id: newTecnologia.id,
          tinta: config.tinta,
          paso_id: config.paso_id,
        }));

        const { error: configError } = await supabase
          .from('tecnologias_tintas_pasos')
          .insert(inserts);

        if (configError) throw configError;
      }

      return newTecnologia;
    } catch (error) {
      console.error('Error creating tecnologia with tintas pasos:', error);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const updateTecnologiaWithTintasPasos = async (
    id: string,
    data: { nombre: string; tintas: TintaType[]; categoria_id?: string | null },
    configuraciones: TecnologiaTintaPasoFormData[]
  ) => {
    setLoading(true);
    try {
      const { data: updatedTecnologia, error: tecnologiaError } = await supabase
        .from('tecnologias')
        .update({
          nombre: data.nombre.trim(),
          tintas: data.tintas,
          categoria_id: data.categoria_id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (tecnologiaError) throw tecnologiaError;

      const { error: deleteError } = await supabase
        .from('tecnologias_tintas_pasos')
        .delete()
        .eq('tecnologia_id', id);

      if (deleteError) throw deleteError;

      if (configuraciones.length > 0) {
        const inserts = configuraciones.map((config) => ({
          tecnologia_id: id,
          tinta: config.tinta,
          paso_id: config.paso_id,
        }));

        const { error: configError } = await supabase
          .from('tecnologias_tintas_pasos')
          .insert(inserts);

        if (configError) throw configError;
      }

      return updatedTecnologia;
    } catch (error) {
      console.error('Error updating tecnologia with tintas pasos:', error);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const getTintasPasos = async (tecnologiaId: string) => {
    try {
      const { data, error } = await supabase
        .from('tecnologias_tintas_pasos')
        .select(`
          *,
          paso:pasos(
            id,
            nombre,
            etapa,
            estacion_id,
            estacion:estaciones_trabajo(id, nombre)
          )
        `)
        .eq('tecnologia_id', tecnologiaId)
        .order('tinta', { ascending: true });

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Error getting tintas pasos:', error);
      return [];
    }
  };

  const toggleTecnologiaStatus = async (id: string, currentStatus: boolean) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('tecnologias')
        .update({
          is_active: !currentStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;

      return true;
    } catch (error) {
      console.error('Error toggling tecnologia status:', error);
      return false;
    } finally {
      setLoading(false);
    }
  };

  return {
    createTecnologia,
    updateTecnologia,
    createTecnologiaWithTintasPasos,
    updateTecnologiaWithTintasPasos,
    getTintasPasos,
    toggleTecnologiaStatus,
    loading,
  };
}
