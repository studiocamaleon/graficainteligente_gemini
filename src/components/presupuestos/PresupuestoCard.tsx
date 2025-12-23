import { useState } from 'react';
import {
  Eye,
  Edit2,
  Copy,
  Trash2,
  Send,
  FileText,
  CheckCircle,
  XCircle,
  Clock,
  MoreVertical,
  User,
  Calendar,
  DollarSign,
} from 'lucide-react';
import { Card } from '../ui/card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import type { PresupuestoConRelaciones } from '../../types/presupuestos';

interface PresupuestoCardProps {
  presupuesto: PresupuestoConRelaciones;
  onView: (id: string) => void;
  onEdit: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onEnviar?: (id: string) => void;
  onGenerarPDF?: (id: string) => void;
  canDelete?: boolean;
}

export function PresupuestoCard({
  presupuesto,
  onView,
  onEdit,
  onDuplicate,
  onDelete,
  onEnviar,
  onGenerarPDF,
  canDelete = false,
}: PresupuestoCardProps) {
  const [showMenu, setShowMenu] = useState(false);

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

  const getCanalBadge = () => {
    const canalConfig = {
      Web: { color: 'bg-blue-100 text-blue-800', icon: '🌐' },
      WhatsApp: { color: 'bg-green-100 text-green-800', icon: '💬' },
      Mostrador: { color: 'bg-purple-100 text-purple-800', icon: '🏪' },
    };

    const config = canalConfig[presupuesto.canal_venta];

    return (
      <span
        className={`text-xs px-2 py-1 rounded-full ${config.color} flex items-center gap-1`}
      >
        <span>{config.icon}</span>
        {presupuesto.canal_venta}
      </span>
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

  const isVencido = () => {
    if (!presupuesto.fecha_validez) return false;
    return new Date(presupuesto.fecha_validez) < new Date() && presupuesto.estado === 'enviado';
  };

  const diasParaVencer = () => {
    if (!presupuesto.fecha_validez) return null;
    const hoy = new Date();
    const validez = new Date(presupuesto.fecha_validez);
    const diff = Math.ceil((validez.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  };

  return (
    <Card className="hover:shadow-lg transition-all">
      <div className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-lg font-semibold text-gray-900 truncate">
                {presupuesto.numero_presupuesto}
              </h3>
              {getEstadoBadge()}
              {getCanalBadge()}
            </div>

            {/* Cliente */}
            <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
              <User className="w-4 h-4 flex-shrink-0" />
              <span className="truncate">
                {presupuesto.cliente?.razon_social || 'Sin cliente'}
              </span>
            </div>

            {/* Fecha creación */}
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Calendar className="w-4 h-4 flex-shrink-0" />
              <span>Creado: {formatDate(presupuesto.fecha_creacion)}</span>
            </div>
          </div>

          {/* Actions Menu */}
          <div className="relative">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowMenu(!showMenu)}
              className="text-gray-400 hover:text-gray-600"
            >
              <MoreVertical className="w-5 h-5" />
            </Button>

            {showMenu && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowMenu(false)}
                />
                <div className="absolute right-0 top-8 z-20 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1">
                  <button
                    onClick={() => {
                      onView(presupuesto.id);
                      setShowMenu(false);
                    }}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                  >
                    <Eye className="w-4 h-4" />
                    Ver detalle
                  </button>

                  {['borrador', 'pendiente'].includes(presupuesto.estado) && (
                    <button
                      onClick={() => {
                        onEdit(presupuesto.id);
                        setShowMenu(false);
                      }}
                      className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                    >
                      <Edit2 className="w-4 h-4" />
                      Editar
                    </button>
                  )}

                  {onGenerarPDF && (
                    <button
                      onClick={() => {
                        onGenerarPDF(presupuesto.id);
                        setShowMenu(false);
                      }}
                      className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                    >
                      <FileText className="w-4 h-4" />
                      Generar PDF
                    </button>
                  )}

                  {onEnviar && ['borrador', 'pendiente'].includes(presupuesto.estado) && (
                    <button
                      onClick={() => {
                        onEnviar(presupuesto.id);
                        setShowMenu(false);
                      }}
                      className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                    >
                      <Send className="w-4 h-4" />
                      Enviar al cliente
                    </button>
                  )}

                  <button
                    onClick={() => {
                      onDuplicate(presupuesto.id);
                      setShowMenu(false);
                    }}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                  >
                    <Copy className="w-4 h-4" />
                    Duplicar
                  </button>

                  <div className="border-t border-gray-200 my-1" />

                  {canDelete && (
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        console.log('Delete button clicked in Card', { id: presupuesto.id });
                        onDelete(presupuesto.id);
                        setShowMenu(false);
                      }}
                      className="w-full px-4 py-2 text-left text-sm hover:bg-red-50 text-red-600 flex items-center gap-2"
                    >
                      <Trash2 className="w-4 h-4" />
                      Eliminar
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Validez y alertas */}
        {presupuesto.fecha_validez && (
          <div className="space-y-2">
            {isVencido() && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-800">
                ⚠️ Presupuesto vencido
              </div>
            )}
            {!isVencido() && presupuesto.estado === 'enviado' && diasParaVencer() !== null && diasParaVencer()! <= 3 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2 text-sm text-yellow-800">
                ⏰ Vence en {diasParaVencer()} día{diasParaVencer() !== 1 ? 's' : ''}
              </div>
            )}
            <div className="text-sm text-gray-500">
              Válido hasta: {formatDate(presupuesto.fecha_validez)}
            </div>
          </div>
        )}

        {/* Orden asociada */}
        {presupuesto.orden_trabajo && (
          <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2">
            <div className="text-sm text-green-800">
              ✓ Convertido a orden: <span className="font-semibold">{presupuesto.orden_trabajo.numero_orden}</span>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="pt-4 border-t border-gray-100 flex items-center justify-between">
          {/* Total */}
          <div className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-gray-400" />
            <div>
              <div className="text-xs text-gray-500">Total</div>
              <div className="text-lg font-bold text-gray-900">
                {formatCurrency(presupuesto.total)}
              </div>
            </div>
          </div>

          {/* Items count */}
          <div className="text-right">
            <div className="text-xs text-gray-500">Items</div>
            <div className="text-sm font-semibold text-gray-700">
              {presupuesto.items_count || 0}
            </div>
          </div>

          {/* Quick action */}
          <Button
            size="sm"
            variant="primary"
            onClick={() => onView(presupuesto.id)}
          >
            Ver detalle
          </Button>
        </div>
      </div>
    </Card>
  );
}
