import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import type { CentroCopiadoPapel, CentroCopiadoPapelFormData } from '../types/database';

interface PapelWithMaterial extends CentroCopiadoPapel {
  material?: {
    id: string;
    nombre: string;
  };
}

export function useCentroCopiadoPapeles() {
  const { company } = useAuth();
  const [papeles, setPapeles] = useState<PapelWithMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPapeles = useCallback(async () => {
    if (!company?.id) return;

    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('centro_copiado_papeles')
        .select(`
          *,
          material:materiales(id, nombre)
        `)
        .eq('company_id', company.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      setPapeles(data || []);
    } catch (err) {
      console.error('Error fetching papeles:', err);
      setError(err instanceof Error ? err.message : 'Error al cargar los tipos de papel');
    } finally {
      setLoading(false);
    }
  }, [company?.id]);

  useEffect(() => {
    fetchPapeles();
  }, [fetchPapeles]);

  const createPapel = async (data: CentroCopiadoPapelFormData): Promise<CentroCopiadoPapel | null> => {
    if (!company?.id) {
      setError('No se encontró la empresa');
      return null;
    }

    try {
      setError(null);

      const { data: newPapel, error: insertError } = await supabase
        .from('centro_copiado_papeles')
        .insert({
          company_id: company.id,
          material_id: data.material_id,
          variante_nombre: data.variante_nombre,
          espesor: data.espesor,
          unidad_espesor: data.unidad_espesor,
          is_active: true,
        })
        .select()
        .single();

      if (insertError) throw insertError;
      return newPapel;
    } catch (err) {
      console.error('Error creating papel:', err);
      setError(err instanceof Error ? err.message : 'Error al crear el tipo de papel');
      return null;
    }
  };

  const deletePapel = async (id: string): Promise<boolean> => {
    try {
      setError(null);

      const { error: deleteError } = await supabase
        .from('centro_copiado_papeles')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (deleteError) throw deleteError;
      return true;
    } catch (err) {
      console.error('Error deleting papel:', err);
      setError(err instanceof Error ? err.message : 'Error al eliminar el tipo de papel');
      return false;
    }
  };

  return {
    papeles,
    loading,
    error,
    fetchPapeles,
    createPapel,
    deletePapel,
  };
}
