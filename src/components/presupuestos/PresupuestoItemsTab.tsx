import { Package } from 'lucide-react';
import { Badge } from '../ui/Badge';
import { EmptyState } from '../ui/EmptyState';
import type { PresupuestoItem } from '../../types/presupuestos';

interface PresupuestoItemsTabProps {
  items: PresupuestoItem[];
}

export function PresupuestoItemsTab({ items }: PresupuestoItemsTabProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
    }).format(value);
  };

  if (items.length === 0) {
    return (
      <EmptyState
        icon={Package}
        title="No hay items"
        description="Este presupuesto no tiene items agregados"
      />
    );
  }

  const total = items.reduce((sum, item) => sum + Number(item.precio_total), 0);

  return (
    <div className="space-y-4">
      {items.map((item) => (
        <div
          key={item.id}
          className="bg-white border border-gray-200 rounded-lg p-4"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="font-semibold text-gray-900">
                  {item.producto_nombre}
                </h3>
                {item.tipo_item === 'item_personalizado' && (
                  <Badge variant="secondary">Personalizado</Badge>
                )}
                {item.producto_categoria && (
                  <Badge variant="info">{item.producto_categoria}</Badge>
                )}
              </div>

              {item.descripcion && (
                <p className="text-sm text-gray-600 mb-2">{item.descripcion}</p>
              )}

              <div className="flex flex-wrap gap-4 text-sm text-gray-500">
                <span>Cantidad: {item.cantidad}</span>
                <span>Unitario: {formatCurrency(item.precio_unitario_final)}</span>
                {item.tiempo_produccion_dias && item.tiempo_produccion_dias > 0 && (
                  <span>⏱️ {item.tiempo_produccion_dias} días</span>
                )}
              </div>
            </div>

            <div className="text-right">
              <div className="text-xl font-bold text-gray-900">
                {formatCurrency(item.precio_total)}
              </div>
            </div>
          </div>
        </div>
      ))}

      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">
            Total ({items.length} items)
          </span>
          <span className="text-2xl font-bold text-gray-900">
            {formatCurrency(total)}
          </span>
        </div>
      </div>
    </div>
  );
}
