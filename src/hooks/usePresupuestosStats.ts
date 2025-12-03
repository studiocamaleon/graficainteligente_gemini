import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';

interface PresupuestosStatsData {
  presupuestos_pendientes_cotizar: number;
}

export function usePresupuestosStats() {
  const { profile } = useAuth();
  const [stats, setStats] = useState<PresupuestosStatsData>({
    presupuestos_pendientes_cotizar: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (profile?.company_id) {
      fetchStats();
    }
  }, [profile?.company_id]);

  const fetchStats = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!profile?.company_id) {
        throw new Error('No se encontró información de la empresa');
      }

      // Llamar función de BD para obtener presupuestos pendientes de cotización
      const { data, error: rpcError } = await supabase.rpc(
        'fn_presupuestos_pendientes_cotizar',
        {
          p_company_id: profile.company_id,
        }
      );

      if (rpcError) throw rpcError;

      setStats({
        presupuestos_pendientes_cotizar: data || 0,
      });
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
