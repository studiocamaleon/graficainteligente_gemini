import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';

export function useChatPresence() {
  const { profile } = useAuth();
  const channelRef = useRef<RealtimeChannel | null>(null);
  const [onlineProfileIds, setOnlineProfileIds] = useState<string[]>([]);

  useEffect(() => {
    if (!profile?.company_id || !profile.id) {
      setOnlineProfileIds([]);
      return;
    }

    const channel = supabase.channel(`chat-presence-${profile.company_id}`, {
      config: {
        presence: {
          key: profile.id,
        },
      },
    });

    const syncPresenceState = () => {
      const presenceState = channel.presenceState<Record<string, { profile_id?: string }[]>>();
      const nextOnlineProfileIds = Object.values(presenceState).flatMap((entries) =>
        (entries || []).flatMap((entry) => (entry.profile_id ? [entry.profile_id] : []))
      );

      setOnlineProfileIds(Array.from(new Set(nextOnlineProfileIds)));
    };

    channel
      .on('presence', { event: 'sync' }, syncPresenceState)
      .on('presence', { event: 'join' }, syncPresenceState)
      .on('presence', { event: 'leave' }, syncPresenceState)
      .subscribe(async (status) => {
        if (status !== 'SUBSCRIBED') return;

        await channel.track({
          profile_id: profile.id,
          company_id: profile.company_id,
          online_at: new Date().toISOString(),
        });
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [profile?.company_id, profile?.id]);

  const onlineProfileIdSet = useMemo(() => new Set(onlineProfileIds), [onlineProfileIds]);

  const isProfileOnline = useCallback(
    (profileId?: string | null) => {
      if (!profileId) return false;
      return onlineProfileIdSet.has(profileId);
    },
    [onlineProfileIdSet]
  );

  return {
    onlineProfileIds,
    isProfileOnline,
  };
}
