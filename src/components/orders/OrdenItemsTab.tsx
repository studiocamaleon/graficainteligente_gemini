import { useState } from 'react';
import { Plus, Trash2, Package } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Table } from '../ui/Table';
import { EmptyState } from '../ui/EmptyState';
import { AddItemModal } from './AddItemModal';

interface OrdenItem {
  id?: string;
  producto_id: string;
  producto_nombre: string;
  cantidad: number;
  configuracion: any;
  precio_base: number;
  precio_servicios: number;
  precio_acabados: number;
  precio_unitario_final: number;
  precio_total: number;
  descuento_individual?: number;
}

interface OrdenItemsTabProps {
  items: OrdenItem[];
  setItems: (items: OrdenItem[]) => void;
  descuentoTotal: number;
  setDescuentoTotal: (descuento: number) => void;
}

export function OrdenItemsTab({
  items,
  setItems,
  descuentoTotal,
  setDescuentoTotal,
}: OrdenItemsTabProps) {
  const [showAddModal, setShowAddModal] = useState(false);

  const handleAgregarItem = (nuevoItem: Omit<OrdenItem, 'id'>) => {
    setItems([...items, { ...nuevoItem, id: `temp-${Date.now()}` }]);
    setShowAddModal(false);
  };

  const handleEliminarItem = (index: number) => {
    const confirmar = window.confirm('¿Está seguro de eliminar este item?');
    if (confirmar) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const handleCantidadChange = (index: number, nuevaCantidad: number) => {
    const itemsCopy = [...items];
    const item = itemsCopy[index];
    item.cantidad = nuevaCantidad;
    item.precio_total = item.precio_unitario_final * nuevaCantidad;
    setItems(itemsCopy);
  };

  const handleDescuentoIndividualChange = (index: number, descuento: number) => {
    const itemsCopy = [...items];
    const item = itemsCopy[index];
    item.descuento_individual = descuento;

    const precioSinDescuento = item.precio_unitario_final * item.cantidad;
    const descuentoAplicado = precioSinDescuento * (descuento / 100);
    item.precio_total = precioSinDescuento - descuentoAplicado;

    setItems(itemsCopy);
  };

  const formatearConfiguracion = (config: any): string => {
    if (!config) return '';

    const parts: string[] = [];

    if (config.tecnologia) parts.push(config.tecnologia);
    if (config.material) parts.push(config.material);
    if (config.tintas && config.tintas.length > 0) {
      parts.push(`Tintas: ${config.tintas.join(', ')}`);
    }
    if (config.medidas) {
      parts.push(`${config.medidas.ancho}x${config.medidas.alto} cm`);
    }
    if (config.caras_impresas) {
      parts.push(`Caras: ${config.caras_impresas}`);
    }

    return parts.join(' | ');
  };

  const columns = [
    {
      key: 'cantidad',
      label: 'Cantidad',
      render: (item: OrdenItem, index: number) => (
        <Input
          type="number"
          min="1"
          value={item.cantidad}
          onChange={(e) => handleCantidadChange(index, parseInt(e.target.value) || 1)}
          className="w-20"
        />
      ),
    },
    {
      key: 'producto',
      label: 'Item y Configuración',
      render: (item: OrdenItem) => (
        <div>
          <div className="font-medium text-gray-900">{item.producto_nombre}</div>
          <div className="text-sm text-gray-500 mt-1">
            {formatearConfiguracion(item.configuracion)}
          </div>
        </div>
      ),
    },
    {
      key: 'precio_unitario',
      label: 'Precio Unitario',
      render: (item: OrdenItem) => (
        <span className="font-medium">
          ${item.precio_unitario_final.toFixed(2)}
        </span>
      ),
    },
    {
      key: 'descuento_individual',
      label: 'Desc. %',
      render: (item: OrdenItem, index: number) => (
        <Input
          type="number"
          min="0"
          max="100"
          value={item.descuento_individual || 0}
          onChange={(e) => handleDescuentoIndividualChange(index, parseFloat(e.target.value) || 0)}
          className="w-20"
        />
      ),
    },
    {
      key: 'precio_total',
      label: 'Precio Total',
      render: (item: OrdenItem) => (
        <span className="font-semibold text-blue-600">
          ${item.precio_total.toFixed(2)}
        </span>
      ),
    },
    {
      key: 'acciones',
      label: '',
      render: (_: OrdenItem, index: number) => (
        <Button
          variant="danger"
          size="sm"
          onClick={() => handleEliminarItem(index)}
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Items de la Orden</h3>
          <p className="text-sm text-gray-500 mt-1">
            Agrega los productos que conforman esta orden
          </p>
        </div>
        <Button onClick={() => setShowAddModal(true)}>
          <Plus className="w-4 h-4" />
          Agregar Item
        </Button>
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No hay items agregados"
          description="Comienza agregando items a esta orden"
          action={
            <Button onClick={() => setShowAddModal(true)}>
              <Plus className="w-4 h-4" />
              Agregar Primer Item
            </Button>
          }
        />
      ) : (
        <>
          <Table columns={columns} data={items} />

          <div className="flex items-center justify-end space-x-4 pt-4 border-t border-gray-200">
            <label className="text-sm font-medium text-gray-700">
              Descuento total sobre la orden:
            </label>
            <div className="flex items-center space-x-2">
              <Input
                type="number"
                min="0"
                max="100"
                value={descuentoTotal}
                onChange={(e) => setDescuentoTotal(parseFloat(e.target.value) || 0)}
                className="w-24"
              />
              <span className="text-sm text-gray-500">%</span>
            </div>
          </div>
        </>
      )}

      {showAddModal && (
        <AddItemModal
          onClose={() => setShowAddModal(false)}
          onAgregar={handleAgregarItem}
        />
      )}
    </div>
  );
}
