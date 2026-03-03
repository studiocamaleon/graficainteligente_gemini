import { MessageSquare } from 'lucide-react';
import { motion } from 'framer-motion';
import { useChatPanelState } from '../../hooks/useChatPanelState';
import { useChatUnreadCount } from '../../hooks/useChatUnreadCount';

export function ChatFloatingButton() {
  const { togglePanel, isOpen } = useChatPanelState();
  const { unreadCount } = useChatUnreadCount();

  return (
    <button
      type="button"
      onClick={togglePanel}
      className={`relative inline-flex h-14 w-14 items-center justify-center rounded-full border shadow-xl transition-all ${
        isOpen
          ? 'border-sky-500 bg-sky-600 text-white'
          : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
      }`}
      title="Abrir chat interno"
    >
      <MessageSquare className="h-5 w-5" />
      {unreadCount > 0 && (
        <motion.span
          key={unreadCount}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute -right-1 -top-1 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 text-[11px] font-bold text-white"
        >
          {unreadCount > 99 ? '99+' : unreadCount}
        </motion.span>
      )}
    </button>
  );
}
