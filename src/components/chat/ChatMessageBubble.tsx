import { Check, CheckCheck, Clock } from 'lucide-react';
import { Avatar } from '../ui/Avatar';
import type { ChatConversationType, ChatMessageWithMeta } from '../../types/chat';
import { formatChatTime, getMessageStatus } from '../../utils/chat';
import { ChatMessageReferences } from './ChatMessageReferences';

interface ChatMessageBubbleProps {
  message: ChatMessageWithMeta;
  currentUserId: string;
  conversationType: ChatConversationType;
  otherProfileId?: string | null;
  isSenderOnline?: boolean;
  showSender: boolean;
}

export function ChatMessageBubble({
  message,
  currentUserId,
  conversationType,
  otherProfileId,
  isSenderOnline = false,
  showSender,
}: ChatMessageBubbleProps) {
  const isOwn = message.sender_profile_id === currentUserId;
  const status = getMessageStatus(message, currentUserId, otherProfileId);

  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex max-w-[85%] items-end gap-2 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
        {!isOwn && conversationType === 'general' ? (
          <Avatar
            size="sm"
            src={message.sender?.avatar_url}
            name={message.sender?.full_name || message.sender?.email || 'Usuario'}
            showPresence
            isOnline={isSenderOnline}
          />
        ) : (
          <div className="h-8 w-8 flex-shrink-0" />
        )}

        <div className={`space-y-1 ${isOwn ? 'items-end' : 'items-start'}`}>
          {showSender && !isOwn && conversationType === 'general' && (
            <p className="pl-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
              {message.sender?.full_name || message.sender?.email || 'Usuario'}
            </p>
          )}

          <div
            className={`rounded-3xl px-4 py-3 shadow-sm ${
              isOwn ? 'bg-sky-600 text-white' : 'border border-slate-200 bg-white text-slate-800'
            }`}
          >
            <ChatMessageReferences references={message.references} isOwn={isOwn} />
            <p className="whitespace-pre-wrap break-words text-sm leading-6">{message.body}</p>
          </div>

          <div className={`flex items-center gap-1.5 px-1 text-[11px] ${isOwn ? 'justify-end text-slate-400' : 'text-slate-400'}`}>
            <span>{formatChatTime(message.created_at)}</span>
            {isOwn && conversationType === 'direct' && (
              <>
                {status === 'sending' && <Clock className="h-3.5 w-3.5" />}
                {status === 'sent' && <Check className="h-3.5 w-3.5" />}
                {status === 'read' && <CheckCheck className="h-3.5 w-3.5 text-emerald-500" />}
                <span>
                  {status === 'sending' ? 'Enviando...' : status === 'read' ? 'Leído' : 'Enviado'}
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
