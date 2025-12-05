import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface NivelPrecio {
  id: string;
  nombre: string;
  tipo_impacto: string;
  valor_impacto: number;
  valor_impacto_secundario: number | null;
  paso_id: string | null;
  paso?: {
    id: string;
    nombre: string;
    etapa: string;
  } | null;
}

export function useAcabadoNiveles(acabadoId?: string | null) {
  const [niveles, setNiveles] = useState<NivelPrecio[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchNivelesByAcabado = async (id: string) => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('acabados_niveles_precio')
        .select(`
          id,
          nombre,
          tipo_impacto,
          valor_impacto,
          valor_impacto_secundario,
          paso_id,
          paso:pasos(id, nombre, etapa)
        `)
        .eq('acabado_id', id)
        .order('orden', { ascending: true });

      if (fetchError) throw fetchError;

      setNiveles(data || []);
    } catch (err) {
      console.error('Error fetching acabado niveles:', err);
      setError('Error al cargar los niveles del acabado');
      setNiveles([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!acabadoId) {
      setNiveles([]);
      return;
    }

    fetchNivelesByAcabado(acabadoId);
  }, [acabadoId]);

  const hasAllPasosAssigned = niveles.length > 0 && niveles.every((n) => n.paso_id !== null);

  return {
    niveles,
    loading,
    error,
    hasAllPasosAssigned,
    fetchNivelesByAcabado,
  };
}
