import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useChatPanelState } from '../../hooks/useChatPanelState';
import { ChatWorkspace } from './ChatWorkspace';

export function ChatPanel() {
  const navigate = useNavigate();
  const { isOpen, closePanel, selectedConversationId, setSelectedConversationId } = useChatPanelState();

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closePanel}
            className="fixed inset-0 z-[80] bg-slate-950/30 backdrop-blur-[2px] lg:bg-transparent"
          />
          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 18, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-[90] p-0 lg:inset-auto lg:bottom-24 lg:right-6 lg:h-[70vh] lg:max-h-[760px] lg:w-[min(980px,calc(100vw-3rem))] lg:p-0"
          >
            <div className="h-full w-full rounded-none border border-slate-200 bg-white p-4 shadow-2xl lg:rounded-[32px]">
              <ChatWorkspace
                compact
                initialConversationId={selectedConversationId}
                onConversationChange={setSelectedConversationId}
                onCloseCompact={closePanel}
                onOpenFullPage={(conversationId) => {
                  closePanel();
                  navigate(conversationId ? `/app/chat?conversation=${conversationId}` : '/app/chat');
                }}
              />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}
