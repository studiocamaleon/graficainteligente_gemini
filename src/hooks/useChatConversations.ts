import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import type { ChatConversationListItem } from '../types/chat';
import { dedupeConversations, normalizeChatConversation } from '../utils/chat';

export function useChatConversations() {
  const { profile } = useAuth();
  const [conversations, setConversations] = useState<ChatConversationListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  const fetchConversations = useCallback(async () => {
    if (!profile?.company_id) {
      setConversations([]);
      setLoading(false);
      return [];
    }

    try {
      setError(null);
      const { data, error: rpcError } = await (supabase.rpc as any)('list_chat_conversations');

      if (rpcError) throw rpcError;

      const mapped = dedupeConversations(((data as any[]) || []).map(normalizeChatConversation));
      setConversations(mapped);
      return mapped;
    } catch (err) {
      console.error('Error cargando conversaciones del chat:', err);
      setError(err instanceof Error ? err.message : 'No se pudo cargar el chat');
      return [];
    } finally {
      setLoading(false);
    }
  }, [profile?.company_id]);

  const ensureGeneralConversation = useCallback(async () => {
    const { data, error: rpcError } = await (supabase.rpc as any)('ensure_general_chat');
    if (rpcError) throw rpcError;
    const conversationId = data as string;
    await fetchConversations();
    return conversationId;
  }, [fetchConversations]);

  const ensureDirectConversation = useCallback(
    async (otherProfileId: string) => {
      const { data, error: rpcError } = await (supabase.rpc as any)('ensure_direct_chat', {
        other_profile_id: otherProfileId,
      });

      if (rpcError) throw rpcError;

      const conversationId = data as string;
      await fetchConversations();
      return conversationId;
    },
    [fetchConversations]
  );

  const markConversationAsRead = useCallback((conversationId: string) => {
    setConversations((current) =>
      current.map((conversation) =>
        conversation.conversation_id === conversationId
          ? {
              ...conversation,
              unread_count: 0,
            }
          : conversation
      )
    );
  }, []);

  useEffect(() => {
    let isMounted = true;

    const bootstrap = async () => {
      if (!profile?.company_id) {
        setLoading(false);
        return;
      }

      try {
        await (supabase.rpc as any)('ensure_general_chat');
      } catch (err) {
        console.error('Error asegurando el canal general:', err);
      }

      if (!isMounted) return;
      await fetchConversations();

      const channel = supabase
        .channel(`chat-conversations-${profile.company_id}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'chat_conversations', filter: `company_id=eq.${profile.company_id}` },
          () => {
            void fetchConversations();
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'chat_conversation_participants', filter: `company_id=eq.${profile.company_id}` },
          () => {
            void fetchConversations();
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'chat_messages', filter: `company_id=eq.${profile.company_id}` },
          () => {
            void fetchConversations();
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'chat_message_reads', filter: `company_id=eq.${profile.company_id}` },
          () => {
            void fetchConversations();
          }
        )
        .subscribe();

      channelRef.current = channel;
    };

    void bootstrap();

    return () => {
      isMounted = false;
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [fetchConversations, profile?.company_id]);

  const unreadCount = useMemo(
    () => conversations.reduce((total, conversation) => total + conversation.unread_count, 0),
    [conversations]
  );

  return {
    conversations,
    loading,
    error,
    unreadCount,
    fetchConversations,
    ensureGeneralConversation,
    ensureDirectConversation,
    markConversationAsRead,
  };
}
