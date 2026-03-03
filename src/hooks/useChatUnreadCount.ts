import { useMemo } from 'react';
import { useChatConversations } from './useChatConversations';

export function useChatUnreadCount() {
  const { conversations, loading, error, unreadCount } = useChatConversations();

  const directUnreadCount = useMemo(
    () => conversations.filter((conversation) => conversation.type === 'direct').reduce((sum, item) => sum + item.unread_count, 0),
    [conversations]
  );

  return {
    unreadCount,
    directUnreadCount,
    loading,
    error,
  };
}
