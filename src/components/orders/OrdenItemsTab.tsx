import { useState } from 'react';
import { Plus, Trash2, Package } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Table } from '../ui/Table';
import { EmptyState } from '../ui/EmptyState';
import { UniversalAddItemWizard } from '../wizard/UniversalAddItemWizard';

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

  const handleAgregarItem = async (itemData: any) => {
    const nuevoItem: OrdenItem = {
      id: `temp-${Date.now()}`,
      producto_id: itemData.producto_id,
      producto_nombre: itemData.configuracion?.categoria_nombre || 'Producto',
      cantidad: itemData.cantidad,
      configuracion: itemData.configuracion,
      precio_base: itemData.configuracion?.desglose_precio?.precio_base || 0,
      precio_servicios: itemData.configuracion?.desglose_precio?.precio_servicios || 0,
      precio_acabados: itemData.configuracion?.desglose_precio?.precio_acabados || 0,
      precio_unitario_final: itemData.precio_unitario,
      precio_total: itemData.subtotal,
      descuento_individual: 0,
    };

    setItems([...items, nuevoItem]);
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

    if (config.tipo_tinta) {
      parts.push(config.tipo_tinta === 'CMYK' ? 'Color' : 'B/N');
    }

    if (config.medida_seleccionada) {
      const medida = config.medida_seleccionada;
      if (medida.display) {
        parts.push(medida.display);
      } else if (medida.ancho && medida.alto) {
        parts.push(`${medida.ancho}x${medida.alto} cm`);
      }
    }

    if (config.cara_impresion) {
      const caraTexto = config.cara_impresion === 'solo_frente' ? 'Frente' : 'Frente/Dorso';
      parts.push(caraTexto);
    }

    if (config.material_nombre && config.variante_nombre) {
      parts.push(`${config.material_nombre} ${config.variante_nombre}`);
    }

    if (config.servicios_seleccionados && config.servicios_seleccionados.length > 0) {
      const servicios = config.servicios_seleccionados
        .map((s: any) => s.nivel ? `${s.nombre} (${s.nivel})` : s.nombre)
        .join(', ');
      parts.push(`Servicios: ${servicios}`);
    }

    if (config.acabados_seleccionados && config.acabados_seleccionados.length > 0) {
      const acabados = config.acabados_seleccionados
        .map((a: any) => a.nivel ? `${a.nombre} (${a.nivel})` : a.nombre)
        .join(', ');
      parts.push(`Acabados: ${acabados}`);
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

      <UniversalAddItemWizard
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAgregar={handleAgregarItem}
      />
    </div>
  );
}
