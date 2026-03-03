import { Loader2, PenSquare } from 'lucide-react';
import { Button } from '../ui/Button';
import type { ChatConversationListItem } from '../../types/chat';
import { ChatConversationItem } from './ChatConversationItem';

interface ChatConversationListProps {
  conversations: ChatConversationListItem[];
  loading: boolean;
  error: string | null;
  selectedConversationId: string | null;
  currentUserId?: string | null;
  isProfileOnline?: (profileId?: string | null) => boolean;
  onSelect: (conversationId: string) => void;
  onCreateDirectConversation: () => void;
}

export function ChatConversationList({
  conversations,
  loading,
  error,
  selectedConversationId,
  currentUserId,
  isProfileOnline,
  onSelect,
  onCreateDirectConversation,
}: ChatConversationListProps) {
  return (
    <div className="flex h-full min-h-0 flex-col rounded-[28px] border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">Conversaciones</h2>
          <p className="mt-1 text-xs text-slate-400">General y chats directos del tenant</p>
        </div>
        <Button variant="ghost" size="sm" onClick={onCreateDirectConversation} className="rounded-xl px-3">
          <PenSquare className="h-4 w-4" />
          Nuevo
        </Button>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        {loading && conversations.length === 0 && (
          <div className="flex min-h-[180px] items-center justify-center text-sm text-slate-500">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Cargando conversaciones...
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
        )}

        {!loading && conversations.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
            No hay conversaciones disponibles todavía.
          </div>
        )}

        {conversations.map((conversation) => (
          <ChatConversationItem
            key={conversation.conversation_id}
            conversation={conversation}
            currentUserId={currentUserId}
            isOtherUserOnline={isProfileOnline?.(conversation.other_profile_id)}
            isSelected={selectedConversationId === conversation.conversation_id}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  );
}
