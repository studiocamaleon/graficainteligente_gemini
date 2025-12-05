import { X, TrendingUp, BarChart3 } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { getProrationDetails, formatProrationForDisplay } from '../../utils/sharedServiceProration';
import type { ItemForProration } from '../../utils/sharedServiceProration';

interface VerProrateoModalProps {
  tipo: 'servicio' | 'acabado';
  nombre: string;
  prorrateos: Record<string, number>;
  costoTotal: number;
  items: ItemForProration[];
  onClose: () => void;
}

export function VerProrateoModal({
  tipo,
  nombre,
  prorrateos,
  costoTotal,
  items,
  onClose
}: VerProrateoModalProps) {
  const details = getProrationDetails(items, prorrateos);

  const itemsMap = new Map(items.map(item => [item.id, item]));

  const totalProrrateado = Object.values(prorrateos).reduce((sum, val) => sum + val, 0);
  const diferencia = Math.abs(totalProrrateado - costoTotal);

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={`Detalle de Prorrateo - ${nombre}`}
      size="lg"
    >
      <div className="space-y-6">
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 className="w-5 h-5 text-gray-700" />
            <h4 className="font-semibold text-gray-900">Resumen</h4>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">Tipo</p>
              <p className="font-semibold text-gray-900 capitalize">{tipo}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Costo Total</p>
              <p className="font-semibold text-gray-900">
                ${costoTotal.toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Prorrateado</p>
              <p className="font-semibold text-gray-900">
                ${totalProrrateado.toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Items Afectados</p>
              <p className="font-semibold text-gray-900">{items.length}</p>
            </div>
          </div>
          {diferencia > 0.01 && (
            <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                Diferencia de redondeo: ${diferencia.toFixed(2)}
              </p>
            </div>
          )}
        </div>

        <div>
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-5 h-5 text-gray-700" />
            <h4 className="font-semibold text-gray-900">
              Distribución por Item
            </h4>
          </div>

          <div className="space-y-3">
            {details.map((detail, index) => {
              const item = itemsMap.get(detail.itemId);
              if (!item) return null;

              return (
                <div
                  key={detail.itemId}
                  className="p-4 bg-white border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-500">
                          Item #{index + 1}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">
                        Precio del item: ${item.precio_total.toFixed(2)}
                      </p>
                      <p className="text-xs text-gray-500">
                        Cantidad: {item.cantidad} × ${item.precio_unitario.toFixed(2)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-gray-900">
                        ${detail.montoProrrateado.toFixed(2)}
                      </p>
                      <p className="text-sm text-gray-600">
                        {detail.porcentaje.toFixed(1)}%
                      </p>
                    </div>
                  </div>

                  <div className="mt-3">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all"
                        style={{ width: `${detail.porcentaje}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t">
          <Button onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </div>
    </Modal>
  );
}
