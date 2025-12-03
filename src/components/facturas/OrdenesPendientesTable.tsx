import { useState } from 'react';
import { FileText, Upload, Eye, FileDown } from 'lucide-react';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { supabase } from '../../lib/supabase';
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
  const [openingPdf, setOpeningPdf] = useState<string | null>(null);

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

  const handleVerFactura = async (orden: OrdenPendienteFacturacion) => {
    if (!orden.factura_storage_path) {
      console.error('No hay ruta de factura para esta orden');
      return;
    }

    setOpeningPdf(orden.id);

    try {
      // Generar URL firmada válida por 1 hora
      const { data, error } = await supabase.storage
        .from('facturas')
        .createSignedUrl(orden.factura_storage_path, 3600);

      if (error) {
        console.error('Error al generar URL de factura:', error);
        alert('Error al cargar la factura. Por favor, intenta nuevamente.');
        return;
      }

      if (data?.signedUrl) {
        // Abrir en nueva pestaña
        window.open(data.signedUrl, '_blank');
      }
    } catch (error) {
      console.error('Error inesperado al abrir factura:', error);
      alert('Error al cargar la factura. Por favor, intenta nuevamente.');
    } finally {
      setOpeningPdf(null);
    }
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
                        <button
                          onClick={() => handleVerFactura(orden)}
                          disabled={openingPdf === orden.id || !orden.factura_storage_path}
                          className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                            orden.factura_storage_path
                              ? 'bg-green-100 text-green-700 hover:bg-green-200 hover:shadow-sm cursor-pointer'
                              : 'bg-green-100 text-green-700 cursor-default'
                          } ${openingPdf === orden.id ? 'opacity-50' : ''}`}
                          title={orden.factura_storage_path ? `Ver factura ${orden.numero_factura || ''}` : 'No hay archivo disponible'}
                        >
                          {openingPdf === orden.id ? (
                            <>
                              <div className="w-3 h-3 border-2 border-green-700 border-t-transparent rounded-full animate-spin" />
                              Abriendo...
                            </>
                          ) : (
                            <>
                              {orden.factura_storage_path && <FileDown className="w-3 h-3" />}
                              {orden.numero_factura || 'Facturada'}
                            </>
                          )}
                        </button>
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
