import { useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface RealtimeJobsOptions {
  onJobItemUpdated?: (itemId: string) => void;
  onRutaUpdated?: (rutaId: string, ordenItemId: string) => void;
}

export function useRealtimeJobs(options: RealtimeJobsOptions = {}) {
  const { profile } = useAuth();
  const channelRef = useRef<RealtimeChannel | null>(null);
  const rutasChannelRef = useRef<RealtimeChannel | null>(null);

  const setupRealtimeSubscriptions = useCallback(() => {
    if (!profile?.company_id) {
      console.log('⚠️ useRealtimeJobs: No company_id, skipping subscriptions');
      return;
    }

    // Cleanup previous subscriptions
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

    // Subscribe to ordenes_trabajo_items changes
    console.log('📡 Setting up realtime subscription for ordenes_trabajo_items');
    const itemsChannel = supabase
      .channel('ordenes_trabajo_items_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ordenes_trabajo_items',
          filter: `company_id=eq.${profile.company_id}`,
        },
        (payload) => {
          console.log('🔔 Received ordenes_trabajo_items change:', payload.eventType, payload);

          if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
            const itemId = payload.new?.id;
            if (itemId && options.onJobItemUpdated) {
              options.onJobItemUpdated(itemId);
            }
          }
        }
      )
      .subscribe((status) => {
        console.log('📡 Items subscription status:', status);
      });

    channelRef.current = itemsChannel;

    // Subscribe to ordenes_trabajo_items_rutas changes
    console.log('📡 Setting up realtime subscription for ordenes_trabajo_items_rutas');
    const rutasChannel = supabase
      .channel('ordenes_trabajo_items_rutas_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ordenes_trabajo_items_rutas',
          filter: `company_id=eq.${profile.company_id}`,
        },
        (payload) => {
          console.log('🔔 Received ordenes_trabajo_items_rutas change:', payload.eventType, payload);

          if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
            const rutaId = payload.new?.id;
            const ordenItemId = payload.new?.orden_item_id;
            if (rutaId && ordenItemId && options.onRutaUpdated) {
              options.onRutaUpdated(rutaId, ordenItemId);
            }
          }
        }
      )
      .subscribe((status) => {
        console.log('📡 Rutas subscription status:', status);
      });

    rutasChannelRef.current = rutasChannel;
  }, [profile?.company_id, options.onJobItemUpdated, options.onRutaUpdated]);

  useEffect(() => {
    setupRealtimeSubscriptions();

    return () => {
      console.log('🧹 Cleaning up realtime subscriptions');
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
      if (rutasChannelRef.current) {
        supabase.removeChannel(rutasChannelRef.current);
      }
    };
  }, [setupRealtimeSubscriptions]);

  return {
    isSubscribed: channelRef.current !== null && rutasChannelRef.current !== null,
  };
}
