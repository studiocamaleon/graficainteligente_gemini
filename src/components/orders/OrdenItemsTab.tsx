import { useState } from 'react';
import { Plus, Trash2, Package } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Switch } from '../ui/Switch';
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
  requiereFactura?: boolean;
  setRequiereFactura?: (requiere: boolean) => void;
}

export function OrdenItemsTab({
  items,
  setItems,
  descuentoTotal,
  setDescuentoTotal,
  requiereFactura = false,
  setRequiereFactura,
}: OrdenItemsTabProps) {
  const [showAddModal, setShowAddModal] = useState(false);

  const handleAgregarItem = async (itemData: any) => {
    const nuevoItem: OrdenItem = {
      id: `temp-${Date.now()}`,
      producto_id: itemData.producto_id,
      producto_nombre: itemData.producto_nombre,
      cantidad: itemData.cantidad,
      configuracion: itemData.configuracion,
      precio_base: itemData.precio_base,
      precio_servicios: itemData.precio_servicios,
      precio_acabados: itemData.precio_acabados,
      precio_unitario_final: itemData.precio_unitario_final,
      precio_total: itemData.precio_total,
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

    if (config.categoria) {
      parts.push(config.categoria);
    }

    if (config.medida_ancho && config.medida_alto) {
      parts.push(`${config.medida_ancho}x${config.medida_alto} cm`);
    } else if (config.medida_ancho) {
      parts.push(`${config.medida_ancho} cm`);
    }

    if (config.material_nombre) {
      if (config.variante_nombre) {
        parts.push(`${config.material_nombre} - ${config.variante_nombre}`);
      } else {
        parts.push(config.material_nombre);
      }

      if (config.espesor) {
        parts.push(`${config.espesor}mm`);
      }
    }

    if (config.tecnologia_nombre) {
      parts.push(config.tecnologia_nombre);
    }

    if (config.tinta_nombre) {
      parts.push(config.tinta_nombre);
    }

    if (config.cara_impresa) {
      const caraTexto = config.cara_impresa === '1/0' ? 'Frente' : config.cara_impresa === '1/1' ? 'Frente/Dorso' : config.cara_impresa;
      parts.push(caraTexto);
    }

    if (config.color) {
      parts.push(config.color);
    }

    if (config.marca) {
      parts.push(config.marca);
    }

    if (config.servicios && config.servicios.length > 0) {
      const servicios = config.servicios
        .map((s: any) => s.nivel_nombre ? `${s.servicio_nombre} (${s.nivel_nombre})` : s.servicio_nombre)
        .join(', ');
      parts.push(`Servicios: ${servicios}`);
    }

    if (config.acabados && config.acabados.length > 0) {
      const acabados = config.acabados
        .map((a: any) => a.nivel_nombre ? `${a.acabado_nombre} (${a.nivel_nombre})` : a.acabado_nombre)
        .join(', ');
      parts.push(`Acabados: ${acabados}`);
    }

    return parts.join(' | ');
  };

  const columns = [
    {
      key: 'cantidad',
      header: 'Cantidad',
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
      header: 'Item y Configuración',
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
      header: 'Precio Unitario',
      render: (item: OrdenItem) => (
        <span className="font-medium">
          ${item.precio_unitario_final.toFixed(2)}
        </span>
      ),
    },
    {
      key: 'descuento_individual',
      header: 'Desc. %',
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
      header: 'Precio Total',
      render: (item: OrdenItem) => (
        <span className="font-semibold text-blue-600">
          ${item.precio_total.toFixed(2)}
        </span>
      ),
    },
    {
      key: 'acciones',
      header: '',
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
        <div className="flex items-center gap-4">
          {setRequiereFactura && (
            <div className="flex items-center gap-2">
              <Switch
                checked={requiereFactura}
                onChange={setRequiereFactura}
              />
              <span className="text-sm text-gray-700">Requiere factura</span>
            </div>
          )}
          <Button onClick={() => setShowAddModal(true)}>
            <Plus className="w-4 h-4" />
            Agregar Item
          </Button>
        </div>
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
          <Table
            columns={columns}
            data={items}
            keyExtractor={(item) => item.id || `item-${items.indexOf(item)}`}
          />

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
