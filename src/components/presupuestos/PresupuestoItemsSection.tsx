import { useState } from 'react';
import { Plus, Trash2, Package, FileText, DollarSign, Wand2, CheckSquare, Square } from 'lucide-react';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { UniversalAddItemWizard } from '../wizard/UniversalAddItemWizard';
import { AddItemPersonalizadoModal } from './AddItemPersonalizadoModal';
import { AsignarPrecioModal } from './AsignarPrecioModal';
import { AplicarServicioMasivoModal } from '../orders/AplicarServicioMasivoModal';
import type { PresupuestoItem, ItemPendienteCotizacion } from '../../types/presupuestos';

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

export function PresupuestoItemsSection({
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

    const nuevoItem = {
      id: `service-${Date.now()}-${Math.random()}`, // Temp ID
      producto_nombre: `[Servicio] ${servicio.nombre}${nivel ? ` - ${nivel.nombre}` : ''}`,
      producto_categoria: 'Servicios',
      descripcion: descripcionDetallada,
      cantidad: 1,
      precio_unitario_final: precioTotalCalculado,
      precio_total: precioTotalCalculado, // Assuming qty 1 for the service line itself
      tiempo_produccion_dias: 0,
      tipo_item: 'item_personalizado',
      configuracion: {}
    };

    // Add to budget
    onAddItemSistema(nuevoItem); // reusing system add or custom add

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

                    {/* Descripción Breve */}
                    {item.descripcion ? (
                      <p className="text-xs text-gray-500 truncate max-w-lg">
                        {item.descripcion}
                      </p>
                    ) : (
                      <p className="text-xs text-gray-300 italic">Sin descripción</p>
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
                  <div className="w-10 flex justify-end">
                    <button
                      onClick={() => onDeleteItem(item.id)}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
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
          onClose={() => setShowWizard(false)}
          onAgregar={async (item) => {
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
