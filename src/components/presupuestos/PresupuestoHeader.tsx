import { useState } from 'react';
import {
  Edit2,
  Copy,
  Trash2,
  Send,
  FileText,
  ExternalLink,
  CheckCircle,
  XCircle,
  Clock,
  User,
  Calendar,
  Package,
  DollarSign,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../contexts/ToastContext';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import type { PresupuestoConRelaciones } from '../../types/presupuestos';

interface PresupuestoHeaderProps {
  presupuesto: PresupuestoConRelaciones;
  onDelete: () => void;
  onDuplicate: () => void;
  onEnviar: () => void;
  onGenerarPDF: () => void;
  onConvertir?: () => void;
}

export function PresupuestoHeader({
  presupuesto,
  onDelete,
  onDuplicate,
  onEnviar,
  onGenerarPDF,
  onConvertir,
}: PresupuestoHeaderProps) {
  const navigate = useNavigate();
  const { showSuccess } = useToast();

  const getEstadoBadge = () => {
    const estadoConfig = {
      borrador: { label: 'Borrador', variant: 'secondary' as const, icon: Edit2 },
      pendiente: { label: 'Pendiente', variant: 'warning' as const, icon: Clock },
      enviado: { label: 'Enviado', variant: 'info' as const, icon: Send },
      aprobado: { label: 'Aprobado', variant: 'success' as const, icon: CheckCircle },
      rechazado: { label: 'Rechazado', variant: 'danger' as const, icon: XCircle },
      convertido: { label: 'Convertido', variant: 'success' as const, icon: CheckCircle },
      vencido: { label: 'Vencido', variant: 'secondary' as const, icon: Clock },
    };

    const config = estadoConfig[presupuesto.estado];
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="w-3 h-3" />
        {config.label}
      </Badge>
    );
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const canEdit = ['borrador', 'pendiente'].includes(presupuesto.estado);
  const canEnviar = ['borrador', 'pendiente'].includes(presupuesto.estado);
  const canConvertir = presupuesto.estado === 'aprobado' && !presupuesto.orden_trabajo_id;

  return (
    <div className="bg-white border-b border-gray-200">
      <div className="px-6 py-4 space-y-4">
        {/* Título y estado */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold text-gray-900">
                {presupuesto.numero_presupuesto}
              </h1>
              {getEstadoBadge()}
            </div>
            <p className="text-sm text-gray-600">
              Creado el {formatDate(presupuesto.fecha_creacion)}
            </p>
          </div>

          {/* Acciones */}
          <div className="flex gap-2">
            {canEdit && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => navigate(`/app/presupuestos/${presupuesto.id}/editar`)}
              >
                <Edit2 className="w-4 h-4 mr-2" />
                Editar
              </Button>
            )}

            {canEnviar && (
              <Button size="sm" onClick={onEnviar}>
                <Send className="w-4 h-4 mr-2" />
                Enviar
              </Button>
            )}

            {canConvertir && onConvertir && (
              <Button size="sm" onClick={onConvertir}>
                <Package className="w-4 h-4 mr-2" />
                Convertir a Orden
              </Button>
            )}

            <Button size="sm" variant="secondary" onClick={onGenerarPDF}>
              <FileText className="w-4 h-4 mr-2" />
              PDF
            </Button>

            <Button size="sm" variant="secondary" onClick={onDuplicate}>
              <Copy className="w-4 h-4 mr-2" />
              Duplicar
            </Button>

            <Button size="sm" variant="danger" onClick={onDelete}>
              <Trash2 className="w-4 h-4 mr-2" />
              Eliminar
            </Button>
          </div>
        </div>

        {/* Info cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Cliente */}
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <User className="w-4 h-4 text-gray-400" />
              <span className="text-xs text-gray-500">Cliente</span>
            </div>
            <p className="font-semibold text-gray-900 truncate">
              {presupuesto.cliente?.razon_social || 'Sin cliente'}
            </p>
          </div>

          {/* Validez */}
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <Calendar className="w-4 h-4 text-gray-400" />
              <span className="text-xs text-gray-500">Válido hasta</span>
            </div>
            <p className="font-semibold text-gray-900">
              {presupuesto.fecha_validez
                ? formatDate(presupuesto.fecha_validez)
                : 'Sin fecha'}
            </p>
          </div>

          {/* Items */}
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <Package className="w-4 h-4 text-gray-400" />
              <span className="text-xs text-gray-500">Items</span>
            </div>
            <p className="font-semibold text-gray-900">
              {presupuesto.items_count || 0}
            </p>
          </div>

          {/* Total */}
          <div className="bg-blue-50 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="w-4 h-4 text-blue-600" />
              <span className="text-xs text-blue-600 font-medium">Total</span>
            </div>
            <p className="text-lg font-bold text-blue-600">
              {formatCurrency(presupuesto.total)}
            </p>
          </div>
        </div>

        {/* Orden asociada */}
        {presupuesto.orden_trabajo && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span className="text-sm text-green-800">
                  Convertido a orden:{' '}
                  <span className="font-semibold">
                    {presupuesto.orden_trabajo.numero_orden}
                  </span>
                </span>
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={() =>
                  navigate(`/app/orders/${presupuesto.orden_trabajo?.id}`)
                }
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Ver orden
              </Button>
            </div>
          </div>
        )}

        {/* Tracking link */}
        {presupuesto.tracking_token && presupuesto.estado === 'enviado' && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ExternalLink className="w-5 h-5 text-blue-600" />
                <span className="text-sm text-blue-800">Tracking público activo</span>
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  const url = `${window.location.origin}/tracking/presupuesto/${presupuesto.tracking_token}`;
                  navigator.clipboard.writeText(url);
                  showSuccess('Link copiado al portapapeles');
                }}
              >
                Copiar link
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
