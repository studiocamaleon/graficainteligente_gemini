import { ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Clock, CheckCircle2 } from 'lucide-react';
import { Button } from './Button';

interface ComingSoonModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children?: ReactNode;
}

export function ComingSoonModal({
  isOpen,
  onClose,
  title = 'Sistema en Fase de Pruebas',
  description = 'Actualmente estamos realizando pruebas internas para asegurar la mejor experiencia posible. El registro de nuevos clientes estará disponible próximamente.',
  children,
}: ComingSoonModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9998]"
          />

          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: 'spring', duration: 0.4 }}
              className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={onClose}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors p-2 hover:bg-gray-100 rounded-lg z-10"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="p-8 text-center">
                <div className="w-20 h-20 bg-gradient-to-br from-blue-100 to-cyan-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Clock className="w-10 h-10 text-blue-600" />
                </div>

                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                  {title}
                </h2>

                <p className="text-gray-600 leading-relaxed mb-8">
                  {description}
                </p>

                {children || (
                  <div className="space-y-3 mb-8">
                    <div className="flex items-start gap-3 text-left">
                      <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-gray-700">
                        Estamos optimizando cada detalle del sistema
                      </p>
                    </div>
                    <div className="flex items-start gap-3 text-left">
                      <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-gray-700">
                        Garantizando la mejor experiencia para nuestros futuros clientes
                      </p>
                    </div>
                    <div className="flex items-start gap-3 text-left">
                      <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-gray-700">
                        El lanzamiento público será muy pronto
                      </p>
                    </div>
                  </div>
                )}

                <Button
                  onClick={onClose}
                  variant="primary"
                  className="w-full"
                >
                  Volver al Inicio
                </Button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
