import { useCallback, useEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import type { ChatMessageReferenceInput, ChatMessageWithMeta } from '../types/chat';
import { dedupeMessages, normalizeChatMessage } from '../utils/chat';

interface UseChatMessagesOptions {
  conversationId: string | null;
}

export function useChatMessages({ conversationId }: UseChatMessagesOptions) {
  const { profile } = useAuth();
  const [messages, setMessages] = useState<ChatMessageWithMeta[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const conversationIdRef = useRef<string | null>(conversationId);

  useEffect(() => {
    conversationIdRef.current = conversationId;
  }, [conversationId]);

  const fetchMessageById = useCallback(
    async (messageId: string) => {
      const activeConversationId = conversationIdRef.current;
      if (!activeConversationId) return null;

      const { data: messageData, error: messageError } = await supabase
        .from('chat_messages')
        .select(
          `
            id,
            conversation_id,
            company_id,
            sender_profile_id,
            body,
            message_type,
            created_at,
            updated_at,
            edited_at,
            sender:profiles!chat_messages_sender_profile_id_fkey(id, full_name, email, avatar_url)
          `
        )
        .eq('id', messageId)
        .eq('conversation_id', activeConversationId)
        .maybeSingle();

      if (messageError || !messageData) return null;

      const { data: readsData } = await supabase
        .from('chat_message_reads')
        .select('id, message_id, conversation_id, company_id, reader_profile_id, read_at, created_at')
        .eq('message_id', messageId);

      const { data: referencesData } = await supabase
        .from('chat_message_references')
        .select(
          'id, message_id, conversation_id, company_id, reference_type, entity_id, entity_label, entity_status, client_name, created_at'
        )
        .eq('message_id', messageId);

      return normalizeChatMessage({
        ...(messageData as any),
        reads: (readsData as any[]) || [],
        references: (referencesData as any[]) || [],
      });
    },
    []
  );

  const fetchMessages = useCallback(async () => {
    if (!conversationId) {
      setMessages([]);
      setLoading(false);
      return [];
    }

    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('chat_messages')
        .select(
          `
            id,
            conversation_id,
            company_id,
            sender_profile_id,
            body,
            message_type,
            created_at,
            updated_at,
            edited_at,
            sender:profiles!chat_messages_sender_profile_id_fkey(id, full_name, email, avatar_url)
          `
        )
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
        .limit(100);

      if (fetchError) throw fetchError;

      const messageIds = ((data as any[]) || []).map((row) => row.id);

      const { data: readsData, error: readsError } = messageIds.length
        ? await supabase
            .from('chat_message_reads')
            .select('id, message_id, conversation_id, company_id, reader_profile_id, read_at, created_at')
            .eq('conversation_id', conversationId)
            .in('message_id', messageIds)
        : { data: [], error: null };

      if (readsError) throw readsError;

      const { data: referencesData, error: referencesError } = messageIds.length
        ? await supabase
            .from('chat_message_references')
            .select(
              'id, message_id, conversation_id, company_id, reference_type, entity_id, entity_label, entity_status, client_name, created_at'
            )
            .eq('conversation_id', conversationId)
            .in('message_id', messageIds)
        : { data: [], error: null };

      if (referencesError) throw referencesError;

      const readsByMessageId = new Map<string, any[]>();
      ((readsData as any[]) || []).forEach((read) => {
        const currentReads = readsByMessageId.get(read.message_id) || [];
        currentReads.push(read);
        readsByMessageId.set(read.message_id, currentReads);
      });

      const referencesByMessageId = new Map<string, any[]>();
      ((referencesData as any[]) || []).forEach((reference) => {
        const currentReferences = referencesByMessageId.get(reference.message_id) || [];
        currentReferences.push(reference);
        referencesByMessageId.set(reference.message_id, currentReferences);
      });

      const mapped = ((data as any[]) || []).map((row) =>
        normalizeChatMessage({
          ...row,
          reads: readsByMessageId.get(row.id) || [],
          references: referencesByMessageId.get(row.id) || [],
        })
      );
      setMessages(dedupeMessages(mapped));
      return mapped;
    } catch (err) {
      console.error('Error cargando mensajes del chat:', err);
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los mensajes');
      return [];
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  const sendMessage = useCallback(
    async (body: string, references: ChatMessageReferenceInput[] = []) => {
      if (!conversationId || !profile) return null;

      const trimmedBody = body.trim();
      if (!trimmedBody) return null;

      setSending(true);
      setError(null);

      const optimisticId = `optimistic-${Date.now()}`;
      const optimisticMessage: ChatMessageWithMeta = {
        id: optimisticId,
        conversation_id: conversationId,
        company_id: profile.company_id || '',
        sender_profile_id: profile.id,
        body: trimmedBody,
        message_type: 'text',
        created_at: new Date().toISOString(),
        updated_at: null,
        edited_at: null,
        sender: {
          id: profile.id,
          full_name: profile.full_name,
          email: profile.email,
          avatar_url: profile.avatar_url,
        },
        reads: [],
        references: references.map((reference, index) => ({
          id: `optimistic-reference-${index}-${reference.entity_id}`,
          message_id: optimisticId,
          conversation_id: conversationId,
          company_id: profile.company_id || '',
          reference_type: reference.reference_type,
          entity_id: reference.entity_id,
          entity_label: reference.entity_label,
          entity_status: reference.entity_status ?? null,
          client_name: reference.client_name ?? null,
          created_at: new Date().toISOString(),
        })),
        optimistic: true,
      };

      setMessages((current) => dedupeMessages([...current, optimisticMessage]));

      try {
        const { data, error: rpcError } = await (supabase.rpc as any)('send_chat_message', {
          p_conversation_id: conversationId,
          p_body: trimmedBody,
          p_references: references,
        });

        if (rpcError) throw rpcError;

        const confirmedMessage: ChatMessageWithMeta = {
          id: (data as any).id,
          conversation_id: (data as any).conversation_id,
          company_id: (data as any).company_id,
          sender_profile_id: (data as any).sender_profile_id,
          body: (data as any).body,
          message_type: (data as any).message_type,
          created_at: (data as any).created_at,
          updated_at: (data as any).updated_at ?? null,
          edited_at: (data as any).edited_at ?? null,
          sender: {
            id: profile.id,
            full_name: profile.full_name,
            email: profile.email,
            avatar_url: profile.avatar_url,
          },
          reads: [],
          references: references.map((reference, index) => ({
            id: `confirmed-reference-${index}-${reference.entity_id}`,
            message_id: (data as any).id,
            conversation_id: (data as any).conversation_id,
            company_id: (data as any).company_id,
            reference_type: reference.reference_type,
            entity_id: reference.entity_id,
            entity_label: reference.entity_label,
            entity_status: reference.entity_status ?? null,
            client_name: reference.client_name ?? null,
            created_at: (data as any).created_at,
          })),
        };

        setMessages((current) =>
          dedupeMessages(current.map((message) => (message.id === optimisticId ? confirmedMessage : message)))
        );

        return confirmedMessage;
      } catch (err) {
        console.error('Error enviando mensaje:', err);
        setMessages((current) => current.filter((message) => message.id !== optimisticId));
        setError(err instanceof Error ? err.message : 'No se pudo enviar el mensaje');
        throw err;
      } finally {
        setSending(false);
      }
    },
    [conversationId, profile]
  );

  const markAsRead = useCallback(
    async (throughMessageId?: string | null) => {
      if (!conversationId || !profile) return false;

      const effectiveTargetId = throughMessageId || messages[messages.length - 1]?.id;
      if (!effectiveTargetId) return false;

      try {
        const { error: rpcError } = await (supabase.rpc as any)('mark_conversation_read', {
          p_conversation_id: conversationId,
          p_through_message_id: effectiveTargetId,
        });

        if (rpcError) throw rpcError;

        const targetMessage = messages.find((message) => message.id === effectiveTargetId);
        if (!targetMessage) return true;

        setMessages((current) =>
          current.map((message) => {
            if (new Date(message.created_at).getTime() > new Date(targetMessage.created_at).getTime()) {
              return message;
            }

            if (message.reads.some((read) => read.reader_profile_id === profile.id)) {
              return message;
            }

            return {
              ...message,
              reads: [
                ...message.reads,
                {
                  id: `optimistic-read-${message.id}-${profile.id}`,
                  message_id: message.id,
                  conversation_id: message.conversation_id,
                  company_id: message.company_id,
                  reader_profile_id: profile.id,
                  read_at: new Date().toISOString(),
                  created_at: new Date().toISOString(),
                },
              ],
            };
          })
        );
        return true;
      } catch (err) {
        console.error('Error marcando conversación como leída:', err);
        setError(err instanceof Error ? err.message : 'No se pudo marcar la conversación como leída');
        return false;
      }
    },
    [conversationId, messages, profile]
  );

  useEffect(() => {
    if (!conversationId) {
      setMessages([]);
      return;
    }

    let isMounted = true;

    const setupRealtime = async () => {
      await fetchMessages();
      if (!isMounted || !profile?.company_id) return;

      const channel = supabase
        .channel(`chat-messages-${conversationId}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `conversation_id=eq.${conversationId}` },
          async (payload) => {
            const insertedMessageId = (payload.new as { id: string }).id;
            const incomingMessage = await fetchMessageById(insertedMessageId);
            if (!incomingMessage) return;

            setMessages((current) => dedupeMessages([...current, incomingMessage]));
          }
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'chat_messages', filter: `conversation_id=eq.${conversationId}` },
          async (payload) => {
            const updatedMessageId = (payload.new as { id: string }).id;
            const updatedMessage = await fetchMessageById(updatedMessageId);
            if (!updatedMessage) return;

            setMessages((current) =>
              dedupeMessages(current.map((message) => (message.id === updatedMessage.id ? updatedMessage : message)))
            );
          }
        )
        .on(
          'postgres_changes',
          { event: 'DELETE', schema: 'public', table: 'chat_messages', filter: `conversation_id=eq.${conversationId}` },
          (payload) => {
            const deletedMessageId = (payload.old as { id: string }).id;
            setMessages((current) => current.filter((message) => message.id !== deletedMessageId));
          }
        )
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'chat_message_reads', filter: `conversation_id=eq.${conversationId}` },
          (payload) => {
            const read = payload.new as {
              id: string;
              message_id: string;
              conversation_id: string;
              company_id: string;
              reader_profile_id: string;
              read_at: string;
              created_at: string;
            };

            setMessages((current) =>
              current.map((message) => {
                if (message.id !== read.message_id) return message;
                if (message.reads.some((existingRead) => existingRead.id === read.id)) return message;

                return {
                  ...message,
                  reads: [...message.reads, read],
                };
              })
            );
          }
        )
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'chat_message_references', filter: `conversation_id=eq.${conversationId}` },
          (payload) => {
            const reference = payload.new as {
              id: string;
              message_id: string;
              conversation_id: string;
              company_id: string;
              reference_type: 'orden_trabajo' | 'orden_copiado';
              entity_id: string;
              entity_label: string;
              entity_status: string | null;
              client_name: string | null;
              created_at: string;
            };

            setMessages((current) =>
              current.map((message) => {
                if (message.id !== reference.message_id) return message;
                if (message.references.some((existingReference) => existingReference.id === reference.id)) return message;

                return {
                  ...message,
                  references: [...message.references, reference],
                };
              })
            );
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'chat_message_reads', filter: `conversation_id=eq.${conversationId}` },
          () => {
            if (!isMounted) return;
            if (document.visibilityState === 'visible') return;
            void fetchMessages();
          }
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'chat_message_references', filter: `conversation_id=eq.${conversationId}` },
          () => {
            if (!isMounted) return;
            void fetchMessages();
          }
        )
        .on(
          'postgres_changes',
          { event: 'DELETE', schema: 'public', table: 'chat_message_references', filter: `conversation_id=eq.${conversationId}` },
          () => {
            if (!isMounted) return;
            void fetchMessages();
          }
        )
        .subscribe();

      channelRef.current = channel;
    };

    void setupRealtime();

    return () => {
      isMounted = false;
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [conversationId, fetchMessageById, fetchMessages, profile?.company_id]);

  return {
    messages,
    loading,
    sending,
    error,
    fetchMessages,
    sendMessage,
    markAsRead,
  };
}
