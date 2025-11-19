import { AlertTriangle, Loader2 } from 'lucide-react';
import { Card } from '../ui/Card';

interface PriceSummaryPanelProps {
  precioBase: number | null;
  precioServicios: number;
  precioAcabados: number;
  precioTotal: number | null;
  tienePrecioConfigurado: boolean;
  isCalculating: boolean;
  cantidad: number | null;
}

export function PriceSummaryPanel({
  precioBase,
  precioServicios,
  precioAcabados,
  precioTotal,
  tienePrecioConfigurado,
  isCalculating,
  cantidad,
}: PriceSummaryPanelProps) {
  const formatCurrency = (value: number | null) => {
    if (value === null) return '-';
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
    }).format(value);
  };

  const precioTotalFinal = precioTotal !== null && cantidad !== null
    ? precioTotal * cantidad
    : null;

  if (isCalculating) {
    return (
      <Card className="p-6 bg-gray-50">
        <div className="flex items-center justify-center gap-3">
          <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
          <span className="text-gray-600">Calculando precio...</span>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6 bg-gradient-to-br from-blue-50 to-indigo-50">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        Resumen de Precio
      </h3>

      {!tienePrecioConfigurado && (
        <div className="flex items-start gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg mb-4">
          <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-yellow-800">
            <p className="font-medium">Precio no configurado</p>
            <p className="text-xs mt-1">
              No se encontró precio para esta combinación. Verifique la matriz de precios del producto.
            </p>
          </div>
        </div>
      )}

      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-gray-600">Precio base:</span>
          <span className="font-medium text-gray-900">
            {formatCurrency(precioBase)}
          </span>
        </div>

        {precioServicios > 0 && (
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Servicios:</span>
            <span className="font-medium text-green-600">
              + {formatCurrency(precioServicios)}
            </span>
          </div>
        )}

        {precioAcabados > 0 && (
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Acabados:</span>
            <span className="font-medium text-green-600">
              + {formatCurrency(precioAcabados)}
            </span>
          </div>
        )}

        <div className="pt-3 border-t border-gray-200">
          <div className="flex justify-between items-center mb-2">
            <span className="text-gray-700 font-medium">Precio unitario:</span>
            <span className="text-xl font-bold text-gray-900">
              {formatCurrency(precioTotal)}
            </span>
          </div>

          {cantidad !== null && cantidad > 0 && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">
                Cantidad: {cantidad} {cantidad === 1 ? 'unidad' : 'unidades'}
              </span>
              <span className="text-sm text-gray-600">
                Total: <span className="font-semibold text-gray-900">{formatCurrency(precioTotalFinal)}</span>
              </span>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
