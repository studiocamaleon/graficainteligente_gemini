import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChatWorkspace } from '../../components/chat/ChatWorkspace';
import { usePageHeader } from '../../hooks/usePageHeader';

export function Chat() {
  const [searchParams, setSearchParams] = useSearchParams();
  const conversationId = useMemo(() => searchParams.get('conversation'), [searchParams]);

  usePageHeader('Chat interno');

  return (
    <div className="h-[calc(100vh-72px-3rem)] min-h-0">
      <ChatWorkspace
        initialConversationId={conversationId}
        onConversationChange={(nextConversationId) => {
          const nextParams = new URLSearchParams(searchParams);
          if (nextConversationId) {
            nextParams.set('conversation', nextConversationId);
          } else {
            nextParams.delete('conversation');
          }
          setSearchParams(nextParams, { replace: true });
        }}
      />
    </div>
  );
}
