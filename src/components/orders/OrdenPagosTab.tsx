import { Plus, DollarSign, AlertCircle } from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { EmptyState } from '../ui/EmptyState';

interface Totales {
  subtotal: number;
  descuentoAplicado: number;
  subtotalConDescuento: number;
  iva: number;
  total: number;
}

interface Pago {
  id: string;
  fecha_pago: string;
  monto: number;
  metodo_pago: string;
  referencia_pago?: string;
  notas?: string;
}

interface OrdenPagosTabProps {
  totales: Totales;
  pagos: Pago[];
  onAgregarPago: () => void;
  readOnly?: boolean;
}

export function OrdenPagosTab({
  totales,
  pagos,
  onAgregarPago,
  readOnly = false,
}: OrdenPagosTabProps) {
  const totalPagado = pagos.reduce((sum, p) => sum + p.monto, 0);
  const saldoPendiente = totales.total - totalPagado;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="text-sm text-blue-700 mb-1">Total de la Orden</div>
          <div className="text-2xl font-bold text-blue-900">
            ${totales.total.toFixed(2)}
          </div>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="text-sm text-green-700 mb-1">Total Pagado</div>
          <div className="text-2xl font-bold text-green-900">
            ${totalPagado.toFixed(2)}
          </div>
        </div>

        <div className={`
          border rounded-lg p-4
          ${saldoPendiente > 0 ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-200'}
        `}>
          <div className={`text-sm mb-1 ${saldoPendiente > 0 ? 'text-amber-700' : 'text-gray-700'}`}>
            Saldo Pendiente
          </div>
          <div className={`text-2xl font-bold ${saldoPendiente > 0 ? 'text-amber-900' : 'text-gray-900'}`}>
            ${saldoPendiente.toFixed(2)}
          </div>
        </div>
      </div>

      {readOnly && (
        <div className="flex items-center space-x-2 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <AlertCircle className="w-5 h-5 text-amber-600" />
          <p className="text-sm text-amber-800">
            Los pagos se podrán registrar una vez que la orden esté creada.
          </p>
        </div>
      )}

      {!readOnly && (
        <>
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Pagos Registrados</h3>
            <Button onClick={onAgregarPago} disabled={saldoPendiente <= 0}>
              <Plus className="w-4 h-4" />
              Registrar Pago
            </Button>
          </div>

          {pagos.length === 0 ? (
            <EmptyState
              icon={DollarSign}
              title="No hay pagos registrados"
              description="Registra los pagos recibidos para esta orden"
            />
          ) : (
            <div className="space-y-3">
              {pagos.map(pago => (
                <div
                  key={pago.id}
                  className="flex items-center justify-between p-4 bg-gray-50 border border-gray-200 rounded-lg"
                >
                  <div>
                    <div className="flex items-center space-x-3">
                      <span className="font-medium text-gray-900">
                        ${pago.monto.toFixed(2)}
                      </span>
                      <Badge variant="secondary">{pago.metodo_pago}</Badge>
                    </div>
                    <div className="text-sm text-gray-500 mt-1">
                      {new Date(pago.fecha_pago).toLocaleDateString('es-AR')}
                      {pago.referencia_pago && ` • Ref: ${pago.referencia_pago}`}
                    </div>
                    {pago.notas && (
                      <div className="text-sm text-gray-600 mt-1">{pago.notas}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
