import { useState } from 'react';
import { Plus, Trash2, Package, FileText, DollarSign, Wand2, CheckSquare, Square, Printer, Edit2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { UniversalAddItemWizard } from '../wizard/UniversalAddItemWizard';
import { AddItemPersonalizadoModal } from './AddItemPersonalizadoModal';
import { AsignarPrecioModal } from './AsignarPrecioModal';
import { AplicarServicioMasivoModal } from '../orders/AplicarServicioMasivoModal';
import { AsociarOrdenCopiadoModal } from '../orders/AsociarOrdenCopiadoModal';
import type { PresupuestoItem, ItemPendienteCotizacion } from '../../types/presupuestos';
import { Badge } from '../ui/Badge';

interface PresupuestoItemsSectionProps {
  items: PresupuestoItem[];
  onAddItemSistema: (item: any) => void;
  onAddItemPersonalizado: (item: {
    producto_nombre: string;
    descripcion: string;
    cantidad: number;
    precio_unitario_final?: number | null;
  }) => void;
  onEditItem: (id: string, updates: any) => void;
  onDeleteItem: (id: string) => void;
  onAsignarPrecio: (itemId: string, precioUnitario: number) => Promise<boolean>;
}

// Helper to render config details
// Helper to render config details
// Helper to render config details
const renderConfiguracion = (config: any, tipoItem?: string) => {
  if (!config) return null;

  // Lógica específica para Centro de Copiado
  if (tipoItem === 'centro_copiado') {
    return (
      <div className="space-y-1 text-xs text-gray-600 mt-1">
        {/* Info Copias/Hojas */}
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-900">{config.cantidad_copias} juegos</span>
          <span className="text-gray-300">|</span>
          <span>{config.cantidad_hojas} hojas orig.</span>
        </div>

        {/* Info Papel/Tinta */}
        <div className="flex flex-wrap gap-1.5 mt-1">
          {config.tamanio_nombre && <Badge variant="outline" className="text-[10px] h-5">{config.tamanio_nombre}</Badge>}
          {config.papel_detalle && <Badge variant="outline" className="text-[10px] h-5">{config.papel_detalle}</Badge>}
          <Badge variant={config.tipo_tinta === 'CMYK' || config.tipo_tinta === 'color' ? 'purple' : 'gray'} className="text-[10px] h-5">
            {config.tipo_tinta === 'CMYK' || config.tipo_tinta === 'color' ? 'Color' : 'B/N'}
          </Badge>
          <Badge variant="outline" className="text-[10px] h-5">
            {config.cara_impresa === 'frente_y_dorso' || config.cara_impresa === 'doble' || config.cara_impresa === '1/1' ? 'Doble Faz' : 'Simple Faz'}
          </Badge>
        </div>

        {/* Terminaciones (Anillado, Plastificado, Guillotinado) */}
        {(config.anillado || config.plastificado || config.guillotinado || config.abrochado || config.corte || config.dobladillo) && (
          <div className="flex flex-wrap gap-1.5 mt-1">
            {config.anillado && (
              <Badge variant="warning" size="sm" className="text-[10px] h-5 px-1.5">Anillado {config.anillado.tipo}</Badge>
            )}
            {config.plastificado && (
              <Badge variant="warning" size="sm" className="text-[10px] h-5 px-1.5">Plastificado {config.plastificado.tipo}</Badge>
            )}
            {config.guillotinado && (
              <Badge variant="warning" size="sm" className="text-[10px] h-5 px-1.5">Guillotinado</Badge>
            )}
            {config.abrochado && (
              <Badge variant="warning" size="sm" className="text-[10px] h-5 px-1.5">Abrochado</Badge>
            )}
            {config.corte && (
              <Badge variant="warning" size="sm" className="text-[10px] h-5 px-1.5">Corte</Badge>
            )}
            {config.dobladillo && (
              <Badge variant="warning" size="sm" className="text-[10px] h-5 px-1.5">Dobladillo</Badge>
            )}
          </div>
        )}

        {/* Servicios y Acabados Extra */}
        {((config.servicios_seleccionados && config.servicios_seleccionados.length > 0) ||
          (config.acabados_seleccionados && config.acabados_seleccionados.length > 0)) && (
            <div className="flex flex-wrap gap-1 mt-1 pt-1 border-t border-gray-100">
              {config.servicios_seleccionados?.map((s: any, idx: number) => (
                <Badge key={`srv-${idx}`} variant="blue" size="sm" className="text-[10px] px-1.5 h-auto py-0.5">
                  {s.nivel ? `${s.nombre} (${s.nivel})` : s.nombre}
                </Badge>
              ))}
              {config.acabados_seleccionados?.map((a: any, idx: number) => (
                <Badge key={`acb-${idx}`} variant="purple" size="sm" className="text-[10px] px-1.5 h-auto py-0.5">
                  {a.nombre}
                </Badge>
              ))}
            </div>
          )}
      </div>
    );
  }

  // Standard Render Logic (Existing)
  const hasServices = (config.servicios_seleccionados && config.servicios_seleccionados.length > 0) ||
    (config.acabados_seleccionados && config.acabados_seleccionados.length > 0);

  if (!hasServices) return null;

  return (
    <div className="space-y-1 mt-0.5">
      {/* Services Badges */}
      <div className="flex flex-wrap gap-1 mt-1">
        {config.servicios_seleccionados?.map((s: any, idx: number) => (
          <Badge key={`srv-${idx}`} variant="blue" size="sm" className="text-[10px] px-1.5 h-auto py-0.5">
            {s.nivel ? `${s.nombre} (${s.nivel})` : s.nombre}
          </Badge>
        ))}
        {config.acabados_seleccionados?.map((a: any, idx: number) => (
          <Badge key={`acb-${idx}`} variant="purple" size="sm" className="text-[10px] px-1.5 h-auto py-0.5">
            {a.nombre}
          </Badge>
        ))}
      </div>
    </div>
  );
};

export function PresupuestoItemsSection({
  // ... rest of component

  items,
  onAddItemSistema,
  onAddItemPersonalizado,
  onEditItem,
  onDeleteItem,
  onAsignarPrecio,
}: PresupuestoItemsSectionProps) {
  const [showWizard, setShowWizard] = useState(false);
  const [showPersonalizadoModal, setShowPersonalizadoModal] = useState(false);
  const [itemParaAsignarPrecio, setItemParaAsignarPrecio] = useState<ItemPendienteCotizacion | null>(null);

  // Edit State
  const [editingItem, setEditingItem] = useState<PresupuestoItem | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null); // Fallback if ID is missing (temp items)
  const [editingType, setEditingType] = useState<'sistema' | 'personalizado'>('sistema');

  // Mass Selection State
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
      // Ensure we only select items that have an ID. If items don't have IDs, this feature won't work well.
      // Assuming items usually have IDs or we can default to index if stable (risky).
      // For now, filter items with IDs.
      setSelectedItemIds(new Set(items.map(item => item.id).filter(Boolean) as string[]));
    }
  };

  const isAllSelected = items.length > 0 && selectedItemIds.size === items.length;

  const handleAplicarServicioMasivo = async (data: any) => {
    const { servicio, nivel, precioTotalCalculado } = data;

    // Create a new "Service" item
    // We treat it as a 'item_personalizado' or similar. 
    // In Presupuestos, usually we add items via onAddItemSistema or Custom.
    // We will construct a custom item object.

    const itemsAfectados = items.filter(i => i.id && selectedItemIds.has(i.id));

    // Description Generation
    const itemsList = itemsAfectados.slice(0, 5).map(i => {
      // Try to find dimensions in config if possible
      return `- ${i.cantidad}x ${i.producto_nombre}`;
    });
    if (itemsAfectados.length > 5) itemsList.push(`... y ${itemsAfectados.length - 5} items más.`);

    const descripcionDetallada = `Aplicado a ${selectedItemIds.size} items:\n${itemsList.join('\n')}`;

    // 1. Create the new "Service" item (Billing Line)
    const nuevoItem = {
      id: `service-${Date.now()}-${Math.random()}`, // Temp ID
      producto_nombre: `[Servicio] ${servicio.nombre}${nivel ? ` - ${nivel.nombre}` : ''}`,
      producto_categoria: 'Servicios',
      descripcion: descripcionDetallada,
      cantidad: 1,
      precio_unitario_final: precioTotalCalculado,
      precio_total: precioTotalCalculado,
      tiempo_produccion_dias: 0,
      tipo_item: 'item_personalizado',
      configuracion: {
        es_servicio_global: true,
        servicio_id: servicio.id,
        nivel_id: nivel?.id,
        tipo_impacto: 'precio_fijo'
      }
    };

    // Add service line to budget
    onAddItemSistema(nuevoItem);

    // 2. Update Target Items Configuration (So they generate routes with this service)
    itemsAfectados.forEach(item => {
      if (!item.id) return;

      const currentConfig = item.configuracion || {};
      const currentServices = currentConfig.servicios_seleccionados || [];

      const newServiceEntry = {
        servicio_id: servicio.id,
        nombre: servicio.nombre,
        nivel: nivel?.nombre,
        tipo_impacto: 'precio_fijo' // Metadata useful for route generation
      };

      // Update item
      onEditItem(item.id, {
        configuracion: {
          ...currentConfig,
          servicios_seleccionados: [...currentServices, newServiceEntry]
        }
      });
    });

    setSelectedItemIds(new Set());
    setShowMasivoModal(false);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
    }).format(value);
  };

  const getTotalItems = () => {
    return items.reduce((sum, item) => {
      return sum + (item.precio_total !== null ? Number(item.precio_total) : 0);
    }, 0);
  };

  const getItemsConPrecio = () => {
    return items.filter(item => item.precio_total !== null);
  };

  const getItemsSinPrecio = () => {
    return items.filter(item => item.precio_total === null);
  };

  const itemsSinPrecio = getItemsSinPrecio();
  const itemsConPrecio = getItemsConPrecio();



  /* State for Copy Center Modal */
  const [showCopiadoModal, setShowCopiadoModal] = useState(false);

  const handleAgregarOrdenCopiado = (ordenCopiado: any) => {
    // ordenCopiado conforms to OrdenCopiadoTemporal interface from the modal

    ordenCopiado.items.forEach((item: any) => {
      const cantidad = item.config.cantidad_copias || 1;
      const hojas = item.config.cantidad_hojas || 1;

      // Construir nombre legible y corto
      const tamanioName = item.config.tamanio_nombre || (String(item.config.tamanio_papel_id).length > 20 ? 'Standard' : item.config.tamanio_papel_id); // Usually it's an ID, getting name is hard without lookup. 
      // Actually CentroCopiadoItemForm handles IDs but displays Names. The modal returns config with IDs. 
      // We will rely on description if provided, otherwise generic.
      // But we can extract some info.

      const tipoTinta = item.config.tipo_tinta === 'CMYK' ? 'Color' : 'B/N';
      const nombreItem = `Copias ${tipoTinta} - ${tamanioName}`;

      const papelNombre = item.config.papel_detalle || item.config.papel_id;

      const detalleTecnico = [
        `Papel: ${papelNombre}`,
        `Caras: ${item.config.cara_impresa === 'frente_y_dorso' ? 'Doble Faz' : 'Simple Faz'}`,
        `Hojas orig: ${hojas}`,
        item.config.abrochado ? 'Abrochado' : null,
        item.config.anillado ? 'Anillado' : null,
        item.config.corte ? 'Corte' : null,
        item.config.dobladillo ? 'Dobladillo' : null,
      ].filter(Boolean).join(' | ');

      const fullDescription = `${item.descripcion || ''}\n${detalleTecnico}`.trim();

      // Fix price calculation
      const precioTotal = item.precio || 0;
      const precioUnitario = cantidad > 0 ? (precioTotal / cantidad) : 0;

      onAddItemSistema({
        tipo_item: 'centro_copiado', // Now supported by types and DB
        producto_nombre: nombreItem,
        producto_categoria: 'Centro de Copiado',
        descripcion: fullDescription,
        cantidad: cantidad,
        precio_unitario_final: precioUnitario,
        precio_total: precioTotal,
        configuracion: item.config // Store full config for reconstruction/conversion
      });
    });

    setShowCopiadoModal(false);
  };

  const handleEditItem = (item: PresupuestoItem, index: number) => {
    setEditingItem(item);
    setEditingIndex(index);

    if (item.tipo_item === 'item_personalizado') {
      setEditingType('personalizado');
      setShowPersonalizadoModal(true);
    } else if (item.tipo_item === 'centro_copiado') {
      // Centro de copiado editing is not fully implemented in this pass for Presupuestos yet, 
      // as it requires hydrating the complex Copiado modal.
      // We will skip or show alert, or just support basic edit if possible.
      // For now, let's focus on Sistema and Personalizado.
      alert('La edición de items de Centro de Copiado está en desarrollo.');
      setEditingItem(null);
      setEditingIndex(null);
    } else {
      // Assume sistema
      setEditingType('sistema');
      setShowWizard(true);
    }
  };

  const handleWizardAdd = async (itemData: any) => {
    if (editingItem && editingIndex !== null) {
      // Editing existing item
      // We need to construct the update object.
      // The page handles updates via onEditItem(id, updates).
      // However, onAddItemSistema in parent usually constructs the full object.
      // We might need to ask the page to "Update" the item.
      // But `onEditItem` signature is (id, updates).
      // If we have a fully new itemData from wizard, we should probably map it to fields.

      /* 
         NOTE: The wizard returns a structure like:
         { producto_id, cantidad, configuracion, precio_..., rutas_generadas }
      */

      const updates = {
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
        rutas_generadas: itemData.rutas_generadas,
        // We should ideally generate a new description too?
        // The Page logic `handleAddItemSistema` does `generarDescripcionCompleta`.
        // We should probably replicate that or assume the Page `onEditItem` handles it?
        // Actually `onEditItem` in Page just sets state. It doesn't regenerate desc.
        // We might want to handle this better in the Page or here.
        // For now, let's pass the raw data and let the modal close.
        // BUT: `onEditItem` expects an ID. If item has no ID (temp in creation), we use index?
        // The prop `onEditItem` takes (id: string).
        // If we are in "Create" mode, items have temporary IDs (e.g. `temp-${Date.now()}`).
        // So we can use editingItem.id.
      };

      if (editingItem.id) {
        onEditItem(editingItem.id, updates);
      }
    } else {
      onAddItemSistema(itemData);
    }
    setShowWizard(false);
    setEditingItem(null);
    setEditingIndex(null);
  };

  const handlePersonalizadoAdd = (itemData: any) => {
    if (editingItem && editingItem.id) {
      const updates = {
        producto_nombre: itemData.producto_nombre,
        descripcion: itemData.descripcion,
        cantidad: itemData.cantidad,
        precio_unitario_final: itemData.precio_unitario_final,
        // calc total
        precio_total: itemData.precio_unitario_final !== null ? (itemData.cantidad * itemData.precio_unitario_final) : null
      };
      onEditItem(editingItem.id, updates);
    } else {
      onAddItemPersonalizado(itemData);
    }
    setShowPersonalizadoModal(false);
    setEditingItem(null);
    setEditingIndex(null);
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
          {items.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleSelectAll}
              className={isAllSelected ? "text-blue-600 bg-blue-50" : "text-gray-500"}
            >
              {isAllSelected ? <CheckSquare className="w-4 h-4 mr-2" /> : <Square className="w-4 h-4 mr-2" />}
              {isAllSelected ? 'Deseleccionar' : 'Seleccionar Todo'}
            </Button>
          )}
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
            Agregar Item
          </Button>
        </div>
      </div>

      {/* Empty State */}
      {items.length === 0 && (
        <EmptyState
          icon={Package}
          title="No hay items agregados"
          description="Agrega productos del catálogo, centro de copiado o items personalizados"
        />
      )}

      {/* Items List - Compact Table Layout */}
      {items.length > 0 && (
        <div className="border rounded-xl overflow-hidden shadow-sm">
          {/* Table Header */}
          <div className="bg-gray-50/80 border-b border-gray-200 px-4 py-3 flex gap-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
            <div className="mt-1 mr-2"><Square className="w-4 h-4 opacity-0" /></div> {/* Spacer for checkbox */}
            <div className="flex-1">Producto / Descripción</div>
            <div className="w-32 text-right">Cantidad</div>
            <div className="w-32 text-right">Unitario</div>
            <div className="w-32 text-right">Total</div>
            <div className="w-10"></div> {/* Spacer for actions */}
          </div>

          <div className="divide-y divide-gray-100 bg-white">
            {items.map((item, index) => {
              const sinPrecio = item.precio_unitario_final === null || item.precio_total === null;

              return (
                <div
                  key={item.id || index}
                  className={`group flex items-center gap-4 px-4 py-3 hover:bg-gray-50 transition-colors ${item.id && selectedItemIds.has(item.id) ? 'bg-blue-50/50' : ''
                    }`}
                >
                  {/* Selection Checkbox */}
                  <div className="mt-0.5">
                    <button
                      onClick={() => toggleSelectItem(item.id || '')}
                      className="text-gray-300 hover:text-blue-600 focus:outline-none transition-colors"
                    >
                      {item.id && selectedItemIds.has(item.id) ? (
                        <CheckSquare className="w-5 h-5 text-blue-600" />
                      ) : (
                        <Square className="w-5 h-5" />
                      )}
                    </button>
                  </div>

                  <div className="flex-1 min-w-0">
                    {/* Nombre y Badges */}
                    <div className="flex items-center gap-2 mb-0.5">
                      <h3 className="font-semibold text-gray-900 text-sm truncate">
                        {item.producto_nombre}
                      </h3>
                      {sinPrecio && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                          Pendiente
                        </span>
                      )}
                      {item.tipo_item === 'item_personalizado' && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                          Personalizado
                        </span>
                      )}
                      {item.producto_categoria && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                          {item.producto_categoria}
                        </span>
                      )}
                    </div>

                    {/* Configuración y Badges de Servicios */}
                    {renderConfiguracion(item.configuracion, item.tipo_item)}

                    {/* Descripción Breve */}
                    {item.descripcion ? (
                      <p className="text-xs text-gray-500 truncate max-w-lg mt-0.5">
                        {item.descripcion}
                      </p>
                    ) : (
                      <p className="text-xs text-gray-300 italic mt-0.5">Sin descripción</p>
                    )}
                  </div>

                  {/* Columna Cantidad */}
                  <div className="w-32 text-right text-sm text-gray-700">
                    {item.cantidad} <span className="text-xs text-gray-400">unid.</span>
                  </div>

                  {/* Columna Unitario */}
                  <div className="w-32 text-right text-sm text-gray-700">
                    {sinPrecio ? '-' : formatCurrency(item.precio_unitario_final!)}
                  </div>

                  {/* Columna Total y Acciones si precio pendiente */}
                  <div className="w-32 text-right">
                    {sinPrecio ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-2 py-1 h-auto"
                        onClick={() => setItemParaAsignarPrecio({
                          id: item.id,
                          producto_nombre: item.producto_nombre,
                          descripcion: item.descripcion,
                          cantidad: item.cantidad,
                          configuracion: item.configuracion,
                        })}
                      >
                        <DollarSign className="w-3 h-3 mr-1" />
                        Cotizar
                      </Button>
                    ) : (
                      <span className="font-bold text-gray-900 text-sm">
                        {formatCurrency(item.precio_total!)}
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="w-10 flex flex-col items-end gap-1">
                    <button
                      onClick={() => handleEditItem(item, index)}
                      className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                      title="Editar"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => item.id && onDeleteItem(item.id)}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                      title="Eliminar"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Total */}
      {items.length > 0 && (
        <div className={`rounded-lg p-4 border ${itemsSinPrecio.length > 0
          ? 'bg-yellow-50 border-yellow-200'
          : 'bg-gray-50 border-gray-200'
          }`}>
          <div className="flex items-center justify-between">
            <div>
              {itemsSinPrecio.length > 0 ? (
                <>
                  <span className="text-sm font-medium text-yellow-900">
                    Subtotal Parcial ({itemsConPrecio.length} de {items.length} items con precio)
                  </span>
                  <p className="text-xs text-yellow-700 mt-1">
                    {itemsSinPrecio.length} item(s) pendiente(s) de cotizar
                  </p>
                </>
              ) : (
                <span className="text-sm text-gray-600">
                  Subtotal ({items.length} items)
                </span>
              )}
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-gray-900">
                {formatCurrency(getTotalItems())}
              </div>
              {itemsSinPrecio.length > 0 && (
                <p className="text-xs text-yellow-700 mt-1">
                  + Items por cotizar
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Wizard */}
      {showWizard && (
        <UniversalAddItemWizard
          isOpen={showWizard}
          onClose={() => {
            setShowWizard(false);
            setEditingItem(null);
            setEditingIndex(null);
          }}
          onAgregar={handleWizardAdd}
          initialData={editingItem}
          isEditing={!!editingItem}
        />
      )}

      {/* Modal Personalizado */}
      <AddItemPersonalizadoModal
        isOpen={showPersonalizadoModal}
        onClose={() => {
          setShowPersonalizadoModal(false);
          setEditingItem(null);
          setEditingIndex(null);
        }}
        onAdd={handlePersonalizadoAdd}
        initialData={editingItem}
        isEditing={!!editingItem}
      />

      {/* Modal Centro de Copiado */}
      <AsociarOrdenCopiadoModal
        isOpen={showCopiadoModal}
        onClose={() => setShowCopiadoModal(false)}
        onGuardar={handleAgregarOrdenCopiado}
        clienteNombre="Cliente del Presupuesto" // In specific Budget flow we might not have client name loaded in this component directly if not passed props, but we will assume generic or check props.
      // Actually props has no client name. It's fine, the modal uses it for display only.
      />

      {/* Modal Asignar Precio */}
      {itemParaAsignarPrecio && (
        <AsignarPrecioModal
          item={itemParaAsignarPrecio}
          onAsignar={onAsignarPrecio}
          onClose={() => setItemParaAsignarPrecio(null)}
        />
      )}

      {/* Toolbar de Acciones Masivas */}
      {selectedItemIds.size > 0 && (
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
      )}

      {/* Modal Masivo */}
      <AplicarServicioMasivoModal
        isOpen={showMasivoModal}
        onClose={() => setShowMasivoModal(false)}
        selectedItems={items.filter(i => i.id && selectedItemIds.has(i.id))}
        onConfirm={handleAplicarServicioMasivo}
      />
    </div>
  );
}
