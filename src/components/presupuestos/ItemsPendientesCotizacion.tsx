import { useState } from 'react';
import { AlertCircle, DollarSign, Package, CheckCircle2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { AsignarPrecioModal } from './AsignarPrecioModal';
import type { ItemPendienteCotizacion } from '../../types/presupuestos';

interface ItemsPendientesCotizacionProps {
  items: ItemPendienteCotizacion[];
  porcentajeCompletitud: number;
  onAsignarPrecio: (itemId: string, precioUnitario: number) => Promise<boolean>;
}

export function ItemsPendientesCotizacion({
  items,
  porcentajeCompletitud,
  onAsignarPrecio,
}: ItemsPendientesCotizacionProps) {
  const [itemSeleccionado, setItemSeleccionado] = useState<ItemPendienteCotizacion | null>(null);

  if (items.length === 0) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-6">
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0">
            <CheckCircle2 className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-green-900">
              Presupuesto Completo
            </h3>
            <p className="text-sm text-green-700 mt-1">
              Todos los items tienen precio asignado. El presupuesto está listo para enviar.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg overflow-hidden">
        {/* Header */}
        <div className="bg-yellow-100 px-6 py-4 border-b border-yellow-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-6 h-6 text-yellow-700" />
              <div>
                <h3 className="text-base font-semibold text-yellow-900">
                  Items Pendientes de Cotizar
                </h3>
                <p className="text-sm text-yellow-700 mt-0.5">
                  {items.length} {items.length === 1 ? 'item' : 'items'} sin precio asignado
                </p>
              </div>
            </div>

            {/* Barra de progreso */}
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-sm font-medium text-yellow-900">
                  {porcentajeCompletitud}% Completo
                </p>
              </div>
              <div className="w-32 h-2 bg-yellow-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-yellow-600 transition-all duration-300"
                  style={{ width: `${porcentajeCompletitud}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Lista de items pendientes */}
        <div className="divide-y divide-yellow-200">
          {items.map((item) => (
            <div
              key={item.id}
              className="px-6 py-4 hover:bg-yellow-100/50 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Package className="w-5 h-5 text-yellow-700 flex-shrink-0" />
                    <h4 className="text-sm font-medium text-gray-900 truncate">
                      {item.producto_nombre}
                    </h4>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600">
                    <span className="flex items-center gap-1">
                      <span className="font-medium">Cantidad:</span>
                      <span>{item.cantidad}</span>
                    </span>
                    {item.descripcion && (
                      <span className="text-gray-500">
                        {item.descripcion.length > 80
                          ? `${item.descripcion.substring(0, 80)}...`
                          : item.descripcion}
                      </span>
                    )}
                  </div>
                </div>

                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setItemSeleccionado(item)}
                  className="flex-shrink-0"
                >
                  <DollarSign className="w-4 h-4 mr-1" />
                  Asignar Precio
                </Button>
              </div>
            </div>
          ))}
        </div>

        {/* Footer con advertencia */}
        <div className="bg-yellow-50 px-6 py-3 border-t border-yellow-200">
          <p className="text-sm text-yellow-800">
            <strong>Importante:</strong> No podrás cambiar el estado del presupuesto hasta que todos los items tengan precio asignado.
          </p>
        </div>
      </div>

      {/* Modal de asignar precio */}
      {itemSeleccionado && (
        <AsignarPrecioModal
          item={itemSeleccionado}
          onAsignar={onAsignarPrecio}
          onClose={() => setItemSeleccionado(null)}
        />
      )}
    </>
  );
}
