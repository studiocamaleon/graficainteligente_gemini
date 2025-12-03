import { useState } from 'react';
import { CheckCircle2, X, Loader2, MessageSquare, Mail } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { useClienteAprobacion } from '../../hooks/useClienteAprobacion';

interface Cliente {
  id: string;
  nombre_fantasia: string;
  razon_social: string;
  numero_documento: string;
  whatsapp: string;
  email?: string;
}

interface AprobarClienteModalProps {
  isOpen: boolean;
  onClose: () => void;
  cliente: Cliente;
  onSuccess: () => void;
}

export function AprobarClienteModal({
  isOpen,
  onClose,
  cliente,
  onSuccess,
}: AprobarClienteModalProps) {
  const [enviarNotificacion, setEnviarNotificacion] = useState(true);
  const { aprobarCliente, loading } = useClienteAprobacion();

  const handleAprobar = async () => {
    const result = await aprobarCliente({
      clienteId: cliente.id,
      enviarNotificacion,
    });

    if (result.success) {
      onSuccess();
      onClose();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Aprobar Cliente">
      <div className="space-y-6">
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-6 w-6 text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold text-green-900 mb-1">
                Confirmar Aprobación
              </h4>
              <p className="text-sm text-green-700">
                Estás por aprobar a este cliente. Una vez aprobado, podrá realizar
                pedidos en tu sistema.
              </p>
            </div>
          </div>
        </div>

        <div className="bg-gray-50 rounded-xl p-4 space-y-3">
          <h4 className="font-semibold text-gray-900">Datos del Cliente</h4>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-500 mb-1">Nombre Comercial</p>
              <p className="font-medium text-gray-900">{cliente.nombre_fantasia}</p>
            </div>
            <div>
              <p className="text-gray-500 mb-1">Razón Social</p>
              <p className="font-medium text-gray-900">{cliente.razon_social}</p>
            </div>
            <div>
              <p className="text-gray-500 mb-1">Documento</p>
              <p className="font-medium text-gray-900">{cliente.numero_documento}</p>
            </div>
            <div>
              <p className="text-gray-500 mb-1">WhatsApp</p>
              <p className="font-medium text-gray-900">{cliente.whatsapp}</p>
            </div>
            {cliente.email && (
              <div className="col-span-2">
                <p className="text-gray-500 mb-1">Email</p>
                <p className="font-medium text-gray-900">{cliente.email}</p>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <h4 className="font-semibold text-gray-900">Notificaciones</h4>

          <label className="flex items-start gap-3 p-4 bg-blue-50 border-2 border-blue-200 rounded-xl cursor-pointer hover:bg-blue-100 transition-colors">
            <input
              type="checkbox"
              checked={enviarNotificacion}
              onChange={(e) => setEnviarNotificacion(e.target.checked)}
              className="mt-0.5"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <MessageSquare className="h-4 w-4 text-blue-600" />
                <span className="font-medium text-blue-900">
                  Enviar notificación por WhatsApp
                </span>
              </div>
              <p className="text-sm text-blue-700">
                El cliente recibirá un mensaje confirmando su aprobación
              </p>
            </div>
          </label>

          {cliente.email && (
            <div className="flex items-start gap-3 p-4 bg-gray-100 border-2 border-gray-200 rounded-xl opacity-60">
              <Mail className="h-4 w-4 text-gray-400 mt-0.5" />
              <div className="flex-1">
                <span className="text-sm font-medium text-gray-600">
                  Notificación por Email (próximamente)
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-3 pt-4">
          <Button
            variant="outline"
            onClick={onClose}
            className="flex-1"
            disabled={loading}
          >
            <X className="h-4 w-4 mr-2" />
            Cancelar
          </Button>
          <Button
            onClick={handleAprobar}
            disabled={loading}
            className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Aprobando...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Aprobar Cliente
              </>
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
