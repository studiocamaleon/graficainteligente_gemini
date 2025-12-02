import { useState } from 'react';
import { Plus, Edit2, Trash2, Package, FileText } from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { EmptyState } from '../ui/EmptyState';
import { UniversalAddItemWizard } from '../wizard/UniversalAddItemWizard';
import { AddItemPersonalizadoModal } from './AddItemPersonalizadoModal';
import type { PresupuestoItem } from '../../types/presupuestos';

interface PresupuestoItemsSectionProps {
  items: PresupuestoItem[];
  onAddItemSistema: (item: any) => void;
  onAddItemPersonalizado: (item: {
    producto_nombre: string;
    descripcion: string;
    cantidad: number;
    precio_unitario_final: number;
    tiempo_produccion_dias?: number;
  }) => void;
  onEditItem: (id: string, updates: any) => void;
  onDeleteItem: (id: string) => void;
}

export function PresupuestoItemsSection({
  items,
  onAddItemSistema,
  onAddItemPersonalizado,
  onEditItem,
  onDeleteItem,
}: PresupuestoItemsSectionProps) {
  const [showWizard, setShowWizard] = useState(false);
  const [showPersonalizadoModal, setShowPersonalizadoModal] = useState(false);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
    }).format(value);
  };

  const getTotalItems = () => {
    return items.reduce((sum, item) => sum + Number(item.precio_total), 0);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Items del Presupuesto
          </h2>
          <p className="text-sm text-gray-600">
            Agrega productos del sistema o items personalizados
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowPersonalizadoModal(true)}
          >
            <FileText className="w-4 h-4 mr-2" />
            Item Personalizado
          </Button>
          <Button size="sm" onClick={() => setShowWizard(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Producto del Sistema
          </Button>
        </div>
      </div>

      {/* Empty State */}
      {items.length === 0 && (
        <EmptyState
          icon={Package}
          title="No hay items agregados"
          description="Agrega productos del catálogo o items personalizados"
        />
      )}

      {/* Items List */}
      {items.length > 0 && (
        <div className="space-y-3">
          {items.map((item, index) => (
            <div
              key={item.id || index}
              className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  {/* Nombre y tipo */}
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

                  {/* Descripción */}
                  {item.descripcion && (
                    <p className="text-sm text-gray-600 mb-2">
                      {item.descripcion}
                    </p>
                  )}

                  {/* Detalles */}
                  <div className="flex flex-wrap gap-4 text-sm text-gray-500">
                    <span>Cantidad: {item.cantidad}</span>
                    <span>Unitario: {formatCurrency(item.precio_unitario_final)}</span>
                    {item.tiempo_produccion_dias && item.tiempo_produccion_dias > 0 && (
                      <span>⏱️ {item.tiempo_produccion_dias} días</span>
                    )}
                  </div>
                </div>

                {/* Precio y acciones */}
                <div className="text-right">
                  <div className="text-xl font-bold text-gray-900 mb-2">
                    {formatCurrency(item.precio_total)}
                  </div>
                  <div className="flex gap-2">
                    {/* Botón editar deshabilitado por ahora */}
                    <button
                      onClick={() => onDeleteItem(item.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Eliminar"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Total */}
      {items.length > 0 && (
        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm text-gray-600">Subtotal ({items.length} items)</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {formatCurrency(getTotalItems())}
            </div>
          </div>
        </div>
      )}

      {/* Wizard */}
      {showWizard && (
        <UniversalAddItemWizard
          isOpen={showWizard}
          onClose={() => setShowWizard(false)}
          onAddItem={(item) => {
            onAddItemSistema(item);
            setShowWizard(false);
          }}
        />
      )}

      {/* Modal Personalizado */}
      <AddItemPersonalizadoModal
        isOpen={showPersonalizadoModal}
        onClose={() => setShowPersonalizadoModal(false)}
        onAdd={(item) => {
          onAddItemPersonalizado(item);
          setShowPersonalizadoModal(false);
        }}
      />
    </div>
  );
}
