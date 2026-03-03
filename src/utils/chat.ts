import type {
  ChatConversationListItem,
  ChatMessageRead,
  ChatMessageReference,
  ChatMessageStatus,
  ChatMessageWithMeta,
} from '../types/chat';

export function formatChatTime(dateString: string | null, locale = 'es-AR') {
  if (!dateString) return '';

  const date = new Date(dateString);
  const now = new Date();
  const isSameDay = date.toDateString() === now.toDateString();

  if (isSameDay) {
    return new Intl.DateTimeFormat(locale, {
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  }

  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    return 'Ayer';
  }

  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: '2-digit',
  }).format(date);
}

export function formatChatDateSeparator(dateString: string, locale = 'es-AR') {
  return new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date(dateString));
}

export function isSameChatDay(a: string, b: string) {
  return new Date(a).toDateString() === new Date(b).toDateString();
}

export function getConversationSubtitle(item: ChatConversationListItem) {
  if (item.type === 'general') {
    return 'Mensajes para todo el equipo';
  }

  return item.other_profile_email || 'Chat directo';
}

export function getConversationPreview(item: ChatConversationListItem, currentUserId?: string | null) {
  if (!item.last_message_body) {
    return item.type === 'general' ? 'Canal listo para usar' : 'Sin mensajes todavía';
  }

  if (currentUserId && item.last_message_sender_id === currentUserId) {
    return `Vos: ${item.last_message_body}`;
  }

  return item.last_message_body;
}

export function normalizeChatConversation(row: any): ChatConversationListItem {
  return {
    conversation_id: row.conversation_id,
    company_id: row.company_id,
    type: row.type,
    title: row.title,
    other_profile_id: row.other_profile_id ?? null,
    other_profile_name: row.other_profile_name ?? null,
    other_profile_email: row.other_profile_email ?? null,
    other_profile_avatar_url: row.other_profile_avatar_url ?? null,
    last_message_id: row.last_message_id ?? null,
    last_message_body: row.last_message_body ?? null,
    last_message_created_at: row.last_message_created_at ?? null,
    last_message_sender_id: row.last_message_sender_id ?? null,
    unread_count: Number(row.unread_count ?? 0),
    created_at: row.created_at,
    updated_at: row.updated_at,
    last_message_at: row.last_message_at ?? null,
  };
}

export function dedupeConversations(conversations: ChatConversationListItem[]) {
  const byId = new Map<string, ChatConversationListItem>();

  conversations.forEach((conversation) => {
    const existing = byId.get(conversation.conversation_id);

    if (!existing) {
      byId.set(conversation.conversation_id, conversation);
      return;
    }

    const existingSortDate = existing.last_message_at || existing.updated_at || existing.created_at;
    const nextSortDate = conversation.last_message_at || conversation.updated_at || conversation.created_at;
    const shouldReplace =
      new Date(nextSortDate).getTime() > new Date(existingSortDate).getTime() ||
      conversation.last_message_id === existing.last_message_id ||
      conversation.unread_count !== existing.unread_count;

    if (shouldReplace) {
      byId.set(conversation.conversation_id, {
        ...existing,
        ...conversation,
      });
    }
  });

  return Array.from(byId.values()).sort((a, b) => {
    const aDate = a.last_message_at || a.created_at;
    const bDate = b.last_message_at || b.created_at;
    return new Date(bDate).getTime() - new Date(aDate).getTime();
  });
}

export function normalizeChatReads(reads: any[] | null | undefined): ChatMessageRead[] {
  return (reads || []).map((read) => ({
    id: read.id,
    message_id: read.message_id,
    conversation_id: read.conversation_id,
    company_id: read.company_id,
    reader_profile_id: read.reader_profile_id,
    read_at: read.read_at,
    created_at: read.created_at ?? read.read_at,
  }));
}

export function normalizeChatReferences(references: any[] | null | undefined): ChatMessageReference[] {
  return (references || []).map((reference) => ({
    id: reference.id,
    message_id: reference.message_id,
    conversation_id: reference.conversation_id,
    company_id: reference.company_id,
    reference_type: reference.reference_type,
    entity_id: reference.entity_id,
    entity_label: reference.entity_label,
    entity_status: reference.entity_status ?? null,
    client_name: reference.client_name ?? null,
    created_at: reference.created_at,
  }));
}

export function normalizeChatMessage(row: any): ChatMessageWithMeta {
  return {
    id: row.id,
    conversation_id: row.conversation_id,
    company_id: row.company_id,
    sender_profile_id: row.sender_profile_id,
    body: row.body,
    message_type: row.message_type,
    created_at: row.created_at,
    updated_at: row.updated_at ?? null,
    edited_at: row.edited_at ?? null,
    sender: row.sender
      ? {
          id: row.sender.id,
          full_name: row.sender.full_name,
          email: row.sender.email,
          avatar_url: row.sender.avatar_url,
        }
      : null,
    reads: normalizeChatReads(row.reads),
    references: normalizeChatReferences(row.references),
  };
}

export function dedupeMessages(messages: ChatMessageWithMeta[]) {
  const byId = new Map<string, ChatMessageWithMeta>();

  messages.forEach((message) => {
    const existing = byId.get(message.id);
    if (!existing) {
      byId.set(message.id, message);
      return;
    }

    byId.set(message.id, {
      ...existing,
      ...message,
      reads: message.reads.length > 0 ? message.reads : existing.reads,
      references: message.references.length > 0 ? message.references : existing.references,
      sender: message.sender ?? existing.sender,
      optimistic: message.optimistic ?? existing.optimistic,
    });
  });

  return Array.from(byId.values()).sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
}

export function getMessageStatus(
  message: ChatMessageWithMeta,
  currentUserId: string,
  otherProfileId?: string | null
): ChatMessageStatus {
  if (message.sender_profile_id !== currentUserId) {
    return 'sent';
  }

  if (message.optimistic) {
    return 'sending';
  }

  if (otherProfileId && message.reads.some((read) => read.reader_profile_id === otherProfileId)) {
    return 'read';
  }

  return 'sent';
}
