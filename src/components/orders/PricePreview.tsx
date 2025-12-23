import { Loader2, DollarSign } from 'lucide-react';
import { Card } from '../ui/card';

interface PricePreviewProps {
  productoNombre?: string;
  cantidad: number;
  precioBase?: number;
  precioServicios?: number;
  precioAcabados?: number;
  precioUnitarioFinal?: number;
  precioTotal?: number;
  isCalculating: boolean;
  hasRequiredData: boolean;
}

export function PricePreview({
  productoNombre,
  cantidad,
  precioBase,
  precioServicios,
  precioAcabados,
  precioUnitarioFinal,
  precioTotal,
  isCalculating,
  hasRequiredData,
}: PricePreviewProps) {
  return (
    <Card className="sticky top-6">
      <div className="p-4 space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-gray-200">
          <DollarSign className="w-5 h-5 text-blue-600" />
          <h3 className="font-semibold text-gray-900">Cotización</h3>
        </div>

        {!productoNombre && (
          <div className="text-center py-8">
            <p className="text-sm text-gray-500">
              Selecciona un producto para ver el precio
            </p>
          </div>
        )}

        {productoNombre && !hasRequiredData && (
          <div className="text-center py-8">
            <p className="text-sm text-gray-500">
              Completa la configuración para calcular el precio
            </p>
          </div>
        )}

        {productoNombre && hasRequiredData && isCalculating && (
          <div className="text-center py-8">
            <Loader2 className="w-6 h-6 text-blue-600 animate-spin mx-auto mb-2" />
            <p className="text-sm text-gray-500">Calculando precio...</p>
          </div>
        )}

        {productoNombre &&
          hasRequiredData &&
          !isCalculating &&
          precioBase !== undefined &&
          precioUnitarioFinal !== undefined &&
          precioTotal !== undefined && (
            <>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Producto:</span>
                  <span className="font-medium text-gray-900">{productoNombre}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Cantidad:</span>
                  <span className="font-medium text-gray-900">{cantidad}</span>
                </div>
              </div>

              <div className="pt-3 border-t border-gray-200 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Precio base:</span>
                  <span className="font-medium text-gray-900">${precioBase.toFixed(2)}</span>
                </div>

                {precioServicios !== undefined && precioServicios > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Servicios:</span>
                    <span className="font-medium text-green-600">+${precioServicios.toFixed(2)}</span>
                  </div>
                )}

                {precioAcabados !== undefined && precioAcabados > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Acabados:</span>
                    <span className="font-medium text-green-600">+${precioAcabados.toFixed(2)}</span>
                  </div>
                )}

                <div className="flex justify-between text-sm pt-2 border-t border-gray-200">
                  <span className="text-gray-600">Precio unitario:</span>
                  <span className="font-semibold text-gray-900">${precioUnitarioFinal.toFixed(2)}</span>
                </div>
              </div>

              <div className="pt-3 border-t-2 border-gray-300">
                <div className="flex justify-between items-center">
                  <span className="text-base font-semibold text-gray-700">Total:</span>
                  <span className="text-2xl font-bold text-blue-600">${precioTotal.toFixed(2)}</span>
                </div>
              </div>
            </>
          )}
      </div>
    </Card>
  );
}
