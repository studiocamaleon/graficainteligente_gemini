import { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Info, Trash2, Power, X } from 'lucide-react';
import { Button } from './Button';

export type ConfirmDialogVariant = 'danger' | 'warning' | 'info';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  message: string | ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: ConfirmDialogVariant;
  isLoading?: boolean;
  icon?: ReactNode;
}

const variantStyles = {
  danger: {
    iconBg: 'bg-red-100',
    iconColor: 'text-red-600',
    buttonVariant: 'danger' as const,
    defaultIcon: <Trash2 className="w-6 h-6" />,
  },
  warning: {
    iconBg: 'bg-yellow-100',
    iconColor: 'text-yellow-600',
    buttonVariant: 'primary' as const,
    defaultIcon: <AlertTriangle className="w-6 h-6" />,
  },
  info: {
    iconBg: 'bg-blue-100',
    iconColor: 'text-blue-600',
    buttonVariant: 'primary' as const,
    defaultIcon: <Info className="w-6 h-6" />,
  },
};

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  variant = 'danger',
  isLoading = false,
  icon,
}: ConfirmDialogProps) {
  const styles = variantStyles[variant];
  const displayIcon = icon || styles.defaultIcon;

  const handleConfirm = async () => {
    await onConfirm();
  };

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
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                transition={{ type: 'spring', duration: 0.3 }}
                className="relative bg-white rounded-xl shadow-2xl w-full max-w-md"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-6">
                  <div className="flex items-start gap-4">
                    <div className={`flex-shrink-0 rounded-full p-3 ${styles.iconBg}`}>
                      <div className={styles.iconColor}>{displayIcon}</div>
                    </div>

                    <div className="flex-1 pt-1">
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">
                        {title}
                      </h3>
                      <div className="text-sm text-gray-600 whitespace-pre-line">
                        {message}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="px-6 pb-6 flex items-center justify-end gap-3">
                  <Button
                    variant="secondary"
                    onClick={onClose}
                    disabled={isLoading}
                  >
                    {cancelText}
                  </Button>
                  <Button
                    variant={styles.buttonVariant}
                    onClick={handleConfirm}
                    isLoading={isLoading}
                    disabled={isLoading}
                  >
                    {confirmText}
                  </Button>
                </div>
              </motion.div>
            </div>
          </div>
        </>
      )}
    </AnimatePresence>
  );

  return createPortal(modalContent, document.body);
}
