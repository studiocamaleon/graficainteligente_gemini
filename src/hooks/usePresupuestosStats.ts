import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import type { PresupuestosFilters } from '../types/presupuestos';

export interface PresupuestosStatsData {
  total_count: number;
  borrador_count: number;
  enviado_count: number;
  aprobado_count: number;
  rechazado_count: number;
  convertido_count: number;
  vencido_count: number;
  por_vencer_count: number;
  valor_total: number;
  valor_en_negociacion: number;
  pendientes_cotizar_count: number;
}

export function usePresupuestosStats(filters?: PresupuestosFilters) {
  const { profile } = useAuth();
  const [stats, setStats] = useState<PresupuestosStatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (profile?.company_id) {
      fetchStats();
    }
  }, [profile?.company_id, JSON.stringify(filters)]);

  const fetchStats = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!profile?.company_id) {
        throw new Error('No se encontró información de la empresa');
      }

      const { data, error: rpcError } = await supabase.rpc(
        'fn_get_presupuestos_stats',
        {
          p_company_id: profile.company_id,
          p_vendedor_id: filters?.vendedor_id || null,
          p_cliente_id: filters?.cliente_id || null,
          p_fecha_desde: filters?.fecha_desde || null,
          p_fecha_hasta: filters?.fecha_hasta || null,
          p_canal_venta: Array.isArray(filters?.canal_venta) ? filters.canal_venta[0] : (filters?.canal_venta || null),
          p_search_term: filters?.search || null,
          p_estado: Array.isArray(filters?.estado) ? filters.estado[0] : (filters?.estado || null),
          p_solo_vencidos: filters?.solo_vencidos || false,
          p_solo_pendientes_respuesta: filters?.solo_pendientes_respuesta || false,
        }
      );

      if (rpcError) throw rpcError;

      setStats(data as PresupuestosStatsData);
    } catch (err: any) {
      console.error('Error fetching presupuestos stats:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return {
    stats,
    loading,
    error,
    refetch: fetchStats,
  };
}
