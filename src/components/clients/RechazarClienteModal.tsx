import { useState } from 'react';
import { XCircle, X, Loader2, MessageSquare, AlertTriangle } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { useClienteAprobacion } from '../../hooks/useClienteAprobacion';

interface Cliente {
  id: string;
  nombre_fantasia: string;
  razon_social: string;
  numero_documento: string;
  whatsapp: string;
}

interface RechazarClienteModalProps {
  isOpen: boolean;
  onClose: () => void;
  cliente: Cliente;
  onSuccess: () => void;
}

export function RechazarClienteModal({
  isOpen,
  onClose,
  cliente,
  onSuccess,
}: RechazarClienteModalProps) {
  const [motivo, setMotivo] = useState('');
  const [enviarNotificacion, setEnviarNotificacion] = useState(true);
  const { rechazarCliente, loading } = useClienteAprobacion();

  const handleRechazar = async () => {
    const result = await rechazarCliente({
      clienteId: cliente.id,
      motivo: motivo.trim() || undefined,
      enviarNotificacion,
    });

    if (result.success) {
      onSuccess();
      onClose();
      setMotivo('');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Rechazar Cliente">
      <div className="space-y-6">
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-6 w-6 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold text-red-900 mb-1">
                Confirmar Rechazo
              </h4>
              <p className="text-sm text-red-700">
                Estás por rechazar la solicitud de este cliente. Esta acción
                puede revertirse más adelante si es necesario.
              </p>
            </div>
          </div>
        </div>

        <div className="bg-gray-50 rounded-xl p-4 space-y-2">
          <h4 className="font-semibold text-gray-900">Cliente</h4>
          <p className="text-sm">
            <span className="text-gray-500">Nombre: </span>
            <span className="font-medium text-gray-900">{cliente.nombre_fantasia}</span>
          </p>
          <p className="text-sm">
            <span className="text-gray-500">Documento: </span>
            <span className="font-medium text-gray-900">{cliente.numero_documento}</span>
          </p>
        </div>

        <div className="space-y-2">
          <label htmlFor="motivo" className="block text-sm font-semibold text-gray-700">
            Motivo del Rechazo (opcional)
          </label>
          <textarea
            id="motivo"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ej: Datos incompletos, empresa no verificada, etc."
            rows={4}
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 resize-none"
          />
          <p className="text-xs text-gray-500">
            Este motivo se enviará al cliente por WhatsApp si activas las notificaciones
          </p>
        </div>

        <label className="flex items-start gap-3 p-4 bg-orange-50 border-2 border-orange-200 rounded-xl cursor-pointer hover:bg-orange-100 transition-colors">
          <input
            type="checkbox"
            checked={enviarNotificacion}
            onChange={(e) => setEnviarNotificacion(e.target.checked)}
            className="mt-0.5"
          />
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <MessageSquare className="h-4 w-4 text-orange-600" />
              <span className="font-medium text-orange-900">
                Enviar notificación por WhatsApp
              </span>
            </div>
            <p className="text-sm text-orange-700">
              El cliente recibirá un mensaje informando el rechazo
              {motivo && ' junto con el motivo especificado'}
            </p>
          </div>
        </label>

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
            onClick={handleRechazar}
            disabled={loading}
            className="flex-1 bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 text-white"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Rechazando...
              </>
            ) : (
              <>
                <XCircle className="h-4 w-4 mr-2" />
                Rechazar Cliente
              </>
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
