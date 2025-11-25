import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { TrackingData, TrackingResponse, isTrackingError } from '../types/tracking';

interface UseOrderTrackingOptions {
  autoRefresh?: boolean;
  refreshInterval?: number;
}

interface UseOrderTrackingReturn {
  data: TrackingData | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  isUpdating: boolean;
  lastUpdate: Date | null;
}

export function useOrderTracking(
  token: string,
  options: UseOrderTrackingOptions = {}
): UseOrderTrackingReturn {
  const { autoRefresh = false, refreshInterval = 30000 } = options;

  const [data, setData] = useState<TrackingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const fetchTracking = useCallback(async (silent = false) => {
    if (!token || token.length !== 32) {
      setError('Token de seguimiento inválido');
      setLoading(false);
      return;
    }

    try {
      setError(null);
      if (!silent) {
        setIsUpdating(true);
      }

      const { data: result, error: rpcError } = await supabase.rpc(
        'fn_get_public_order_tracking',
        { p_tracking_token: token }
      );

      if (rpcError) {
        console.error('Error al obtener tracking:', rpcError);
        setError('Error al obtener el estado de la orden. Por favor, intenta nuevamente.');
        setData(null);
        return;
      }

      if (!result) {
        setError('No se encontró información de seguimiento');
        setData(null);
        return;
      }

      const typedResult = result as TrackingResponse;

      const isError = (r: TrackingResponse): r is { error: string; message: string } =>
        'error' in r;

      if (isError(typedResult)) {
        setError(typedResult.message);
        setData(null);
        return;
      }

      setData(typedResult as TrackingData);
      setLastUpdate(new Date());
    } catch (err) {
      console.error('Error inesperado al obtener tracking:', err);
      setError('Error inesperado. Por favor, verifica tu conexión.');
      setData(null);
    } finally {
      setLoading(false);
      setIsUpdating(false);
    }
  }, [token]);

  useEffect(() => {
    fetchTracking();
  }, [fetchTracking]);

  // Polling como fallback
  useEffect(() => {
    if (!autoRefresh || !token) return;

    const intervalId = setInterval(() => {
      fetchTracking(true);
    }, refreshInterval);

    return () => clearInterval(intervalId);
  }, [autoRefresh, refreshInterval, token, fetchTracking]);

  // Realtime subscription para actualizaciones instantáneas
  useEffect(() => {
    if (!data?.items || !token) return;

    const itemIds = data.items.map((item) => item.id);

    if (itemIds.length === 0) return;

    console.log('🔴 Suscribiéndose a cambios en tiempo real para items:', itemIds.length);

    const channel = supabase
      .channel(`tracking-${token}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ordenes_trabajo_items_rutas',
        },
        (payload) => {
          console.log('🔴 Cambio detectado en rutas:', payload);
          // Refetch silencioso (sin spinner)
          fetchTracking(true);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ordenes_trabajo_items',
        },
        (payload) => {
          console.log('🔴 Cambio detectado en items:', payload);
          fetchTracking(true);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ordenes_trabajo',
        },
        (payload) => {
          console.log('🔴 Cambio detectado en orden:', payload);
          fetchTracking(true);
        }
      )
      .subscribe((status) => {
        console.log('🔴 Estado de suscripción Realtime:', status);
      });

    return () => {
      console.log('🔴 Desuscribiéndose de cambios en tiempo real');
      supabase.removeChannel(channel);
    };
  }, [data?.items, token, fetchTracking]);

  const refetch = useCallback(async () => {
    setLoading(true);
    await fetchTracking();
  }, [fetchTracking]);

  return { data, loading, error, refetch, isUpdating, lastUpdate };
}
