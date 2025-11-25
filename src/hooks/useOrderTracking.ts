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
}

export function useOrderTracking(
  token: string,
  options: UseOrderTrackingOptions = {}
): UseOrderTrackingReturn {
  const { autoRefresh = false, refreshInterval = 30000 } = options;

  const [data, setData] = useState<TrackingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTracking = useCallback(async () => {
    if (!token || token.length !== 32) {
      setError('Token de seguimiento inválido');
      setLoading(false);
      return;
    }

    try {
      setError(null);

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
    } catch (err) {
      console.error('Error inesperado al obtener tracking:', err);
      setError('Error inesperado. Por favor, verifica tu conexión.');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchTracking();
  }, [fetchTracking]);

  useEffect(() => {
    if (!autoRefresh || !token) return;

    const intervalId = setInterval(() => {
      fetchTracking();
    }, refreshInterval);

    return () => clearInterval(intervalId);
  }, [autoRefresh, refreshInterval, token, fetchTracking]);

  const refetch = useCallback(async () => {
    setLoading(true);
    await fetchTracking();
  }, [fetchTracking]);

  return { data, loading, error, refetch };
}
