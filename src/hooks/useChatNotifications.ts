import { useEffect, useMemo, useRef } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import { useChatConversations } from './useChatConversations';
import { useChatPanelState } from './useChatPanelState';
import { useToast } from '../contexts/ToastContext';

interface SenderProfile {
  full_name: string | null;
  email: string | null;
}

interface ConversationSnapshot {
  conversation_id: string;
  type: 'general' | 'direct';
  title: string;
}

export function useChatNotifications(enabled = true) {
  const { profile, company } = useAuth();
  const { conversations } = useChatConversations();
  const { isOpen, selectedConversationId } = useChatPanelState();
  const { showInfo } = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const channelRef = useRef<RealtimeChannel | null>(null);
  const notifiedMessageIdsRef = useRef<Set<string>>(new Set());

  const activeConversationIdFromRoute = useMemo(() => {
    if (location.pathname !== '/app/chat') return null;

    const searchParams = new URLSearchParams(location.search);
    return searchParams.get('conversation');
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (!enabled || !profile?.id || !profile.company_id) return;

    if ('Notification' in window && Notification.permission === 'default') {
      void Notification.requestPermission().catch(() => {
        // Ignore permission request errors silently.
      });
    }

    const isConversationVisible = (conversationId: string) => {
      const isVisible = document.visibilityState === 'visible';
      if (!isVisible) return false;

      const isOpenInPanel = isOpen && selectedConversationId === conversationId;
      const isOpenInPage = location.pathname === '/app/chat' && activeConversationIdFromRoute === conversationId;

      return isOpenInPanel || isOpenInPage;
    };

    const fetchSenderProfile = async (senderProfileId: string) => {
      const { data, error } = await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('id', senderProfileId)
        .maybeSingle();

      if (error) {
        console.error('Error obteniendo remitente del chat:', error);
        return null;
      }

      return data as SenderProfile | null;
    };

    const fetchConversationSnapshot = async (conversationId: string) => {
      const existing = conversations.find((item) => item.conversation_id === conversationId);
      if (existing) {
        return {
          conversation_id: existing.conversation_id,
          type: existing.type,
          title: existing.title,
        } satisfies ConversationSnapshot;
      }

      const { data, error } = await supabase
        .from('chat_conversations')
        .select('id, type, title')
        .eq('id', conversationId)
        .maybeSingle();

      if (error || !data) {
        return null;
      }

      return {
        conversation_id: data.id,
        type: (data.type as 'general' | 'direct') || 'direct',
        title: data.title || 'Conversación',
      } satisfies ConversationSnapshot;
    };

    const channel = supabase
      .channel(`chat-notifications-${profile.company_id}-${profile.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `company_id=eq.${profile.company_id}`,
        },
        async (payload) => {
          const message = payload.new as {
            id: string;
            conversation_id: string;
            sender_profile_id: string;
            body: string;
          };

          if (message.sender_profile_id === profile.id) return;
          if (notifiedMessageIdsRef.current.has(message.id)) return;
          notifiedMessageIdsRef.current.add(message.id);

          const conversation = await fetchConversationSnapshot(message.conversation_id);
          if (!conversation) return;
          if (isConversationVisible(message.conversation_id)) return;

          const senderProfile = await fetchSenderProfile(message.sender_profile_id);
          const senderName = senderProfile?.full_name || senderProfile?.email || 'Alguien del equipo';
          const conversationLabel = conversation.type === 'general' ? 'General' : conversation.title;
          const preview = message.body.trim().slice(0, 120);
          const toastMessage =
            conversation.type === 'general'
              ? `${senderName} escribió en General: ${preview}`
              : `${senderName} te escribió: ${preview}`;

          if (document.visibilityState === 'visible') {
            showInfo(toastMessage, 5000);
            return;
          }

          if (!('Notification' in window)) return;

          let permission = Notification.permission;
          if (permission === 'default') {
            permission = await Notification.requestPermission();
          }

          if (permission !== 'granted') return;

          const notification = new Notification(senderName, {
            body:
              conversation.type === 'general'
                ? `Nuevo mensaje en ${conversationLabel}: ${preview}`
                : preview || `Nuevo mensaje en ${conversationLabel}`,
            icon: company?.logo_url || '/logo.png',
            tag: `chat-${message.id}`,
          });

          notification.onclick = () => {
            window.focus();
            navigate(`/app/chat?conversation=${message.conversation_id}`);
            notification.close();
          };
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [
    activeConversationIdFromRoute,
    company?.logo_url,
    conversations,
    enabled,
    isOpen,
    location.pathname,
    navigate,
    profile?.company_id,
    profile?.id,
    selectedConversationId,
    showInfo,
  ]);
}
