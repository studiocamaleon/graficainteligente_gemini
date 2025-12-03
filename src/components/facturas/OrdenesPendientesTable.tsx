import { FileText, Upload, Eye } from 'lucide-react';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import type { OrdenPendienteFacturacion } from '../../hooks/useFacturas';

interface OrdenesPendientesTableProps {
  ordenes: OrdenPendienteFacturacion[];
  onCargarFactura: (orden: OrdenPendienteFacturacion) => void;
  onVerDetalle?: (ordenId: string) => void;
}

export function OrdenesPendientesTable({
  ordenes,
  onCargarFactura,
  onVerDetalle
}: OrdenesPendientesTableProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const getDiasPendienteBadge = (dias: number) => {
    if (dias <= 3) return { variant: 'success' as const, text: `${dias}d` };
    if (dias <= 7) return { variant: 'warning' as const, text: `${dias}d` };
    return { variant: 'error' as const, text: `${dias}d` };
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Orden
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Cliente
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Vendedor
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Fecha Creación
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Días Pendiente
              </th>
              <th className="px-6 py-4 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Subtotal
              </th>
              <th className="px-6 py-4 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                IVA
              </th>
              <th className="px-6 py-4 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Total
              </th>
              <th className="px-6 py-4 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {ordenes.map((orden) => {
              const diasBadge = getDiasPendienteBadge(orden.dias_pendiente);

              return (
                <tr
                  key={orden.id}
                  className="hover:bg-gray-50 transition-colors"
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <div className="flex-shrink-0 w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                        <FileText className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-gray-900">
                          {orden.numero_orden}
                        </div>
                        {orden.fecha_estimada_entrega && (
                          <div className="text-xs text-gray-500">
                            Entrega: {formatDate(orden.fecha_estimada_entrega)}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900 max-w-[200px] truncate">
                      {orden.cliente_nombre}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {orden.vendedor_nombre}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {formatDate(orden.fecha_creacion)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Badge variant={diasBadge.variant} size="sm">
                      {diasBadge.text}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="text-sm font-medium text-gray-900">
                      {formatCurrency(orden.subtotal)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="text-sm font-medium text-blue-600">
                      {formatCurrency(orden.subtotal_iva)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="text-sm font-bold text-gray-900">
                      {formatCurrency(orden.total)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center justify-center gap-2">
                      {onVerDetalle && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onVerDetalle(orden.id)}
                          title="Ver detalle"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                      )}
                      {orden.facturada ? (
                        <Badge variant="success" size="sm">
                          Facturada
                        </Badge>
                      ) : (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => onCargarFactura(orden)}
                        >
                          <Upload className="w-4 h-4 mr-1" />
                          Cargar Factura
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer con resumen */}
      <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
        <div className="flex items-center justify-between text-sm">
          <div className="text-gray-600">
            <span className="font-semibold text-gray-900">{ordenes.length}</span> {ordenes.length === 1 ? 'orden' : 'órdenes'}
          </div>
          <div className="flex items-center gap-6">
            <div className="text-right">
              <div className="text-xs text-gray-500 mb-1">Total Acumulado</div>
              <div className="text-base font-bold text-gray-900">
                {formatCurrency(ordenes.reduce((sum, orden) => sum + orden.total, 0))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
