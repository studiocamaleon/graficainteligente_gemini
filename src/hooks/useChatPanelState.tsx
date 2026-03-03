import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

interface ChatPanelStateValue {
  isOpen: boolean;
  selectedConversationId: string | null;
  openPanel: (conversationId?: string | null) => void;
  closePanel: () => void;
  togglePanel: () => void;
  setSelectedConversationId: (conversationId: string | null) => void;
}

const ChatPanelStateContext = createContext<ChatPanelStateValue | undefined>(undefined);

export function ChatPanelStateProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);

  const value = useMemo<ChatPanelStateValue>(
    () => ({
      isOpen,
      selectedConversationId,
      openPanel: (conversationId) => {
        if (conversationId !== undefined) {
          setSelectedConversationId(conversationId ?? null);
        }
        setIsOpen(true);
      },
      closePanel: () => setIsOpen(false),
      togglePanel: () => setIsOpen((current) => !current),
      setSelectedConversationId,
    }),
    [isOpen, selectedConversationId]
  );

  return <ChatPanelStateContext.Provider value={value}>{children}</ChatPanelStateContext.Provider>;
}

export function useChatPanelState() {
  const context = useContext(ChatPanelStateContext);

  if (!context) {
    throw new Error('useChatPanelState debe usarse dentro de ChatPanelStateProvider');
  }

  return context;
}
