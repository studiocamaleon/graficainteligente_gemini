import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export interface MotivoPausa {
  id: string;
  company_id: string;
  nombre: string;
  categoria: 'cliente' | 'materiales' | 'maquinaria' | 'personal' | 'externo' | 'otro';
  requiere_descripcion: boolean;
  color: string;
  icono: string | null;
  orden: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function useMotivosPausa() {
  const [motivos, setMotivos] = useState<MotivoPausa[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    cargarMotivos();
  }, []);

  const cargarMotivos = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: errorCarga } = await supabase
        .from('pasos_motivos_pausa')
        .select('*')
        .eq('is_active', true)
        .order('categoria', { ascending: true })
        .order('orden', { ascending: true });

      if (errorCarga) throw errorCarga;

      setMotivos(data || []);
    } catch (err) {
      console.error('Error cargando motivos:', err);
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  const getMotivosPorCategoria = (categoria: MotivoPausa['categoria']) => {
    return motivos.filter((m) => m.categoria === categoria);
  };

  return {
    motivos,
    loading,
    error,
    recargar: cargarMotivos,
    getMotivosPorCategoria,
  };
}
