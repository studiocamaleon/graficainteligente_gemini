import { ReactNode, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  showCloseButton?: boolean;
  showHeader?: boolean;
  sidePanel?: ReactNode;
  isSidePanelOpen?: boolean;
  footer?: ReactNode;
}

const sizeStyles = {
  sm: 'max-w-md',
  md: 'max-w-2xl',
  lg: 'max-w-4xl',
  xl: 'max-w-6xl',
  full: 'max-w-7xl',
};

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  showCloseButton = true,
  showHeader = true,
  sidePanel,
  isSidePanelOpen = false,
  footer
}: ModalProps) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const modalContent = (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed top-0 left-0 right-0 bottom-0 w-screen h-screen bg-black/50 backdrop-blur-sm z-[9998]"
          />

          <div className="fixed top-0 left-0 right-0 bottom-0 w-screen h-screen z-[9999] overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <div className="flex gap-0 items-stretch max-w-full">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 20 }}
                  transition={{ type: 'spring', duration: 0.3 }}
                  className={`
                    relative bg-white rounded-xl shadow-2xl w-full ${sizeStyles[size]}
                    max-h-[85vh] flex flex-col z-[10001]
                    ${isSidePanelOpen ? 'rounded-r-none border-r border-gray-100' : ''}
                  `}
                  onClick={(e) => e.stopPropagation()}
                >
                  {showHeader && (
                    <div className="flex items-center justify-between p-6 border-b border-gray-200">
                      <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
                      {showCloseButton && (
                        <button
                          onClick={onClose}
                          className="text-gray-400 hover:text-gray-600 transition-colors p-1 hover:bg-gray-100 rounded-lg"
                        >
                          <X className="w-6 h-6" />
                        </button>
                      )}
                    </div>
                  )}

                  <div className="flex-1 overflow-y-auto p-6">
                    {children}
                  </div>
                  {footer && (
                    <div className="border-t border-gray-200 p-6 bg-gray-50 rounded-b-xl">
                      {footer}
                    </div>
                  )}
                </motion.div>

                {/* Side Panel */}
                <AnimatePresence>
                  {isSidePanelOpen && sidePanel && (
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                      className="bg-white border-l border-gray-200 shadow-2xl rounded-r-xl w-[550px] max-h-[85vh] flex flex-col overflow-hidden z-[10000]"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex-1 overflow-y-auto">
                        {sidePanel}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </>
      )}
    </AnimatePresence>
  );

  return createPortal(modalContent, document.body);
}
