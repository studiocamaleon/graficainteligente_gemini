import type { Profile } from './database';

export type ChatConversationType = 'general' | 'direct';
export type ChatMessageType = 'text';
export type ChatMessageStatus = 'sending' | 'sent' | 'read';
export type ChatReferenceType = 'orden_trabajo' | 'orden_copiado';

export interface ChatConversation {
  id: string;
  company_id: string;
  type: ChatConversationType;
  direct_key: string | null;
  title: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  last_message_at: string | null;
  last_message_id: string | null;
  is_active: boolean;
}

export interface ChatConversationParticipant {
  id: string;
  conversation_id: string;
  company_id: string;
  profile_id: string;
  joined_at: string;
  last_read_message_id: string | null;
  last_read_at: string | null;
  last_delivered_at: string | null;
  is_muted: boolean;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  conversation_id: string;
  company_id: string;
  sender_profile_id: string;
  body: string;
  message_type: ChatMessageType;
  created_at: string;
  updated_at: string | null;
  edited_at: string | null;
}

export interface ChatMessageRead {
  id: string;
  message_id: string;
  conversation_id: string;
  company_id: string;
  reader_profile_id: string;
  read_at: string;
  created_at: string;
}

export interface ChatMessageReference {
  id: string;
  message_id: string;
  conversation_id: string;
  company_id: string;
  reference_type: ChatReferenceType;
  entity_id: string;
  entity_label: string;
  entity_status: string | null;
  client_name: string | null;
  created_at: string;
}

export interface ChatMessageReferenceInput {
  reference_type: ChatReferenceType;
  entity_id: string;
  entity_label: string;
  entity_status?: string | null;
  client_name?: string | null;
}

export interface ChatReferenceTarget {
  entity_type: ChatReferenceType;
  entity_id: string;
  entity_label: string;
  entity_status: string | null;
  client_name: string | null;
  href: string;
}

export interface ChatConversationListItem {
  conversation_id: string;
  company_id: string;
  type: ChatConversationType;
  title: string;
  other_profile_id: string | null;
  other_profile_name: string | null;
  other_profile_email: string | null;
  other_profile_avatar_url: string | null;
  last_message_id: string | null;
  last_message_body: string | null;
  last_message_created_at: string | null;
  last_message_sender_id: string | null;
  unread_count: number;
  created_at: string;
  updated_at: string;
  last_message_at: string | null;
}

export interface ChatMessageWithMeta extends ChatMessage {
  sender: Pick<Profile, 'id' | 'full_name' | 'email' | 'avatar_url'> | null;
  reads: ChatMessageRead[];
  references: ChatMessageReference[];
  optimistic?: boolean;
}
