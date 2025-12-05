import { useState, useMemo } from 'react';
import { Plus, Trash2, Package, FileText, Printer, ChevronDown, ChevronUp, Calendar, Edit2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Switch } from '../ui/Switch';
import { Badge } from '../ui/Badge';
import { Table } from '../ui/Table';
import { EmptyState } from '../ui/EmptyState';
import { Card } from '../ui/Card';
import { UniversalAddItemWizard } from '../wizard/UniversalAddItemWizard';
import { AsociarOrdenCopiadoModal } from './AsociarOrdenCopiadoModal';
import { AddItemPersonalizadoOrdenModal } from './AddItemPersonalizadoOrdenModal';

interface OrdenItem {
  id?: string;
  tipo_item?: 'catalogo' | 'personalizado';
  producto_id: string | null;
  producto_nombre: string;
  producto_categoria?: string;
  descripcion?: string;
  tiempo_produccion_dias?: number;
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
  clienteNombre?: string;
  ordenesCopiadoAsociadas?: any[];
  onOrdenesCopiadoAsociadasChange?: (ordenes: any[]) => void;
}

export function OrdenItemsTab({
  items,
  setItems,
  descuentoTotal,
  setDescuentoTotal,
  requiereFactura = false,
  setRequiereFactura,
  clienteNombre = '',
  ordenesCopiadoAsociadas = [],
  onOrdenesCopiadoAsociadasChange,
}: OrdenItemsTabProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAddPersonalizadoModal, setShowAddPersonalizadoModal] = useState(false);
  const [showAsociarOCModal, setShowAsociarOCModal] = useState(false);
  const [ordenCopiadoEditando, setOrdenCopiadoEditando] = useState<any>(undefined);
  const [ordenesExpanded, setOrdenesExpanded] = useState<Record<string, boolean>>({});

  const handleAgregarItem = async (itemData: any) => {
    const nuevoItem: OrdenItem = {
      id: `temp-${Date.now()}-${Math.random()}`,
      producto_id: itemData.producto_id,
      producto_nombre: itemData.producto_nombre,
      producto_categoria: itemData.categoria || itemData.producto_categoria,
      cantidad: itemData.cantidad,
      configuracion: itemData.configuracion,
      precio_base: itemData.precio_base,
      precio_servicios: itemData.precio_servicios,
      precio_acabados: itemData.precio_acabados,
      precio_unitario_final: itemData.precio_unitario_final,
      precio_total: itemData.precio_total,
      descuento_individual: 0,
      rutas_generadas: itemData.rutas_generadas || [], // Guardar rutas pregeneradas
    } as any;

    setItems(prevItems => [...prevItems, nuevoItem]);
    setShowAddModal(false);
  };

  const handleAgregarItemPersonalizado = (itemData: {
    producto_nombre: string;
    descripcion: string;
    cantidad: number;
    precio_unitario_final: number;
    tiempo_produccion_dias?: number;
  }) => {
    const nuevoItem: any = {
      id: `temp-${Date.now()}-${Math.random()}`,
      tipo_item: 'personalizado',
      producto_id: null,
      producto_nombre: itemData.producto_nombre,
      producto_categoria: 'Personalizado',
      descripcion: itemData.descripcion,
      tiempo_produccion_dias: itemData.tiempo_produccion_dias,
      cantidad: itemData.cantidad,
      precio_base: 0,
      precio_servicios: 0,
      precio_acabados: 0,
      precio_unitario_final: itemData.precio_unitario_final,
      precio_total: itemData.cantidad * itemData.precio_unitario_final,
      descuento_individual: 0,
      rutas_generadas: [],
      configuracion: {
        tipo_item: 'personalizado',
        descripcion: itemData.descripcion,
      },
    };

    setItems(prevItems => [...prevItems, nuevoItem]);
    setShowAddPersonalizadoModal(false);
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

  const renderConfiguracion = (config: any) => {
    if (!config) return null;

    const formatCaraImpresa = (cara: string) => {
      if (cara === '1/0') return 'Frente';
      if (cara === '1/1') return 'Frente y Dorso';
      if (cara === 'frente_y_dorso' || cara === 'solo_frente') return cara === 'frente_y_dorso' ? 'Frente y Dorso' : 'Frente';
      return cara;
    };

    const formatEspesorOGramaje = () => {
      // Si tiene espesor, usar la unidad del material
      if (config.espesor && config.unidad_espesor) {
        // Para gramajes, agregar espacio antes de la unidad
        if (config.unidad_espesor === 'gr' || config.unidad_espesor === 'g') {
          return `${config.espesor} ${config.unidad_espesor}`;
        }
        // Para otras unidades (mm, cm, etc), no agregar espacio
        return `${config.espesor}${config.unidad_espesor}`;
      }
      // Fallback: si solo tiene espesor sin unidad
      if (config.espesor) {
        return `${config.espesor}mm`;
      }
      // Fallback legacy: si tiene gramaje (por compatibilidad con datos antiguos)
      if (config.gramaje) {
        return `${config.gramaje} g`;
      }
      return null;
    };

    const espesorFormateado = formatEspesorOGramaje();

    return (
      <div className="space-y-2">
        {/* Línea 1: Info básica */}
        <div className="flex flex-wrap gap-1.5 text-sm text-gray-600">
          {(config.medida_ancho || config.medida_alto) && (
            <span>
              {config.medida_ancho && config.medida_alto
                ? `${config.medida_ancho}x${config.medida_alto} cm`
                : `${config.medida_ancho || config.medida_alto} cm`
              }
            </span>
          )}
          {config.material_nombre && (
            <>
              {(config.medida_ancho || config.medida_alto) && <span className="text-gray-400">|</span>}
              <span>
                {config.material_nombre}
                {config.variante_nombre && ` - ${config.variante_nombre}`}
              </span>
            </>
          )}
          {espesorFormateado && (
            <>
              <span className="text-gray-400">|</span>
              <span>{espesorFormateado}</span>
            </>
          )}
          {config.tecnologia_nombre && (
            <>
              <span className="text-gray-400">|</span>
              <span>{config.tecnologia_nombre}</span>
            </>
          )}
          {config.tinta_nombre && (
            <>
              <span className="text-gray-400">|</span>
              <span>{config.tinta_nombre}</span>
            </>
          )}
          {config.cara_impresa && (
            <>
              <span className="text-gray-400">|</span>
              <span>{formatCaraImpresa(config.cara_impresa)}</span>
            </>
          )}
          {config.color && (
            <>
              <span className="text-gray-400">|</span>
              <span>{config.color}</span>
            </>
          )}
          {config.marca && (
            <>
              <span className="text-gray-400">|</span>
              <span>{config.marca}</span>
            </>
          )}
        </div>

        {/* Línea 2: Servicios y Acabados con badges */}
        {((config.servicios_seleccionados && config.servicios_seleccionados.length > 0) ||
          (config.acabados_seleccionados && config.acabados_seleccionados.length > 0)) && (
          <div className="flex flex-wrap gap-1.5">
            {config.servicios_seleccionados?.map((s: any, idx: number) => (
              <Badge key={`servicio-${idx}`} variant="blue" size="sm">
                {s.nivel ? `${s.nombre} (${s.nivel})` : s.nombre}
              </Badge>
            ))}
            {config.acabados_seleccionados?.map((a: any, idx: number) => (
              <Badge key={`acabado-${idx}`} variant="purple" size="sm">
                {a.nivel ? `${a.nombre} (${a.nivel})` : a.nombre}
              </Badge>
            ))}
          </div>
        )}
      </div>
    );
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
          <div className="flex items-center gap-2 mb-1">
            <div className="font-medium text-gray-900">{item.producto_nombre}</div>
            {item.tipo_item === 'personalizado' && (
              <Badge variant="purple" size="sm">Personalizado</Badge>
            )}
          </div>
          {item.tipo_item === 'personalizado' && item.descripcion ? (
            <div className="text-sm text-gray-600 whitespace-pre-wrap">
              {item.descripcion}
            </div>
          ) : (
            renderConfiguracion(item.configuracion)
          )}
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
        <div className="flex items-center gap-1">
          <Input
            type="text"
            inputMode="decimal"
            value={item.descuento_individual || 0}
            onChange={(e) => {
              const value = e.target.value.replace(/[^0-9.]/g, '');
              const numValue = parseFloat(value) || 0;
              if (numValue >= 0 && numValue <= 100) {
                handleDescuentoIndividualChange(index, numValue);
              }
            }}
            className="w-16 text-center"
            placeholder="0"
          />
          <span className="text-sm text-gray-500">%</span>
        </div>
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
          <div className="flex items-center gap-2">
            <Button onClick={() => setShowAddModal(true)}>
              <Plus className="w-4 h-4" />
              Item de Catálogo
            </Button>
            <Button
              onClick={() => setShowAddPersonalizadoModal(true)}
              variant="outline"
              className="border-dashed"
            >
              <Plus className="w-4 h-4" />
              Item Personalizado
            </Button>
          </div>
          {clienteNombre && onOrdenesCopiadoAsociadasChange && (
            <Button
              onClick={() => {
                setOrdenCopiadoEditando(undefined);
                setShowAsociarOCModal(true);
              }}
              className="bg-gradient-to-r from-yellow-600 to-amber-700 hover:from-yellow-700 hover:to-amber-800 text-white shadow-md hover:shadow-lg transition-all"
            >
              <Printer className="w-4 h-4" />
              Asociar OC
              {ordenesCopiadoAsociadas.length > 0 && (
                <Badge variant="primary" className="ml-2">
                  {ordenesCopiadoAsociadas.length}
                </Badge>
              )}
            </Button>
          )}
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

      {/* Órdenes de Copiado Asociadas */}
      {onOrdenesCopiadoAsociadasChange && ordenesCopiadoAsociadas.length > 0 && (
        <div className="mt-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Órdenes de Copiado Asociadas
          </h3>
          <div className="space-y-3">
            {ordenesCopiadoAsociadas.map((oc) => (
              <Card key={oc.id} className="border-blue-200 bg-blue-50">
                <div className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <Printer className="w-5 h-5 text-blue-600" />
                        <span className="font-semibold text-gray-900">
                          Orden de Copiado
                        </span>
                        <Badge variant="primary">{oc.items.length} items</Badge>
                        {oc.fecha_entrega_estimada && (
                          <div className="flex items-center gap-1 text-sm text-gray-600">
                            <Calendar className="w-4 h-4" />
                            {new Date(oc.fecha_entrega_estimada).toLocaleDateString()}
                          </div>
                        )}
                      </div>

                      {ordenesExpanded[oc.id] && (
                        <div className="mt-3 pl-8 space-y-2">
                          {oc.items.map((item: any, idx: number) => (
                            <div
                              key={item.id}
                              className="text-sm text-gray-700 flex items-center gap-2"
                            >
                              <Badge variant="secondary" size="sm">
                                {idx + 1}
                              </Badge>
                              <span>
                                {item.config.cantidad_copias} copias •{' '}
                                {item.config.cantidad_hojas} hojas •{' '}
                                {item.config.tipo_tinta === 'CMYK' ? 'Color' : 'B/N'}
                                {item.descripcion && ` • ${item.descripcion}`}
                              </span>
                              <span className="ml-auto font-medium text-green-600">
                                ${(item.precio || 0).toFixed(2)}
                              </span>
                            </div>
                          ))}
                          {oc.observaciones && (
                            <div className="mt-2 p-2 bg-white rounded text-sm text-gray-600">
                              <strong>Observaciones:</strong> {oc.observaciones}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 ml-4">
                      <span className="text-lg font-bold text-green-600">
                        ${oc.total.toFixed(2)}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setOrdenesExpanded((prev) => ({
                            ...prev,
                            [oc.id]: !prev[oc.id],
                          }));
                        }}
                      >
                        {ordenesExpanded[oc.id] ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setOrdenCopiadoEditando(oc);
                          setShowAsociarOCModal(true);
                        }}
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => {
                          if (confirm('¿Eliminar esta orden de copiado asociada?')) {
                            onOrdenesCopiadoAsociadasChange(
                              ordenesCopiadoAsociadas.filter((o) => o.id !== oc.id)
                            );
                          }
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      <UniversalAddItemWizard
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAgregar={handleAgregarItem}
      />

      <AddItemPersonalizadoOrdenModal
        isOpen={showAddPersonalizadoModal}
        onClose={() => setShowAddPersonalizadoModal(false)}
        onAdd={handleAgregarItemPersonalizado}
      />

      {clienteNombre && onOrdenesCopiadoAsociadasChange && (
        <AsociarOrdenCopiadoModal
          isOpen={showAsociarOCModal}
          onClose={() => {
            setShowAsociarOCModal(false);
            setOrdenCopiadoEditando(undefined);
          }}
          onGuardar={(nuevaOrden) => {
            if (ordenCopiadoEditando) {
              // Editar orden existente
              onOrdenesCopiadoAsociadasChange(
                ordenesCopiadoAsociadas.map((o) =>
                  o.id === ordenCopiadoEditando.id ? nuevaOrden : o
                )
              );
            } else {
              // Agregar nueva orden
              onOrdenesCopiadoAsociadasChange([
                ...ordenesCopiadoAsociadas,
                nuevaOrden,
              ]);
            }
            setOrdenCopiadoEditando(undefined);
          }}
          clienteNombre={clienteNombre}
          ordenEditando={ordenCopiadoEditando}
        />
      )}
    </div>
  );
}
