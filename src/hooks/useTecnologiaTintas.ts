import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { TintaType } from '../types/database';

interface TintaPaso {
  id: string;
  tinta: TintaType;
  paso_id: string | null;
  paso?: {
    id: string;
    nombre: string;
    etapa: string;
  } | null;
}

export function useTecnologiaTintas(tecnologiaId: string | null) {
  const [tintas, setTintas] = useState<TintaPaso[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tecnologiaId) {
      setTintas([]);
      return;
    }

    const fetchTintas = async () => {
      setLoading(true);
      setError(null);

      try {
        const { data, error: fetchError } = await supabase
          .from('tecnologias_tintas_pasos')
          .select(`
            id,
            tinta,
            paso_id,
            paso:pasos(id, nombre, etapa)
          `)
          .eq('tecnologia_id', tecnologiaId)
          .order('tinta', { ascending: true });

        if (fetchError) throw fetchError;

        setTintas(data || []);
      } catch (err) {
        console.error('Error fetching tecnologia tintas:', err);
        setError('Error al cargar las tintas de la tecnología');
        setTintas([]);
      } finally {
        setLoading(false);
      }
    };

    fetchTintas();
  }, [tecnologiaId]);

  const hasAllPasosAssigned = tintas.length > 0 && tintas.every((t) => t.paso_id !== null);

  return {
    tintas,
    loading,
    error,
    hasAllPasosAssigned,
  };
}
