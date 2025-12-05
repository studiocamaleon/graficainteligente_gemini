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

export function useServicioNiveles(servicioId: string | null) {
  const [niveles, setNiveles] = useState<NivelPrecio[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!servicioId) {
      setNiveles([]);
      return;
    }

    const fetchNiveles = async () => {
      setLoading(true);
      setError(null);

      try {
        const { data, error: fetchError } = await supabase
          .from('servicios_niveles_precio')
          .select(`
            id,
            nombre,
            tipo_impacto,
            valor_impacto,
            valor_impacto_secundario,
            paso_id,
            paso:pasos(id, nombre, etapa)
          `)
          .eq('servicio_id', servicioId)
          .order('orden', { ascending: true });

        if (fetchError) throw fetchError;

        setNiveles(data || []);
      } catch (err) {
        console.error('Error fetching servicio niveles:', err);
        setError('Error al cargar los niveles del servicio');
        setNiveles([]);
      } finally {
        setLoading(false);
      }
    };

    fetchNiveles();
  }, [servicioId]);

  const hasAllPasosAssigned = niveles.length > 0 && niveles.every((n) => n.paso_id !== null);

  return {
    niveles,
    loading,
    error,
    hasAllPasosAssigned,
  };
}
