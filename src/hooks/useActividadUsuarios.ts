import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import type { ActividadUsuario, FiltrosActividad } from '../types/database';

export function useActividadUsuarios(filtros?: Partial<FiltrosActividad>) {
  const { profile } = useAuth();
  const [actividades, setActividades] = useState<ActividadUsuario[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);

  const fetchActividades = useCallback(async () => {
    if (!profile?.company_id) return;

    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from('v_actividad_usuarios')
        .select('*', { count: 'exact' })
        .eq('company_id', profile.company_id)
        .order('fecha_fin', { ascending: false });

      if (filtros?.fecha_desde) {
        query = query.gte('fecha_fin', filtros.fecha_desde.toISOString());
      }

      if (filtros?.fecha_hasta) {
        query = query.lte('fecha_fin', filtros.fecha_hasta.toISOString());
      }

      if (filtros?.responsables && filtros.responsables.length > 0) {
        query = query.in('responsable_id', filtros.responsables);
      }

      if (filtros?.estaciones && filtros.estaciones.length > 0) {
        query = query.in('estacion_id', filtros.estaciones);
      }

      if (filtros?.estados && filtros.estados.length > 0) {
        query = query.in('estado_paso', filtros.estados);
      }

      if (filtros?.tipo_etapa) {
        query = query.eq('tipo_etapa', filtros.tipo_etapa);
      }

      query = query.limit(200);

      const { data, error: fetchError, count } = await query;

      if (fetchError) throw fetchError;

      setActividades(data || []);
      setTotal(count || 0);
    } catch (err) {
      console.error('Error fetching actividades:', err);
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  }, [profile?.company_id, filtros]);

  useEffect(() => {
    fetchActividades();
  }, [fetchActividades]);

  const refresh = useCallback(() => {
    fetchActividades();
  }, [fetchActividades]);

  return {
    actividades,
    loading,
    error,
    total,
    refresh,
  };
}
