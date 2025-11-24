import { Receipt, DollarSign, AlertTriangle } from 'lucide-react';

interface OrdenFooterTotalesProps {
  subtotal: number;
  descuentoAplicado: number;
  iva: number;
  total: number;
  requiereFactura: boolean;
  totalPagado?: number;
  mostrarSaldo?: boolean;
}

export function OrdenFooterTotales({
  subtotal,
  descuentoAplicado,
  iva,
  total,
  requiereFactura,
  totalPagado = 0,
  mostrarSaldo = false,
}: OrdenFooterTotalesProps) {
  const saldoPendiente = total - totalPagado;
  const tienePagos = totalPagado > 0;

  return (
    <div className="fixed bottom-0 left-0 lg:left-72 right-0 bg-white border-t border-gray-200 shadow-lg z-40">
      <div className="px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Receipt className="w-5 h-5 text-gray-400" />
            <span className="text-sm font-medium text-gray-600">Resumen de Totales</span>
          </div>

          <div className="flex items-center space-x-8">
            <div className="text-right">
              <div className="text-xs text-gray-500">Subtotal</div>
              <div className="text-sm font-medium text-gray-900">
                ${subtotal.toFixed(2)}
              </div>
            </div>

            {descuentoAplicado > 0 && (
              <div className="text-right">
                <div className="text-xs text-gray-500">Descuento</div>
                <div className="text-sm font-medium text-red-600">
                  -${descuentoAplicado.toFixed(2)}
                </div>
              </div>
            )}

            {requiereFactura && (
              <div className="text-right">
                <div className="text-xs text-gray-500">IVA (21%)</div>
                <div className="text-sm font-medium text-gray-900">
                  ${iva.toFixed(2)}
                </div>
              </div>
            )}

            <div className="text-right border-l border-gray-200 pl-8">
              <div className="text-xs text-gray-500 mb-1">Total Orden</div>
              <div className="text-2xl font-bold text-blue-600">
                ${total.toFixed(2)}
              </div>
            </div>

            {/* Saldo pendiente (solo si mostrarSaldo es true) */}
            {mostrarSaldo && tienePagos && (
              <>
                <div className="text-right border-l border-gray-200 pl-8">
                  <div className="text-xs text-green-700 mb-1">Pagado</div>
                  <div className="text-2xl font-bold text-green-600">
                    ${totalPagado.toFixed(2)}
                  </div>
                </div>

                <div className={`text-right border-l pl-8 ${
                  saldoPendiente > 0 ? 'border-amber-200' : 'border-gray-200'
                }`}>
                  <div className={`flex items-center gap-1 text-xs mb-1 ${
                    saldoPendiente > 0 ? 'text-amber-700' : 'text-gray-500'
                  }`}>
                    {saldoPendiente > 0 && <AlertTriangle className="w-3 h-3" />}
                    <span>Saldo Pendiente</span>
                  </div>
                  <div className={`text-2xl font-bold ${
                    saldoPendiente > 0 ? 'text-amber-600' : 'text-gray-900'
                  }`}>
                    ${saldoPendiente.toFixed(2)}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
