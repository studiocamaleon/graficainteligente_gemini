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
  MessageSquare
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
      borrador: { label: 'Borrador', variant: 'default' as const, icon: Edit2 },
      pendiente: { label: 'Pendiente', variant: 'warning' as const, icon: Clock },
      enviado: { label: 'Enviado', variant: 'info' as const, icon: Send },
      aprobado: { label: 'Aprobado', variant: 'success' as const, icon: CheckCircle },
      rechazado: { label: 'Rechazado', variant: 'danger' as const, icon: XCircle },
      convertido: { label: 'Convertido', variant: 'success' as const, icon: CheckCircle },
      vencido: { label: 'Vencido', variant: 'default' as const, icon: Clock },
    };

    const config = estadoConfig[presupuesto.estado] || estadoConfig.borrador;
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

  const formatDate = (dateString: string | undefined | null) => {
    if (!dateString) return '-';
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
    <div className="bg-white border-b border-gray-100 pb-6 mb-6">
      <div className="px-6 pt-6 space-y-6">
        {/* Título, Estado y Acciones principales */}
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
                {presupuesto.numero_presupuesto}
              </h1>
              {getEstadoBadge()}
            </div>
            <p className="text-sm text-gray-500">
              Creado el {formatDate(presupuesto.fecha_creacion)}
            </p>
          </div>

          {/* Acciones - Agrupadas y limpias */}
          <div className="flex flex-wrap gap-2 items-center">
            {canEdit && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => navigate(`/app/presupuestos/${presupuesto.id}/editar`)}
                className="bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
              >
                <Edit2 className="w-4 h-4 mr-2" />
                Editar
              </Button>
            )}

            {canConvertir && onConvertir && (
              <Button size="sm" onClick={onConvertir} className="bg-green-600 hover:bg-green-700 text-white border-transparent">
                <Package className="w-4 h-4 mr-2" />
                Convertir a Orden
              </Button>
            )}

            {canEnviar && (
              <div className="relative group">
                <Button
                  size="sm"
                  onClick={onEnviar}
                  disabled={presupuesto.items?.some(i => i.precio_unitario_final === null)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="w-4 h-4 mr-2" />
                  Enviar
                </Button>
                {presupuesto.items?.some(i => i.precio_unitario_final === null) && (
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity">
                    Cotizar todos los items antes de enviar
                  </div>
                )}
              </div>
            )}



            <div className="h-6 w-px bg-gray-200 mx-1 hidden md:block"></div>

            <Button size="sm" variant="ghost" onClick={onGenerarPDF} title="Descargar PDF">
              <FileText className="w-4 h-4" />
            </Button>
            <Button size="sm" variant="ghost" onClick={onDuplicate} title="Duplicar">
              <Copy className="w-4 h-4" />
            </Button>
            <Button size="sm" variant="ghost" onClick={onDelete} className="text-red-500 hover:text-red-600 hover:bg-red-50" title="Eliminar">
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Info Metadata Row - Estilo Stripe (Horizontal) */}
        <div className="flex flex-wrap gap-8 py-4 border-t border-b border-gray-100">

          {/* Cliente */}
          <div className="space-y-1">
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Cliente</span>
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-gray-400" />
              <span className="font-medium text-gray-900">{presupuesto.cliente?.razon_social || 'Sin cliente'}</span>
            </div>
          </div>

          {/* Validez */}
          <div className="space-y-1">
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Válido Hasta</span>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-400" />
              <span className="font-medium text-gray-900">
                {presupuesto.fecha_validez ? formatDate(presupuesto.fecha_validez) : '-'}
              </span>
            </div>
          </div>

          {/* Items Count */}
          <div className="space-y-1">
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Items</span>
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-gray-400" />
              <span className="font-medium text-gray-900">{presupuesto.items_count || 0}</span>
            </div>
          </div>

          {/* Total - Highlighted */}
          <div className="space-y-1 ml-auto">
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wide text-right block">Total Estimado</span>
            <div className="font-bold text-2xl text-gray-900 tracking-tight leading-none">
              {formatCurrency(presupuesto.total)}
            </div>
          </div>
        </div>

        {/* Orden asociada & Tracking (Notificaciones contextuales) */}
        <div className="flex flex-col gap-2">
          {presupuesto.orden_trabajo && (
            <div className="flex items-center justify-between bg-green-50/50 border border-green-100 rounded-lg p-3 text-sm">
              <div className="flex items-center gap-2 text-green-700">
                <CheckCircle className="w-4 h-4" />
                <span>Convertido a orden <span className="font-semibold">{presupuesto.orden_trabajo.numero_orden}</span></span>
              </div>
              <button
                onClick={() => navigate(`/app/orders/${presupuesto.orden_trabajo?.id}`)}
                className="flex items-center gap-1 text-green-700 hover:text-green-800 font-medium text-xs uppercase tracking-wide"
              >
                Ver Orden <ExternalLink className="w-3 h-3" />
              </button>
            </div>
          )}

          {presupuesto.tracking_token && presupuesto.estado === 'enviado' && (
            <div className="flex items-center justify-between bg-blue-50/50 border border-blue-100 rounded-lg p-3 text-sm">
              <div className="flex items-center gap-2 text-blue-700">
                <ExternalLink className="w-4 h-4" />
                <span>Tracking público activo</span>
              </div>
              <button
                onClick={() => {
                  const url = `${window.location.origin}/tracking/presupuesto/${presupuesto.tracking_token}`;
                  navigator.clipboard.writeText(url);
                  showSuccess('Link copiado');
                }}
                className="text-blue-600 hover:text-blue-800 font-medium text-xs uppercase tracking-wide"
              >
                Copiar Link
              </button>
            </div>
          )}

          {presupuesto.observaciones_cliente && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-amber-800 mb-1 flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                Observaciones del Cliente (Al responder)
              </h4>
              <p className="text-sm text-amber-700 whitespace-pre-wrap">
                {presupuesto.observaciones_cliente}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
