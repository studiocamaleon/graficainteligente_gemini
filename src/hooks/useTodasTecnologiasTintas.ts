import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { TintaType } from '../types/database';

interface TintaPasoInfo {
  id: string;
  tinta: TintaType;
  paso_id: string | null;
  paso: {
    id: string;
    nombre: string;
    etapa: string;
  } | null;
}

export interface TecnologiaConTintas {
  tecnologia: {
    id: string;
    nombre: string;
  };
  tintas: TintaPasoInfo[];
  tieneTodasTintasConfiguradas: boolean;
  tintasConfiguradas: number;
  tintasTotal: number;
}

export function useTodasTecnologiasTintas() {
  const [tecnologias, setTecnologias] = useState<TecnologiaConTintas[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTodasTecnologias = async () => {
      setLoading(true);
      setError(null);

      try {
        const { data: tecnologiasData, error: tecnologiasError } = await supabase
          .from('tecnologias')
          .select('id, nombre')
          .eq('is_active', true)
          .order('nombre', { ascending: true });

        if (tecnologiasError) throw tecnologiasError;

        if (!tecnologiasData || tecnologiasData.length === 0) {
          setTecnologias([]);
          setLoading(false);
          return;
        }

        const tecnologiasConTintas: TecnologiaConTintas[] = [];

        for (const tecnologia of tecnologiasData) {
          const { data: tintasData, error: tintasError } = await supabase
            .from('tecnologias_tintas_pasos')
            .select(`
              id,
              tinta,
              paso_id,
              paso:pasos(id, nombre, etapa)
            `)
            .eq('tecnologia_id', tecnologia.id)
            .order('tinta', { ascending: true });

          if (tintasError) {
            console.error(`Error cargando tintas para tecnología ${tecnologia.nombre}:`, tintasError);
            continue;
          }

          const tintas = tintasData || [];
          const tintasConfiguradas = tintas.filter(t => t.paso_id !== null).length;
          const tintasTotal = tintas.length;

          tecnologiasConTintas.push({
            tecnologia: {
              id: tecnologia.id,
              nombre: tecnologia.nombre,
            },
            tintas: tintas as TintaPasoInfo[],
            tieneTodasTintasConfiguradas: tintasTotal > 0 && tintasConfiguradas === tintasTotal,
            tintasConfiguradas,
            tintasTotal,
          });
        }

        setTecnologias(tecnologiasConTintas);
      } catch (err) {
        console.error('Error fetching todas tecnologías con tintas:', err);
        setError('Error al cargar las tecnologías y sus configuraciones de tintas');
        setTecnologias([]);
      } finally {
        setLoading(false);
      }
    };

    fetchTodasTecnologias();
  }, []);

  const tieneAlgunaTecnologiaCompleta = tecnologias.some(t => t.tieneTodasTintasConfiguradas);
  const tecnologiasIncompletas = tecnologias.filter(t => !t.tieneTodasTintasConfiguradas && t.tintasTotal > 0);
  const tecnologiasSinTintas = tecnologias.filter(t => t.tintasTotal === 0);

  return {
    tecnologias,
    loading,
    error,
    tieneAlgunaTecnologiaCompleta,
    tecnologiasIncompletas: tecnologiasIncompletas.length,
    tecnologiasSinTintas: tecnologiasSinTintas.length,
  };
}
