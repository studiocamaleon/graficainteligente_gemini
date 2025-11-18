import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface TecnologiaSimple {
  id: string;
  nombre: string;
}

export function useTecnologiasPortabanner() {
  const [tecnologias, setTecnologias] = useState<TecnologiaSimple[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTecnologias = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const { data, error: fetchError } = await supabase
          .from('tecnologias')
          .select('id, nombre')
          .eq('is_active', true)
          .order('nombre', { ascending: true });

        if (fetchError) throw fetchError;

        setTecnologias(data || []);
      } catch (err) {
        console.error('Error fetching tecnologias for portabanner:', err);
        setError('Error al cargar las tecnologías');
        setTecnologias([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTecnologias();
  }, []);

  return {
    tecnologias,
    isLoading,
    error,
  };
}
