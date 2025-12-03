import { X, Building2, FileText, Phone, Mail, MapPin, Calendar, Globe } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { ClienteStatusBadge } from './ClienteStatusBadge';

interface Cliente {
  id: string;
  nombre_fantasia: string;
  razon_social: string;
  tipo_documento: string;
  numero_documento: string;
  whatsapp: string;
  email?: string;
  domicilio?: string;
  status_aprobacion: 'pending' | 'approved' | 'rejected';
  fecha_registro?: string;
  ip_registro?: string;
}

interface DetalleClienteModalProps {
  isOpen: boolean;
  onClose: () => void;
  cliente: Cliente | null;
}

export function DetalleClienteModal({
  isOpen,
  onClose,
  cliente,
}: DetalleClienteModalProps) {
  if (!cliente) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Detalles del Cliente">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold text-gray-900">
            {cliente.nombre_fantasia}
          </h3>
          <ClienteStatusBadge status={cliente.status_aprobacion} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <InfoField
            icon={Building2}
            label="Nombre Comercial"
            value={cliente.nombre_fantasia}
          />

          <InfoField
            icon={FileText}
            label="Razón Social"
            value={cliente.razon_social}
          />

          <InfoField
            icon={FileText}
            label="Tipo de Documento"
            value={cliente.tipo_documento}
          />

          <InfoField
            icon={FileText}
            label="Número de Documento"
            value={cliente.numero_documento}
          />

          <InfoField
            icon={Phone}
            label="WhatsApp"
            value={cliente.whatsapp}
          />

          {cliente.email && (
            <InfoField
              icon={Mail}
              label="Email"
              value={cliente.email}
            />
          )}

          {cliente.domicilio && (
            <InfoField
              icon={MapPin}
              label="Domicilio"
              value={cliente.domicilio}
              className="md:col-span-2"
            />
          )}

          {cliente.fecha_registro && (
            <InfoField
              icon={Calendar}
              label="Fecha de Registro"
              value={new Date(cliente.fecha_registro).toLocaleDateString('es-AR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            />
          )}

          {cliente.ip_registro && (
            <InfoField
              icon={Globe}
              label="IP de Registro"
              value={cliente.ip_registro}
            />
          )}
        </div>

        <div className="flex justify-end pt-4">
          <Button variant="outline" onClick={onClose}>
            <X className="h-4 w-4 mr-2" />
            Cerrar
          </Button>
        </div>
      </div>
    </Modal>
  );
}

interface InfoFieldProps {
  icon: React.ElementType;
  label: string;
  value: string;
  className?: string;
}

function InfoField({ icon: Icon, label, value, className = '' }: InfoFieldProps) {
  return (
    <div className={`${className}`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className="h-4 w-4 text-gray-400" />
        <span className="text-sm text-gray-500">{label}</span>
      </div>
      <p className="text-base font-medium text-gray-900 pl-6">{value}</p>
    </div>
  );
}
