import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import type { TrackingData, TrackingResponse } from '../types/tracking';

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

  // Ref para evitar ciclos infinitos en suscripción
  const isMountedRef = useRef(true);
  const itemIdsRef = useRef<string[]>([]);

  const fetchTracking = useCallback(async (silent = false) => {
    if (!token || token.length !== 32) {
      setError('Token de seguimiento inválido');
      setLoading(false);
      return;
    }

    console.log('🔍 Fetching tracking data...', { silent, timestamp: new Date().toISOString() });

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
        console.error('❌ Error al obtener tracking:', rpcError);
        setError('Error al obtener el estado de la orden. Por favor, intenta nuevamente.');
        setData(null);
        return;
      }

      if (!result) {
        console.warn('⚠️ No se encontró información de seguimiento');
        setError('No se encontró información de seguimiento');
        setData(null);
        return;
      }

      const typedResult = result as TrackingResponse;

      const isError = (r: TrackingResponse): r is { error: string; message: string } =>
        'error' in r;

      if (isError(typedResult)) {
        console.error('❌ Error en respuesta:', typedResult.message);
        setError(typedResult.message);
        setData(null);
        return;
      }

      const trackingData = typedResult as TrackingData;

      // Log detallado de datos recibidos
      console.log('📦 Datos recibidos del RPC:', {
        numero_orden: trackingData.numero_orden,
        estado_orden: trackingData.estado,
        items_count: trackingData.items?.length || 0,
        items: trackingData.items?.map(item => ({
          id: item.id,
          nombre: item.producto_nombre,
          estado_item: item.estado,
          pasos_count: item.pasos?.length || 0,
          pasos: item.pasos?.map(paso => ({
            nombre: paso.paso_nombre,
            tipo_etapa: paso.tipo_etapa,
            orden: paso.orden,
            estado: paso.estado_paso,
            fecha_inicio: paso.fecha_inicio,
            fecha_fin: paso.fecha_fin
          }))
        }))
      });

      console.log('💾 Actualizando estado con nuevos datos...');
      setData(trackingData);
      setLastUpdate(new Date());
      console.log('✅ Estado actualizado correctamente');

    } catch (err) {
      console.error('❌ Error inesperado al obtener tracking:', err);
      setError('Error inesperado. Por favor, verifica tu conexión.');
      setData(null);
    } finally {
      setLoading(false);
      setIsUpdating(false);
    }
  }, [token]);

  // Initial fetch
  useEffect(() => {
    console.log('🎬 Iniciando fetch inicial...');
    fetchTracking();

    return () => {
      isMountedRef.current = false;
    };
  }, [fetchTracking]);

  // Actualizar itemIdsRef cuando data cambie
  useEffect(() => {
    if (data?.items) {
      const newItemIds = data.items.map(i => i.id);
      itemIdsRef.current = newItemIds;
      console.log('📝 itemIds actualizados en ref:', newItemIds);
    }
  }, [data]);

  // Polling como fallback
  useEffect(() => {
    if (!autoRefresh || !token) return;

    console.log('⏰ Configurando polling cada', refreshInterval / 1000, 'segundos');

    const intervalId = setInterval(() => {
      console.log('⏰ Polling ejecutándose...');
      fetchTracking(true);
    }, refreshInterval);

    return () => {
      console.log('⏰ Limpiando polling');
      clearInterval(intervalId);
    };
  }, [autoRefresh, refreshInterval, token, fetchTracking]);

  // Realtime subscription - SUSCRIPCIÓN INMEDIATA SIN ESPERAR DATA
  useEffect(() => {
    if (!token) {
      console.log('⏭️ Sin token, no se puede suscribir a Realtime');
      return;
    }

    console.log('🔴 Configurando suscripción Realtime inmediata');

    // Crear canal único por token
    const channelName = `tracking-updates-${token}`;

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ordenes_trabajo_items_rutas',
        },
        (payload) => {
          console.log('🔴 Cambio detectado en rutas:', {
            event: payload.eventType,
            id: (payload.new as any)?.id || (payload.old as any)?.id,
            orden_item_id: (payload.new as any)?.orden_item_id || (payload.old as any)?.orden_item_id,
            estado_paso: (payload.new as any)?.estado_paso || (payload.old as any)?.estado_paso,
          });

          // Verificar si el cambio es relevante usando el ref actualizado
          const changedItemId = (payload.new as any)?.orden_item_id || (payload.old as any)?.orden_item_id;

          // Si aún no tenemos itemIds, hacer refetch igual (es nuestra primera actualización)
          if (itemIdsRef.current.length === 0) {
            console.log('✅ Primera actualización, ejecutando refetch...');
            setTimeout(() => {
              if (isMountedRef.current) {
                fetchTracking(true);
              }
            }, 500);
            return;
          }

          // Si ya tenemos itemIds, verificar si el cambio es relevante
          if (changedItemId && itemIdsRef.current.includes(changedItemId)) {
            console.log('✅ Cambio relevante, ejecutando refetch...');
            setTimeout(() => {
              if (isMountedRef.current) {
                fetchTracking(true);
              }
            }, 500);
          } else {
            console.log('⏭️ Cambio no relevante para esta orden');
          }
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
          console.log('🔴 Cambio detectado en items:', {
            event: payload.eventType,
            id: (payload.new as any)?.id || (payload.old as any)?.id,
            estado: (payload.new as any)?.estado || (payload.old as any)?.estado,
          });

          const changedItemId = (payload.new as any)?.id || (payload.old as any)?.id;

          // Si no tenemos itemIds o el cambio es relevante, refetch
          if (itemIdsRef.current.length === 0 || (changedItemId && itemIdsRef.current.includes(changedItemId))) {
            console.log('✅ Cambio relevante en item, ejecutando refetch...');
            setTimeout(() => {
              if (isMountedRef.current) {
                fetchTracking(true);
              }
            }, 500);
          } else {
            console.log('⏭️ Cambio no relevante para esta orden');
          }
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
          console.log('🔴 Cambio detectado en orden:', {
            event: payload.eventType,
            numero_orden: (payload.new as any)?.numero_orden || (payload.old as any)?.numero_orden,
            estado: (payload.new as any)?.estado || (payload.old as any)?.estado,
          });

          // Verificar si es nuestra orden por tracking_token
          const changedToken = (payload.new as any)?.tracking_token || (payload.old as any)?.tracking_token;
          if (changedToken === token) {
            console.log('✅ Cambio en nuestra orden, ejecutando refetch...');
            setTimeout(() => {
              if (isMountedRef.current) {
                fetchTracking(true);
              }
            }, 500);
          } else {
            console.log('⏭️ Cambio no relevante para esta orden');
          }
        }
      )
      .subscribe((status) => {
        console.log('🔴 Estado de suscripción Realtime:', status);

        if (status === 'SUBSCRIBED') {
          console.log('✅ Suscripción Realtime activa y funcionando');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ Error en canal Realtime - verificar configuración');
        } else if (status === 'TIMED_OUT') {
          console.error('❌ Timeout en suscripción Realtime');
        }
      });

    return () => {
      console.log('🔴 Desuscribiéndose de cambios en tiempo real');
      supabase.removeChannel(channel);
    };
  }, [token, fetchTracking]); // Depende de token y fetchTracking (fetchTracking está memoizado)

  // Log cuando data cambie (para debugging)
  useEffect(() => {
    if (data) {
      console.log('🎨 UI debería re-renderizar con:', {
        numero_orden: data.numero_orden,
        estado_orden: data.estado,
        fecha_actualizacion: lastUpdate?.toISOString(),
        items: data.items.map(i => ({
          producto: i.producto_nombre,
          estado: i.estado,
          pasos: i.pasos.map(p => `${p.paso_nombre} (${p.tipo_etapa}): ${p.estado_paso}`)
        }))
      });
    }
  }, [data, lastUpdate]);

  const refetch = useCallback(async () => {
    console.log('🔄 Refetch manual iniciado...');
    setLoading(true);
    await fetchTracking();
  }, [fetchTracking]);

  return { data, loading, error, refetch, isUpdating, lastUpdate };
}
