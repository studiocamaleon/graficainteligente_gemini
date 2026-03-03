import { ArrowLeft, Expand, Hash, Loader2, MessageSquarePlus } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useChatConversations } from '../../hooks/useChatConversations';
import { useChatMessages } from '../../hooks/useChatMessages';
import { useChatPresence } from '../../hooks/useChatPresence';
import type { Profile } from '../../types/database';
import { Button } from '../ui/Button';
import { Avatar } from '../ui/Avatar';
import { ChatEmptyState } from './ChatEmptyState';
import { ChatConversationList } from './ChatConversationList';
import { ChatRecipientPicker } from './ChatRecipientPicker';
import { ChatMessageList } from './ChatMessageList';
import { ChatComposer } from './ChatComposer';

interface ChatWorkspaceProps {
  compact?: boolean;
  initialConversationId?: string | null;
  onConversationChange?: (conversationId: string | null) => void;
  onOpenFullPage?: (conversationId: string | null) => void;
  onCloseCompact?: () => void;
}

export function ChatWorkspace({
  compact = false,
  initialConversationId = null,
  onConversationChange,
  onOpenFullPage,
  onCloseCompact,
}: ChatWorkspaceProps) {
  const { profile } = useAuth();
  const { isProfileOnline } = useChatPresence();
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(initialConversationId);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const lastReadSyncRef = useRef<string | null>(null);
  const {
    conversations,
    loading: conversationsLoading,
    error: conversationsError,
    fetchConversations,
    ensureDirectConversation,
    markConversationAsRead,
  } = useChatConversations();

  useEffect(() => {
    setSelectedConversationId((current) => current ?? initialConversationId ?? null);
  }, [initialConversationId]);

  useEffect(() => {
    if (conversations.length === 0) return;

    const hasSelectedConversation = conversations.some(
      (conversation) => conversation.conversation_id === selectedConversationId
    );

    if (!selectedConversationId || !hasSelectedConversation) {
      const firstConversationId = conversations[0].conversation_id;
      setSelectedConversationId(firstConversationId);
      onConversationChange?.(firstConversationId);
    }
  }, [conversations, onConversationChange, selectedConversationId]);

  const activeConversation = useMemo(
    () =>
      conversations.find((conversation) => conversation.conversation_id === selectedConversationId) || null,
    [conversations, selectedConversationId]
  );

  const {
    messages,
    loading: messagesLoading,
    sending,
    error: messagesError,
    sendMessage,
    markAsRead,
  } = useChatMessages({
    conversationId: activeConversation?.conversation_id || null,
  });

  useEffect(() => {
    if (!activeConversation || !profile?.id || messages.length === 0) return;

    const lastMessage = messages[messages.length - 1];
    if (lastMessage.sender_profile_id === profile.id) return;

    const readSyncKey = `${activeConversation.conversation_id}:${lastMessage.id}`;
    if (lastReadSyncRef.current === readSyncKey) return;

    lastReadSyncRef.current = readSyncKey;

    const syncReadState = async () => {
      const wasMarkedAsRead = await markAsRead(lastMessage.id);
      if (!wasMarkedAsRead) {
        lastReadSyncRef.current = null;
        return;
      }

      markConversationAsRead(activeConversation.conversation_id);
      await fetchConversations();
    };

    void syncReadState();
  }, [activeConversation, fetchConversations, markAsRead, messages, profile?.id]);

  const handleSelectConversation = (conversationId: string) => {
    setSelectedConversationId(conversationId);
    onConversationChange?.(conversationId);
  };

  const handleCreateDirectConversation = async (member: Profile) => {
    const conversationId = await ensureDirectConversation(member.id);
    handleSelectConversation(conversationId);
    setIsPickerOpen(false);
  };

  const title = activeConversation?.title || 'Chat interno';
  const subtitle =
    activeConversation?.type === 'general'
      ? 'Mensajes para todo el equipo'
      : activeConversation?.other_profile_email || 'Conversación directa';

  const showListOnMobile = !selectedConversationId;
  const showThreadOnMobile = !!selectedConversationId;

  return (
    <>
      <div className={`grid h-full min-h-0 gap-4 ${compact ? 'xl:grid-cols-[300px_minmax(0,1fr)]' : 'lg:grid-cols-[320px_minmax(0,1fr)]'}`}>
        <div className={`${showListOnMobile ? 'flex' : 'hidden'} min-h-0 flex-col lg:flex`}>
          <ChatConversationList
            conversations={conversations}
            loading={conversationsLoading}
            error={conversationsError}
            selectedConversationId={selectedConversationId}
            currentUserId={profile?.id}
            isProfileOnline={isProfileOnline}
            onSelect={handleSelectConversation}
            onCreateDirectConversation={() => setIsPickerOpen(true)}
          />
        </div>

        <div className={`${showThreadOnMobile ? 'flex' : 'hidden'} min-h-0 flex-col lg:flex`}>
          {activeConversation ? (
            <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-slate-50">
              <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-4">
                <div className="flex min-w-0 items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedConversationId(null);
                      onConversationChange?.(null);
                    }}
                    className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 lg:hidden"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>

                  {activeConversation.type === 'general' ? (
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-white">
                      <Hash className="h-4 w-4" />
                    </div>
                  ) : (
                    <Avatar
                      size="md"
                      src={activeConversation.other_profile_avatar_url}
                      name={activeConversation.other_profile_name || activeConversation.other_profile_email || 'Usuario'}
                      showPresence
                      isOnline={isProfileOnline(activeConversation.other_profile_id)}
                    />
                  )}

                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">{title}</p>
                    <p className="truncate text-xs text-slate-500">{subtitle}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {compact && onOpenFullPage && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onOpenFullPage(activeConversation.conversation_id)}
                      className="rounded-xl px-3"
                    >
                      <Expand className="h-4 w-4" />
                      <span className="hidden sm:inline">Abrir</span>
                    </Button>
                  )}
                  {compact && onCloseCompact && (
                    <Button variant="ghost" size="sm" onClick={onCloseCompact} className="rounded-xl px-3 lg:hidden">
                      Cerrar
                    </Button>
                  )}
                </div>
              </div>

              {messagesError && (
                <div className="border-b border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{messagesError}</div>
              )}

              {messagesLoading && messages.length === 0 ? (
                <div className="flex flex-1 items-center justify-center text-sm text-slate-500">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Cargando mensajes...
                </div>
              ) : messages.length > 0 ? (
                <ChatMessageList
                  messages={messages}
                  activeConversation={activeConversation}
                  currentUserId={profile?.id || ''}
                  isProfileOnline={isProfileOnline}
                />
              ) : (
                <div className="flex-1 p-4">
                  <ChatEmptyState
                    title="Todavía no hay mensajes"
                    description="Este hilo está listo. Escribí el primer mensaje para empezar la conversación."
                  />
                </div>
              )}

              <ChatComposer
                disabled={!activeConversation || sending}
                onSend={async (body, references) => {
                  await sendMessage(body, references);
                  await fetchConversations();
                }}
              />
            </div>
          ) : (
            <ChatEmptyState
              title="Seleccioná una conversación"
              description="Abrí el canal general o empezá un chat directo con alguien de tu equipo."
            />
          )}
        </div>
      </div>

      {!compact && (
        <div className="mt-6 flex justify-end">
          <Button variant="outline" onClick={() => setIsPickerOpen(true)} className="rounded-2xl">
            <MessageSquarePlus className="h-4 w-4" />
            Nuevo chat directo
          </Button>
        </div>
      )}

      <ChatRecipientPicker
        isOpen={isPickerOpen}
        onClose={() => setIsPickerOpen(false)}
        onSelect={handleCreateDirectConversation}
        isProfileOnline={isProfileOnline}
      />
    </>
  );
}
