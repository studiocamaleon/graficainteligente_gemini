import { useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface RealtimeMonitorOptions {
  companyId: string;
  onJobItemUpdated?: (itemId: string) => void;
  onRutaUpdated?: (rutaId: string, ordenItemId: string) => void;
}

export function useRealtimeMonitor(options: RealtimeMonitorOptions) {
  const { companyId, onJobItemUpdated, onRutaUpdated } = options;
  const channelRef = useRef<RealtimeChannel | null>(null);
  const rutasChannelRef = useRef<RealtimeChannel | null>(null);
  const isSubscribedRef = useRef(false);

  const channelId = useRef(`monitor_items_${Math.random().toString(36).substr(2, 9)}`).current;
  const rutasChannelId = useRef(`monitor_rutas_${Math.random().toString(36).substr(2, 9)}`).current;

  const onJobItemUpdatedRef = useRef(onJobItemUpdated);
  const onRutaUpdatedRef = useRef(onRutaUpdated);

  useEffect(() => {
    onJobItemUpdatedRef.current = onJobItemUpdated;
    onRutaUpdatedRef.current = onRutaUpdated;
  }, [onJobItemUpdated, onRutaUpdated]);

  const setupRealtimeSubscriptions = useCallback(() => {
    if (!companyId) {
      console.log('⚠️ useRealtimeMonitor: No companyId, skipping subscriptions');
      return;
    }

    if (isSubscribedRef.current && channelRef.current && rutasChannelRef.current) {
      console.log('⏭️ Already subscribed, skipping re-subscription');
      return;
    }

    console.log('📡 Setting up realtime subscriptions for Monitor view');

    if (channelRef.current) {
      console.log('🧹 Cleaning up previous items subscription');
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    if (rutasChannelRef.current) {
      console.log('🧹 Cleaning up previous rutas subscription');
      supabase.removeChannel(rutasChannelRef.current);
      rutasChannelRef.current = null;
    }

    console.log(`📡 [${channelId}] Setting up realtime subscription for ordenes_trabajo_items`);
    const itemsChannel = supabase
      .channel(channelId)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ordenes_trabajo_items',
          filter: `company_id=eq.${companyId}`,
        },
        (payload) => {
          const timestamp = new Date().toISOString();
          console.log(`🔔 [${timestamp}] [${channelId}] Received ordenes_trabajo_items change:`, payload.eventType, payload);

          if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
            const itemId = payload.new?.id;
            if (itemId && onJobItemUpdatedRef.current) {
              console.log(`✅ Triggering job update for item: ${itemId}`);
              onJobItemUpdatedRef.current(itemId);
            }
          } else if (payload.eventType === 'DELETE') {
            const itemId = payload.old?.id;
            if (itemId && onJobItemUpdatedRef.current) {
              console.log(`🗑️ Job deleted, removing item: ${itemId}`);
              onJobItemUpdatedRef.current(itemId);
            }
          }
        }
      )
      .subscribe((status, err) => {
        console.log(`📡 [${channelId}] Items subscription status:`, status);

        if (status === 'SUBSCRIBED') {
          console.log(`✅ [${channelId}] Successfully subscribed to ordenes_trabajo_items changes`);
        } else if (status === 'CLOSED') {
          console.error(`❌ [${channelId}] Channel closed unexpectedly!`, err);
          isSubscribedRef.current = false;
          setTimeout(() => {
            console.log(`🔄 [${channelId}] Attempting to reconnect...`);
            setupRealtimeSubscriptions();
          }, 2000);
        } else if (status === 'CHANNEL_ERROR') {
          console.error(`❌ [${channelId}] Channel error:`, err);
          isSubscribedRef.current = false;
        }
      });

    channelRef.current = itemsChannel;

    console.log(`📡 [${rutasChannelId}] Setting up realtime subscription for ordenes_trabajo_items_rutas`);
    const rutasChannel = supabase
      .channel(rutasChannelId)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ordenes_trabajo_items_rutas',
          filter: `company_id=eq.${companyId}`,
        },
        (payload) => {
          const timestamp = new Date().toISOString();
          console.log(`🔔 [${timestamp}] [${rutasChannelId}] Received ordenes_trabajo_items_rutas change:`, payload.eventType, payload);

          if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
            const rutaId = payload.new?.id;
            const ordenItemId = payload.new?.orden_item_id;
            const estadoPaso = payload.new?.estado_paso;
            if (rutaId && ordenItemId && onRutaUpdatedRef.current) {
              console.log(`✅ Triggering job update for ruta: ${rutaId}, item: ${ordenItemId}, estado: ${estadoPaso}`);
              onRutaUpdatedRef.current(rutaId, ordenItemId);
            }
          }
        }
      )
      .subscribe((status, err) => {
        console.log(`📡 [${rutasChannelId}] Rutas subscription status:`, status);

        if (status === 'SUBSCRIBED') {
          console.log(`✅ [${rutasChannelId}] Successfully subscribed to ordenes_trabajo_items_rutas changes`);
        } else if (status === 'CLOSED') {
          console.error(`❌ [${rutasChannelId}] Channel closed unexpectedly!`, err);
          isSubscribedRef.current = false;
          setTimeout(() => {
            console.log(`🔄 [${rutasChannelId}] Attempting to reconnect...`);
            setupRealtimeSubscriptions();
          }, 2000);
        } else if (status === 'CHANNEL_ERROR') {
          console.error(`❌ [${rutasChannelId}] Channel error:`, err);
          isSubscribedRef.current = false;
        }
      });

    rutasChannelRef.current = rutasChannel;
    isSubscribedRef.current = true;
  }, [companyId, channelId, rutasChannelId]);

  useEffect(() => {
    setupRealtimeSubscriptions();

    return () => {
      console.log('🧹 useRealtimeMonitor: Component unmounting, cleaning up subscriptions');
      isSubscribedRef.current = false;

      if (channelRef.current) {
        console.log(`🧹 Removing channel: ${channelId}`);
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }

      if (rutasChannelRef.current) {
        console.log(`🧹 Removing channel: ${rutasChannelId}`);
        supabase.removeChannel(rutasChannelRef.current);
        rutasChannelRef.current = null;
      }
    };
  }, [companyId, channelId, rutasChannelId, setupRealtimeSubscriptions]);

  return {
    isSubscribed: isSubscribedRef.current &&
      channelRef.current !== null &&
      rutasChannelRef.current !== null,
  };
}
