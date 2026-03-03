import { useEffect, useMemo, useRef } from 'react';
import type { ChatConversationListItem, ChatMessageWithMeta } from '../../types/chat';
import { formatChatDateSeparator, isSameChatDay } from '../../utils/chat';
import { ChatMessageBubble } from './ChatMessageBubble';

interface ChatMessageListProps {
  messages: ChatMessageWithMeta[];
  activeConversation: ChatConversationListItem;
  currentUserId: string;
  isProfileOnline?: (profileId?: string | null) => boolean;
}

export function ChatMessageList({
  messages,
  activeConversation,
  currentUserId,
  isProfileOnline,
}: ChatMessageListProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    element.scrollTop = element.scrollHeight;
  }, [messages]);

  const conversationType = activeConversation.type;
  const otherProfileId = activeConversation.other_profile_id;

  const items = useMemo(
    () =>
      messages.map((message, index) => {
        const previousMessage = messages[index - 1];
        const showDateSeparator =
          !previousMessage || !isSameChatDay(previousMessage.created_at, message.created_at);
        const showSender =
          conversationType === 'general' &&
          (!previousMessage || previousMessage.sender_profile_id !== message.sender_profile_id);

        return { message, showDateSeparator, showSender };
      }),
    [conversationType, messages]
  );

  return (
    <div ref={containerRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
      {items.map(({ message, showDateSeparator, showSender }) => (
        <div key={message.id} className="space-y-4">
          {showDateSeparator && (
            <div className="flex justify-center">
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold capitalize tracking-wide text-slate-500 shadow-sm">
                {formatChatDateSeparator(message.created_at)}
              </span>
            </div>
          )}
          <ChatMessageBubble
            message={message}
            currentUserId={currentUserId}
            conversationType={activeConversation.type}
            otherProfileId={otherProfileId}
            isSenderOnline={isProfileOnline?.(message.sender?.id)}
            showSender={showSender}
          />
        </div>
      ))}
    </div>
  );
}
