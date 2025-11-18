import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import type { TecnologiaTintaPaso, TecnologiaTintaPasoFormData, TintaType } from '../types/database';

interface UseTecnologiasTintasPasosParams {
  tecnologiaId?: string;
}

export function useTecnologiasTintasPasos(params: UseTecnologiasTintasPasosParams = {}) {
  const { company } = useAuth();
  const { tecnologiaId } = params;

  const [configuraciones, setConfiguraciones] = useState<TecnologiaTintaPaso[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchConfiguraciones = async () => {
    if (!company || !tecnologiaId) {
      setConfiguraciones([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('tecnologias_tintas_pasos')
        .select('*')
        .eq('tecnologia_id', tecnologiaId)
        .order('tinta', { ascending: true });

      if (error) throw error;

      setConfiguraciones(data || []);
    } catch (error) {
      console.error('Error fetching tecnologias tintas pasos:', error);
      setConfiguraciones([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfiguraciones();
  }, [company, tecnologiaId]);

  return {
    configuraciones,
    loading,
    refetch: fetchConfiguraciones,
  };
}

export function useTecnologiaTintasPasos() {
  const [loading, setLoading] = useState(false);

  const saveConfiguraciones = async (
    tecnologiaId: string,
    configuraciones: TecnologiaTintaPasoFormData[]
  ): Promise<boolean> => {
    setLoading(true);
    try {
      const { error: deleteError } = await supabase
        .from('tecnologias_tintas_pasos')
        .delete()
        .eq('tecnologia_id', tecnologiaId);

      if (deleteError) throw deleteError;

      if (configuraciones.length > 0) {
        const inserts = configuraciones.map((config) => ({
          tecnologia_id: tecnologiaId,
          tinta: config.tinta,
          paso_id: config.paso_id,
        }));

        const { error: insertError } = await supabase
          .from('tecnologias_tintas_pasos')
          .insert(inserts);

        if (insertError) throw insertError;
      }

      return true;
    } catch (error) {
      console.error('Error saving tecnologia tintas pasos:', error);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const checkCompletitud = async (tecnologiaId: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase.rpc('check_tecnologia_tintas_completitud', {
        p_tecnologia_id: tecnologiaId,
      });

      if (error) {
        console.error('Error checking completitud:', error);
        return false;
      }

      return data || false;
    } catch (error) {
      console.error('Error checking completitud:', error);
      return false;
    }
  };

  const getConfiguracionesByTecnologia = async (
    tecnologiaId: string
  ): Promise<TecnologiaTintaPaso[]> => {
    try {
      const { data, error } = await supabase
        .from('tecnologias_tintas_pasos')
        .select('*')
        .eq('tecnologia_id', tecnologiaId)
        .order('tinta', { ascending: true });

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Error getting configuraciones:', error);
      return [];
    }
  };

  const validateConfiguraciones = (
    tintasDisponibles: TintaType[],
    configuraciones: TecnologiaTintaPasoFormData[]
  ): { isValid: boolean; missing: TintaType[] } => {
    const configuradas = configuraciones.map((c) => c.tinta);
    const missing = tintasDisponibles.filter((tinta) => !configuradas.includes(tinta));

    return {
      isValid: missing.length === 0,
      missing,
    };
  };

  return {
    saveConfiguraciones,
    checkCompletitud,
    getConfiguracionesByTecnologia,
    validateConfiguraciones,
    loading,
  };
}
