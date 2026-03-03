import { Hash, MessageCircle } from 'lucide-react';
import { Avatar } from '../ui/Avatar';
import type { ChatConversationListItem } from '../../types/chat';
import {
  formatChatTime,
  getConversationPreview,
  getConversationSubtitle,
} from '../../utils/chat';

interface ChatConversationItemProps {
  conversation: ChatConversationListItem;
  isSelected: boolean;
  currentUserId?: string | null;
  isOtherUserOnline?: boolean;
  onSelect: (conversationId: string) => void;
}

export function ChatConversationItem({
  conversation,
  isSelected,
  currentUserId,
  isOtherUserOnline = false,
  onSelect,
}: ChatConversationItemProps) {
  const isGeneral = conversation.type === 'general';

  return (
    <button
      type="button"
      onClick={() => onSelect(conversation.conversation_id)}
      className={`w-full rounded-2xl border p-3 text-left transition-all ${
        isSelected
          ? 'border-sky-200 bg-sky-50 shadow-sm'
          : 'border-transparent bg-white hover:border-slate-200 hover:bg-slate-50'
      }`}
    >
      <div className="flex items-start gap-3">
        {isGeneral ? (
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900 text-white">
            <Hash className="h-4 w-4" />
          </div>
        ) : (
          <Avatar
            size="md"
            src={conversation.other_profile_avatar_url}
            name={conversation.other_profile_name || conversation.other_profile_email || 'Usuario'}
            showPresence
            isOnline={isOtherUserOnline}
          />
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-semibold text-slate-900">{conversation.title}</p>
                {isGeneral && (
                  <span className="inline-flex items-center rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-700">
                    General
                  </span>
                )}
              </div>
              <p className="mt-0.5 truncate text-xs text-slate-500">{getConversationSubtitle(conversation)}</p>
            </div>
            <span className="flex-shrink-0 text-[11px] font-medium text-slate-400">
              {formatChatTime(conversation.last_message_created_at || conversation.created_at)}
            </span>
          </div>

          <div className="mt-2 flex items-center gap-2">
            <p className="line-clamp-2 flex-1 text-xs leading-5 text-slate-600">
              {getConversationPreview(conversation, currentUserId)}
            </p>
            {conversation.unread_count > 0 && (
              <span className="inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 text-[11px] font-bold text-white">
                {conversation.unread_count > 99 ? '99+' : conversation.unread_count}
              </span>
            )}
            {conversation.unread_count === 0 && !isGeneral && (
              <MessageCircle className="h-4 w-4 flex-shrink-0 text-slate-300" />
            )}
          </div>
        </div>
      </div>
    </button>
  );
}
