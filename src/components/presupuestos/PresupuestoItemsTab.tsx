import { Package, AlertTriangle } from 'lucide-react';
import { Badge } from '../ui/Badge';
import { EmptyState } from '../ui/EmptyState';
import type { PresupuestoItem } from '../../types/presupuestos';

interface PresupuestoItemsTabProps {
  items: PresupuestoItem[];
  presupuestoId?: string;
  esEditable?: boolean;
}

export function PresupuestoItemsTab({ items, presupuestoId, esEditable = false }: PresupuestoItemsTabProps) {
  const formatCurrency = (value: number | null) => {
    if (value === null) return 'Por Cotizar';
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

  // Separar items con y sin precio
  const itemsCompletos = items.filter(
    (item) => item.precio_unitario_final !== null && item.precio_total !== null
  );
  const itemsPendientes = items.filter(
    (item) => item.precio_unitario_final === null || item.precio_total === null
  );

  const total = itemsCompletos.reduce((sum, item) => sum + Number(item.precio_total), 0);

  const tienePendientes = itemsPendientes.length > 0;
  const esPendiente = (item: PresupuestoItem) =>
    item.precio_unitario_final === null || item.precio_total === null;

  return (
    <div className="space-y-4">
      {/* Banner informativo si hay items pendientes */}
      {tienePendientes && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-yellow-900">
                Items Pendientes de Cotización
              </h3>
              <p className="text-sm text-yellow-700 mt-1">
                {itemsPendientes.length} {itemsPendientes.length === 1 ? 'item' : 'items'} sin precio asignado.
                {esEditable && (
                  <> Usa el botón "Editar" para asignar los precios faltantes.</>
                )}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Lista de items */}
      {items.map((item) => {
        const isPendiente = esPendiente(item);
        return (
          <div
            key={item.id}
            className={`rounded-lg p-4 border ${
              isPendiente
                ? 'bg-yellow-50/50 border-yellow-200'
                : 'bg-white border-gray-200'
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="font-semibold text-gray-900">
                    {item.producto_nombre}
                  </h3>
                  {isPendiente && (
                    <Badge variant="warning">Pendiente de Cotizar</Badge>
                  )}
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
                  <span className={isPendiente ? 'text-yellow-700 font-medium' : ''}>
                    Unitario: {formatCurrency(item.precio_unitario_final)}
                  </span>
                  {item.tiempo_produccion_dias && item.tiempo_produccion_dias > 0 && (
                    <span>⏱️ {item.tiempo_produccion_dias} días</span>
                  )}
                </div>
              </div>

              <div className="text-right">
                <div className={`text-xl font-bold ${
                  isPendiente ? 'text-yellow-700' : 'text-gray-900'
                }`}>
                  {formatCurrency(item.precio_total)}
                </div>
              </div>
            </div>
          </div>
        );
      })}

      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
        <div className="space-y-2">
          {tienePendientes && (
            <div className="flex items-center justify-between text-sm border-b border-gray-200 pb-2">
              <span className="text-gray-600">
                Items con precio ({itemsCompletos.length})
              </span>
              <span className="text-gray-900 font-medium">
                {formatCurrency(total)}
              </span>
            </div>
          )}
          {tienePendientes && (
            <div className="flex items-center justify-between text-sm border-b border-gray-200 pb-2">
              <span className="text-yellow-700">
                Items pendientes ({itemsPendientes.length})
              </span>
              <span className="text-yellow-700 font-medium">
                Por Cotizar
              </span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">
              {tienePendientes ? 'Subtotal Cotizado' : `Total (${items.length} items)`}
            </span>
            <span className="text-2xl font-bold text-gray-900">
              {formatCurrency(total)}
            </span>
          </div>
          {tienePendientes && (
            <p className="text-xs text-yellow-700 mt-2">
              * El total final se calculará una vez que se asignen todos los precios
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
