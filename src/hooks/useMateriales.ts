import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import type { Material, MaterialVariante, UnidadEspesor } from '../types/database';

interface UseMaterialesParams {
  searchTerm?: string;
  isActive?: boolean | null;
  aplicaEspesor?: boolean | null;
  unidadEspesor?: UnidadEspesor | null;
  page?: number;
  itemsPerPage?: number;
}

export function useMateriales(params: UseMaterialesParams = {}) {
  const { company } = useAuth();
  const { searchTerm = '', isActive = null, aplicaEspesor = null, unidadEspesor = null, page = 1, itemsPerPage = 25 } = params;

  const [materiales, setMateriales] = useState<Material[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchMateriales = async () => {
    if (!company) return;

    setLoading(true);
    try {
      let query = supabase
        .from('materiales')
        .select('*', { count: 'exact' })
        .eq('company_id', company.id)
        .order('nombre', { ascending: true });

      if (searchTerm) {
        query = query.ilike('nombre', `%${searchTerm}%`);
      }

      if (isActive !== null) {
        query = query.eq('is_active', isActive);
      }

      if (aplicaEspesor !== null) {
        query = query.eq('aplica_espesor', aplicaEspesor);
      }

      if (unidadEspesor) {
        query = query.eq('unidad_espesor', unidadEspesor);
      }

      const from = (page - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;
      query = query.range(from, to);

      const { data, count, error } = await query;

      if (error) throw error;

      setMateriales(data || []);
      setTotalCount(count || 0);
    } catch (error) {
      console.error('Error fetching materiales:', error);
      setMateriales([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMateriales();
  }, [company, searchTerm, isActive, aplicaEspesor, unidadEspesor, page, itemsPerPage]);

  return {
    materiales,
    totalCount,
    loading,
    refetch: fetchMateriales,
  };
}

export function useMaterial() {
  const { company } = useAuth();
  const [loading, setLoading] = useState(false);

  const createMaterial = async (data: {
    nombre: string;
    aplica_espesor: boolean;
    unidad_espesor: UnidadEspesor | null;
    variantes: MaterialVariante[];
  }) => {
    if (!company) return null;

    setLoading(true);
    try {
      const { data: newMaterial, error } = await supabase
        .from('materiales')
        .insert({
          company_id: company.id,
          nombre: data.nombre.trim(),
          aplica_espesor: data.aplica_espesor,
          unidad_espesor: data.unidad_espesor,
          variantes: data.variantes,
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;

      return newMaterial;
    } catch (error) {
      console.error('Error creating material:', error);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const updateMaterial = async (
    id: string,
    data: {
      nombre: string;
      aplica_espesor: boolean;
      unidad_espesor: UnidadEspesor | null;
      variantes: MaterialVariante[];
    }
  ) => {
    setLoading(true);
    try {
      const { data: updatedMaterial, error } = await supabase
        .from('materiales')
        .update({
          nombre: data.nombre.trim(),
          aplica_espesor: data.aplica_espesor,
          unidad_espesor: data.unidad_espesor,
          variantes: data.variantes,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      return updatedMaterial;
    } catch (error) {
      console.error('Error updating material:', error);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const toggleMaterialStatus = async (id: string, currentStatus: boolean) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('materiales')
        .update({
          is_active: !currentStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;

      return true;
    } catch (error) {
      console.error('Error toggling material status:', error);
      return false;
    } finally {
      setLoading(false);
    }
  };

  return {
    createMaterial,
    updateMaterial,
    toggleMaterialStatus,
    loading,
  };
}
