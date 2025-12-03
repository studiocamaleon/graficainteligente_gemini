import { FileText, User, Calendar, Clock, DollarSign, Upload } from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import type { OrdenPendienteFacturacion } from '../../hooks/useFacturas';

interface OrdenPendienteCardProps {
  orden: OrdenPendienteFacturacion;
  onCargarFactura: (orden: OrdenPendienteFacturacion) => void;
}

export function OrdenPendienteCard({ orden, onCargarFactura }: OrdenPendienteCardProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-AR');
  };

  const getDiasPendienteBadge = (dias: number) => {
    if (dias <= 3) return { variant: 'success' as const, text: `${dias} días` };
    if (dias <= 7) return { variant: 'warning' as const, text: `${dias} días` };
    return { variant: 'error' as const, text: `${dias} días` };
  };

  const diasBadge = getDiasPendienteBadge(orden.dias_pendiente);

  return (
    <Card className="p-6 hover:shadow-lg transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 rounded-lg">
            <FileText className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              {orden.numero_orden}
            </h3>
            <p className="text-sm text-gray-500">{orden.cliente_nombre}</p>
          </div>
        </div>
        <Badge variant={diasBadge.variant}>
          {diasBadge.text}
        </Badge>
      </div>

      <div className="space-y-3 mb-4">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <User className="w-4 h-4" />
          <span>Vendedor: {orden.vendedor_nombre}</span>
        </div>

        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Calendar className="w-4 h-4" />
          <span>Creada: {formatDate(orden.fecha_creacion)}</span>
        </div>

        {orden.fecha_estimada_entrega && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Clock className="w-4 h-4" />
            <span>Entrega: {formatDate(orden.fecha_estimada_entrega)}</span>
          </div>
        )}

        <div className="pt-3 border-t border-gray-100">
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="text-gray-600">Subtotal:</span>
            <span className="font-medium text-gray-900">{formatCurrency(orden.subtotal)}</span>
          </div>
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="text-gray-600">IVA (21%):</span>
            <span className="font-medium text-blue-600">{formatCurrency(orden.subtotal_iva)}</span>
          </div>
          <div className="flex items-center justify-between text-base pt-2 border-t border-gray-100">
            <span className="font-semibold text-gray-900">Total:</span>
            <span className="font-bold text-gray-900">{formatCurrency(orden.total)}</span>
          </div>
        </div>
      </div>

      <Button
        onClick={() => onCargarFactura(orden)}
        variant="primary"
        className="w-full"
      >
        <Upload className="w-4 h-4 mr-2" />
        Cargar Factura
      </Button>
    </Card>
  );
}
