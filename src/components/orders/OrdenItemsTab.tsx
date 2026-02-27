import { useState, Dispatch, SetStateAction } from 'react';
import { Trash2, Plus, Calendar, Square, CheckSquare, ChevronUp, ChevronDown, Wand2, Edit2, Package, Printer } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Switch } from '../ui/Switch';
import { Badge } from '../ui/Badge';
import { Table } from '../ui/Table';
import { EmptyState } from '../ui/EmptyState';
import { Card } from '../ui/card';
import { UniversalAddItemWizard } from '../wizard/UniversalAddItemWizard';
import { AsociarOrdenCopiadoModal } from './AsociarOrdenCopiadoModal';
import { AddItemPersonalizadoOrdenModal } from './AddItemPersonalizadoOrdenModal';
import { AplicarServicioMasivoModal } from './AplicarServicioMasivoModal';
import { ItemConfigRenderer } from './ItemConfigRenderer';
import { generateProductionRoutes, normalizarEtapa } from '../../utils/generateProductionRoutes';
import { supabase } from '../../lib/supabase';

interface OrdenItem {
  id?: string;
  tipo_item?: 'catalogo' | 'personalizado' | 'centro_copiado';
  producto_id: string | null;
  producto_nombre: string;
  producto_categoria?: string;
  categoria_id?: string;
  descripcion?: string;
  tiempo_produccion_dias?: number;
  cantidad: number;
  configuracion: any;
  precio_base: number;
  precio_servicios: number;
  precio_acabados: number;
  precio_unitario_final: number | null;
  precio_total: number | null;
  descuento_individual?: number;
  rutas_generadas?: any[];
  metadata?: any;
}

interface OrdenItemsTabProps {
  items: OrdenItem[];
  setItems: Dispatch<SetStateAction<OrdenItem[]>>;
  descuentoTotal: number;
  setDescuentoTotal: (descuento: number) => void;
  requiereFactura?: boolean;
  setRequiereFactura?: (requiere: boolean) => void;
  clienteNombre?: string;
  ordenesCopiadoAsociadas?: any[];
  onOrdenesCopiadoAsociadasChange?: (ordenes: any[]) => void;
  mode?: 'orden' | 'presupuesto';
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
  mode = 'orden',
}: OrdenItemsTabProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAddPersonalizadoModal, setShowAddPersonalizadoModal] = useState(false);
  const [showAsociarOCModal, setShowAsociarOCModal] = useState(false);
  const [ordenCopiadoEditando, setOrdenCopiadoEditando] = useState<any>(undefined);
  const [ordenesExpanded, setOrdenesExpanded] = useState<Record<string, boolean>>({});

  // Edit State
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [itemToEdit, setItemToEdit] = useState<any>(null);

  // Selección Múltiple
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [showMasivoModal, setShowMasivoModal] = useState(false);

  const toggleSelectItem = (id: string) => {
    const newSelected = new Set(selectedItemIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedItemIds(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedItemIds.size === items.length) {
      setSelectedItemIds(new Set());
    } else {
      setSelectedItemIds(new Set(items.map(item => item.id || '')));
    }
  };

  const isAllSelected = items.length > 0 && selectedItemIds.size === items.length;

  const handleAplicarServicioMasivo = async (data: any) => {
    // Extraer datos del objeto recibido (interfaz ServicioSeleccionado)
    const { servicio, nivel, precioTotalCalculado } = data;

    // Generar ID Global para agrupar visualmente en producción
    const globalTaskId = globalThis.crypto ? globalThis.crypto.randomUUID() : `task-${Date.now()}`;

    // Paso 1: Obtener datos del paso a inyectar
    const pasoVinculado = nivel?.paso || servicio.pasos?.[0]?.paso;
    const pasoId = pasoVinculado?.id || (servicio.tiene_niveles_precio ? null : servicio.pasos?.[0]?.paso_id);

    // Paso 2: Identificar items afectados para descripción del item de cobro
    const itemsAfectados = items.filter(i => selectedItemIds.has(i?.id || ''));
    if (itemsAfectados.length === 0) return;

    // Paso 3: Modificar los items FÍSICOS (Inyectar Rutas de Producción)
    const newItems = await Promise.all(items.map(async (item) => {
      if (!selectedItemIds.has(item?.id || '')) return item;

      // Inyectar la ruta del servicio en el item físico
      let nuevasRutas = [...(item.rutas_generadas || [])];

      // Si no tiene rutas guardadas pero es un item que debería tenerlas (personalizado o con config)
      // las generamos ahora para "congelarlas" y añadirles el servicio masivo encima
      if (nuevasRutas.length === 0) {
        try {
          const generatedSteps = await generateProductionRoutes({
            productoId: item.producto_id || '',
            categoria: item.configuracion?.categoria || item.producto_categoria || 'Impresion Laser',
            configuracion: item.configuracion || {}
          });
          if (generatedSteps && generatedSteps.length > 0) {
            nuevasRutas = generatedSteps.map((s: any) => ({
              ...s,
              id: s.id || `gen-${Math.random()}`
            }));
          }
        } catch (err) {
          console.error('Error hydrating routes for mass service:', err);
        }
      }

      if (pasoId) {
        // Fetch real stage from DB to be 100% sure
        let etapaReal = pasoVinculado?.etapa || '';
        try {
          const { data: pasoDb } = await supabase
            .from('pasos')
            .select('etapa')
            .eq('id', pasoId)
            .single();
          if (pasoDb) {
            etapaReal = pasoDb.etapa;
          }
        } catch (err) {
          console.error('Error fetching real stage for service step:', err);
        }

        // Construir objeto ruta completo
        const nuevaRuta = {
          company_id: '',
          orden_item_id: '',
          tipo_etapa: normalizarEtapa(etapaReal),
          etapa: etapaReal || pasoVinculado?.estacion?.nombre || 'Servicios',
          id: `temp-step-${Math.random()}`,
          paso_id: pasoId,
          paso_nombre: pasoVinculado?.nombre || `[Servicio] ${servicio.nombre}`,
          orden: 0, // Prioridad 0 para que aparezca al inicio
          es_modificado: false,
          source_service_id: servicio.id,
          global_task_id: globalTaskId
        };

        // Insertamos al INICIO
        nuevasRutas.unshift(nuevaRuta);
      }

      return {
        ...item,
        // Importante: No tocamos el precio del item físico, se mantiene limpio.
        rutas_generadas: nuevasRutas,
        configuracion: {
          ...item.configuracion,
          tiene_servicios_externos: true
        }
      };
    }));

    // Paso 4: Crear el Item de COBRO (Servicio) con descripción detallada
    // Generar descripción
    const itemsList = itemsAfectados.slice(0, 5).map(i => {
      const medidas = i.configuracion?.medida_ancho ? `(${i.configuracion.medida_ancho}x${i.configuracion.medida_alto})` : '';
      return `- ${i.cantidad}x ${i.producto_nombre} ${medidas}`;
    });
    if (itemsAfectados.length > 5) itemsList.push(`... y ${itemsAfectados.length - 5} items más.`);

    const descripcionDetallada = `Aplicado a ${selectedItemIds.size} items:\n${itemsList.join('\n')}`;
    const nuevoPrecioTotal = precioTotalCalculado || 0;

    const servicioItem: OrdenItem = {
      id: `service-${Date.now()}-${Math.random()}`,
      tipo_item: 'personalizado',
      producto_nombre: `[Servicio] ${servicio.nombre}${nivel ? ` - ${nivel.nombre}` : ''}`,
      producto_id: null,
      cantidad: 1,
      precio_base: nuevoPrecioTotal,
      precio_servicios: 0,
      precio_acabados: 0,
      precio_unitario_final: nuevoPrecioTotal,
      precio_total: nuevoPrecioTotal,
      descuento_individual: 0,
      descripcion: descripcionDetallada,
      configuracion: {},
      rutas_generadas: [], // IMPORTANTE: Este item NO genera ruta propia, solo cobra. La ruta está en los items físicos.
      es_servicio_cobro: true, // Flag para ocultarlo en vistas de producción
      created_at: new Date().toISOString(),
      metadata: {
        linked_item_ids: Array.from(selectedItemIds)
      }
    } as any;

    setItems([...newItems, servicioItem]);
    setSelectedItemIds(new Set()); // Limpiar selección
    setShowMasivoModal(false);
  };

  const handleAgregarItem = async (itemData: any) => {

    const nuevoItem = {
      id: itemData.id || `temp-${Date.now()}-${Math.random()}`,
      tipo_item: itemData.tipo_item || 'catalogo',
      producto_id: itemData.producto_id,
      producto_nombre: itemData.producto_nombre,
      producto_categoria: itemData.producto_categoria,
      categoria_id: itemData.categoria_id,
      descripcion: itemData.descripcion,
      tiempo_produccion_dias: itemData.tiempo_produccion_dias,
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




    if (editingIndex !== null) {
      // Update existing
      // Preserve ID if it wasn't temp, or use new temp. Ideally preserve ID.
      // Actually, for consistency if we regenerate everything we might lose ID but it's likely better to keep the old ID if it exists?
      // But the Wizard generates new routes causing ID mismatches if we are not careful?
      // Let's keep the OLD ID if it wasn't temp, or keep temp ID. 
      // Actually, safeguard:
      const oldId = items[editingIndex].id;
      if (oldId && !oldId.startsWith('temp-')) {
        nuevoItem.id = oldId;
      }

      setItems(prev => {
        const newItems = [...prev];
        const oldId = prev[editingIndex].id;
        if (oldId && !oldId.startsWith('temp-')) {
          nuevoItem.id = oldId;
        }
        newItems[editingIndex] = nuevoItem;
        return newItems;
      });
      setEditingIndex(null);
      setItemToEdit(null);
    } else {
      setItems(prev => [...prev, nuevoItem]);
    }

    setShowAddModal(false);
  };

  const handleAgregarItemPersonalizado = async (itemData: {
    producto_nombre: string;
    descripcion: string;
    cantidad: number;
    precio_unitario_final: number | null;
    categoria_id?: string;
    ruta_produccion_id?: string;
  }) => {
    const isPending = itemData.precio_unitario_final === null;

    // Obtener nombre de categoría si existe para mayor claridad en la UI
    let categoriaNombre = 'Personalizado';
    if (itemData.categoria_id) {
      const { data: cat } = await supabase
        .from('categorias')
        .select('nombre')
        .eq('id', itemData.categoria_id)
        .single();
      if (cat) categoriaNombre = (cat as any).nombre;
    }

    // Generar rutas si hay ruta_produccion_id
    let rutasGeneradas: any[] = [];
    if (itemData.ruta_produccion_id) {
      try {
        rutasGeneradas = await generateProductionRoutes({
          productoId: '', // Es personalizado, no viene de catálogo
          categoria: categoriaNombre,
          configuracion: {
            ruta_produccion_id: itemData.ruta_produccion_id
          }
        });
      } catch (err) {
        console.error('Error generating routes for custom item:', err);
      }
    }

    const nuevoItem: any = {
      id: editingIndex !== null ? items[editingIndex].id : `temp-${Date.now()}-${Math.random()}`,
      tipo_item: 'personalizado',
      producto_id: null,
      producto_nombre: itemData.producto_nombre,
      producto_categoria: categoriaNombre,
      descripcion: itemData.descripcion,
      cantidad: itemData.cantidad,
      precio_base: 0,
      precio_servicios: 0,
      precio_acabados: 0,
      precio_unitario_final: itemData.precio_unitario_final,
      precio_total: isPending ? null : (itemData.cantidad * (itemData.precio_unitario_final || 0)),
      descuento_individual: 0,
      rutas_generadas: rutasGeneradas,
      configuracion: {
        tipo_item: 'personalizado',
        descripcion: itemData.descripcion,
        categoria_id: itemData.categoria_id,
        ruta_produccion_id: itemData.ruta_produccion_id,
        _rutas_snapshot: rutasGeneradas
      },
    };

    if (editingIndex !== null) {
      const newItems = [...items];
      newItems[editingIndex] = nuevoItem;
      setItems(newItems);
      setEditingIndex(null);
      setItemToEdit(null);
    } else {
      setItems([...items, nuevoItem]);
    }

    setShowAddPersonalizadoModal(false);
  };

  const handleEditarItem = (index: number) => {
    const item = items[index];
    setEditingIndex(index);
    setItemToEdit(item);

    if (item.tipo_item === 'personalizado') {
      setShowAddPersonalizadoModal(true);
    } else {
      setShowAddModal(true);
    }
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
    if (item.precio_unitario_final !== null) {
      item.precio_total = item.precio_unitario_final * nuevaCantidad;
    }
    setItems(itemsCopy);
  };

  const handleDescuentoIndividualChange = (index: number, descuento: number) => {
    const itemsCopy = [...items];
    const item = itemsCopy[index];
    item.descuento_individual = descuento;

    const precioSinDescuento = (item.precio_unitario_final || 0) * item.cantidad;
    const descuentoAplicado = precioSinDescuento * (descuento / 100);
    if (item.precio_total !== null) {
      item.precio_total = precioSinDescuento - descuentoAplicado;
    }

    setItems(itemsCopy);
  };

  const handleIdentificadorInternoChange = (index: number, identificador: string) => {
    setItems((prev) => {
      const next = [...prev];
      const currentItem = next[index];
      const currentConfig = currentItem.configuracion || {};
      next[index] = {
        ...currentItem,
        configuracion: {
          ...currentConfig,
          identificador_interno: identificador,
        },
      };
      return next;
    });
  };



  const columns = [
    {
      key: 'select',
      header: (
        <div className="flex items-center justify-center">
          <button
            onClick={toggleSelectAll}
            className="text-gray-500 hover:text-blue-600 focus:outline-none"
          >
            {isAllSelected ? <CheckSquare className="w-5 h-5 text-blue-600" /> : <Square className="w-5 h-5" />}
          </button>
        </div>
      ),
      render: (item: OrdenItem) => (
        <div className="flex items-center justify-center">
          <button
            onClick={() => item.id && toggleSelectItem(item.id)}
            className="text-gray-400 hover:text-blue-600 focus:outline-none"
          >
            {item.id && selectedItemIds.has(item.id) ? (
              <CheckSquare className="w-5 h-5 text-blue-600" />
            ) : (
              <Square className="w-5 h-5" />
            )}
          </button>
        </div>
      ),
      width: '50px'
    },
    {
      key: 'cantidad',
      header: 'Cantidad',
      render: (item: OrdenItem) => (
        <div className="text-center font-bold text-gray-900">
          {item.cantidad}
        </div>
      ),
      width: '80px'
    },
    {
      key: 'producto',
      header: 'Item y Configuración',
      render: (item: OrdenItem, index: number) => (
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="font-medium text-gray-900">{item.producto_nombre}</div>
            {/* Clasificación de Categoría y Tipo */}
            {(item.tipo_item === 'centro_copiado' || item.producto_categoria === 'Centro de Copiado' || item.categoria_id === 'centro_copiado') ? (
              <Badge variant="blue" className="bg-blue-100 text-blue-800" size="sm">
                Centro de Copiado
              </Badge>
            ) : (
              <>
                {item.tipo_item === 'personalizado' && !item.configuracion?.es_compuesto && (
                  <Badge variant="purple" size="sm">
                    {item.producto_categoria || 'Personalizado'}
                  </Badge>
                )}
                {item.configuracion?.es_compuesto && (
                  <Badge variant="blue" className="bg-blue-100 text-blue-800" size="sm">
                    {item.producto_categoria || 'Compuesto'}
                  </Badge>
                )}
              </>
            )}
          </div>
          <div className="mb-2">
            <Input
              type="text"
              value={item.configuracion?.identificador_interno || ''}
              onChange={(e) => handleIdentificadorInternoChange(index, e.target.value)}
              placeholder="Identificador interno (ej: Modelo A)"
              className="h-8 text-xs"
              maxLength={80}
            />
          </div>
          {item.tipo_item === 'personalizado' && !item.configuracion?.es_compuesto && item.descripcion ? (
            <div className="text-sm text-gray-600 whitespace-pre-wrap">
              {item.descripcion}
            </div>
          ) : (
            <ItemConfigRenderer
              config={item.configuracion}
              rutasGeneradas={item.rutas_generadas}
              tipoItem={item.tipo_item}
            />
          )}
        </div>
      ),
    },
    {
      key: 'precio_unitario',
      header: 'Precio Unitario',
      render: (item: OrdenItem) => (
        <span className="font-medium">
          {item.precio_unitario_final !== null ? `$${item.precio_unitario_final.toFixed(2)}` : '-'}
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
            className="w-20 text-center"
            placeholder="0"
          />
          <span className="text-sm text-gray-500">%</span>
        </div>
      ),
      width: '120px'
    },
    {
      key: 'iva',
      header: 'IVA (21%)',
      hidden: !requiereFactura,
      render: (item: OrdenItem) => (
        <span className="text-gray-500 text-sm">
          ${item.precio_total !== null ? (item.precio_total * 0.21).toFixed(2) : '-'}
        </span>
      ),
    },
    {
      key: 'precio_total',
      header: 'Subtotal',
      render: (item: OrdenItem) => (
        <span className="font-semibold text-blue-600">
          {item.precio_total !== null ? `$${item.precio_total.toFixed(2)}` : (
            <Badge variant="warning" className="text-xs">Cotizar</Badge>
          )}
        </span>
      ),
    },
    {
      key: 'acciones',
      header: '',
      render: (_: OrdenItem, index: number) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleEditarItem(index)}
            className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-2"
            title="Editar"
          >
            <Edit2 className="w-4 h-4" />
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={() => handleEliminarItem(index)}
            title="Eliminar"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      ),
      width: '90px'
    },
  ].filter(col => !col.hidden);

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
              <span className="text-sm text-gray-700">IVA 21%</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <Button onClick={() => {
              setEditingIndex(null);
              setItemToEdit(null);
              setShowAddModal(true);
            }}>
              <Plus className="w-4 h-4" />
              Catálogo
            </Button>
            <Button
              onClick={() => {
                setEditingIndex(null);
                setItemToEdit(null);
                setShowAddPersonalizadoModal(true);
              }}
              variant="outline"
              className="border-dashed"
            >
              <Plus className="w-4 h-4" />
              Personalizado
            </Button>
          </div>
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
                          {oc.items.map((item: any, idx: number) => {
                            // Handle both hydrated config and direct DB item structure
                            const copies = item.config?.cantidad_copias || item.cantidad_unidades || 1;
                            const sheets = item.config?.cantidad_hojas || item.cantidad_hojas || 0;
                            const inkType = item.config?.tipo_tinta || item.tipo_tinta;
                            const price = item.precio || item.subtotal || 0;

                            return (
                              <div
                                key={item.id}
                                className="text-sm text-gray-700 flex items-center gap-2"
                              >
                                <Badge variant="default" size="sm">
                                  {idx + 1}
                                </Badge>
                                <span>
                                  {copies} copias •{' '}
                                  {sheets} hojas •{' '}
                                  {inkType === 'CMYK'
                                    ? 'Full Color'
                                    : inkType === 'COLOR'
                                      ? 'Color'
                                      : 'Blanco y Negro'}
                                  {item.descripcion && ` • ${item.descripcion}`}
                                </span>
                                <span className="ml-auto font-medium text-green-600">
                                  ${(price).toFixed(2)}
                                </span>
                              </div>
                            )
                          })}
                          {oc.observaciones && (
                            <div className="mt-2 p-2 bg-white rounded text-sm text-gray-600">
                              <strong>Observaciones:</strong> {oc.observaciones}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 ml-4">
                      <div className="flex flex-col items-end gap-1">
                        {requiereFactura ? (
                          <>
                            <div className="text-right">
                              <span className="text-xs text-gray-500 block">Subtotal: ${oc.total.toFixed(2)}</span>
                              <span className="text-xs text-gray-500 block">IVA (21%): ${(oc.total * 0.21).toFixed(2)}</span>
                            </div>
                            <span className="text-lg font-bold text-green-600">
                              ${(oc.total * 1.21).toFixed(2)}
                            </span>
                          </>
                        ) : (
                          <span className="text-lg font-bold text-green-600">
                            ${oc.total.toFixed(2)}
                          </span>
                        )}
                      </div>
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
      )
      }

      <UniversalAddItemWizard
        isOpen={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          setEditingIndex(null);
          setItemToEdit(null);
        }}
        onAgregar={handleAgregarItem}
        initialData={itemToEdit}
        isEditing={editingIndex !== null}
      />

      <AddItemPersonalizadoOrdenModal
        isOpen={showAddPersonalizadoModal}
        onClose={() => {
          setShowAddPersonalizadoModal(false);
          setEditingIndex(null);
          setItemToEdit(null);
        }}
        onAdd={handleAgregarItemPersonalizado}
        initialData={itemToEdit}
        isEditing={!!itemToEdit}
        mode={mode}
      />

      {
        clienteNombre && onOrdenesCopiadoAsociadasChange && (
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
            ordenEditando={ordenCopiadoEditando}
          />
        )
      }

      {/* Toolbar de Acciones Masivas */}
      {
        selectedItemIds.size > 0 && (
          <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-white border border-blue-200 shadow-xl rounded-full px-6 py-3 flex items-center gap-4 z-50 animate-in fade-in slide-in-from-bottom-4">
            <div className="text-sm font-medium text-gray-700 border-r pr-4 mr-2">
              {selectedItemIds.size} items seleccionados
            </div>

            <Button
              onClick={() => setShowMasivoModal(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white rounded-full px-6"
              size="sm"
            >
              <Wand2 className="w-4 h-4 mr-2" />
              Aplicar Servicio
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedItemIds(new Set())}
              className="text-gray-500 hover:text-gray-700"
            >
              Cancelar
            </Button>
          </div>
        )
      }

      <AplicarServicioMasivoModal
        isOpen={showMasivoModal}
        onClose={() => setShowMasivoModal(false)}
        selectedCount={selectedItemIds.size}
        onAplicar={handleAplicarServicioMasivo}
        selectedItems={items.filter(item => selectedItemIds.has(item.id || ''))}
      />
    </div >
  );
}
