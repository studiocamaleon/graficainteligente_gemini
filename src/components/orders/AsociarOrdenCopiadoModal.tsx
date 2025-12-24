import { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, FileText } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { DatePicker } from '../ui/DatePicker';
import { CentroCopiadoItemForm, ItemCopiadoConfig } from '../centro-copiado/CentroCopiadoItemForm';

interface ItemCopiadoWithId {
  id: string;
  config: Partial<ItemCopiadoConfig>;
  precio?: number;
  descripcion?: string;
}

interface OrdenCopiadoTemporal {
  id: string;
  items: ItemCopiadoWithId[];
  fecha_entrega_estimada?: string;
  observaciones?: string;
  total: number;
}

interface AsociarOrdenCopiadoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGuardar: (orden: OrdenCopiadoTemporal) => void;
  ordenEditando?: OrdenCopiadoTemporal;
}

export function AsociarOrdenCopiadoModal({
  isOpen,
  onClose,
  onGuardar,
  ordenEditando,
}: AsociarOrdenCopiadoModalProps) {
  const [fechaEntrega, setFechaEntrega] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [items, setItems] = useState<ItemCopiadoWithId[]>([]);
  const [itemsCollapsed, setItemsCollapsed] = useState<Record<string, boolean>>({});
  const [errorValidacion, setErrorValidacion] = useState('');

  // Inicializar con datos de edición si existen
  useEffect(() => {
    if (ordenEditando) {
      // Si la orden viene de DB, los items pueden no tener 'config' (estructura plana)
      // Necesitamos hidratar la config desde las propiedades planas
      const itemsHydrated: ItemCopiadoWithId[] = ordenEditando.items.map((item: any) => {
        if (item.config) return item; // Ya tiene formato correcto

        // Hidratar desde DB flat structure
        return {
          id: item.id,
          precio: item.precio || item.subtotal || 0,
          descripcion: item.descripcion,
          config: {
            tamanio_papel_id: item.tamanio_papel_id,
            papel_id: item.papel_id,
            tipo_tinta: item.tipo_tinta,
            cara_impresa: item.cara_impresa,
            cantidad_hojas: item.cantidad_hojas,
            cantidad_copias: item.cantidad_unidades || item.config?.cantidad_copias, // Fallback
            anillado: item.tipo_anillado ? { tipo: item.tipo_anillado } : undefined,
            plastificado: item.tipo_plastificado ? {
              tipo: item.tipo_plastificado,
              todas_hojas: true // Asunción por defecto si viene de DB antiguo
            } : undefined,
            guillotinado: item.con_guillotinado ? { cantidad_hojas: item.cantidad_hojas } : undefined,
            // Ploteo CAD fields
            modo_item: item.es_ploteo_cad ? 'ploteo_cad' : 'hojas',
            ploteo_cad_tipo_papel: item.ploteo_cad_tipo_papel,
            ploteo_cad_ancho_rollo: item.ploteo_cad_ancho_rollo,
            ploteo_cad_metros_lineales: item.ploteo_cad_metros_lineales,
          }
        };
      });

      setItems(itemsHydrated);
      // Colapsar todos los items al cargar orden existente
      const collapsed: Record<string, boolean> = {};
      itemsHydrated.forEach(item => {
        collapsed[item.id] = true;
      });
      setItemsCollapsed(collapsed);
      setFechaEntrega(ordenEditando.fecha_entrega_estimada || '');
      setObservaciones(ordenEditando.observaciones || '');
    } else {
      // Iniciar con un item en blanco
      setItems([{
        id: `item-${Date.now()}`,
        config: { cantidad_copias: 1 },
      }]);
      setItemsCollapsed({});
      setFechaEntrega('');
      setObservaciones('');
    }
    setErrorValidacion('');
  }, [isOpen, ordenEditando]);

  const agregarItem = useCallback(() => {
    const nuevoItem: ItemCopiadoWithId = {
      id: `item-${Date.now()}-${Math.random()}`,
      config: { cantidad_copias: 1 },
    };

    // Colapsar todos los items existentes
    setItemsCollapsed((prev) => {
      const newCollapsed: Record<string, boolean> = { ...prev };
      items.forEach(item => {
        newCollapsed[item.id] = true;
      });
      return newCollapsed;
    });

    setItems((prev) => [...prev, nuevoItem]);
  }, [items]);

  const actualizarItem = useCallback((id: string, config: Partial<ItemCopiadoConfig>) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, config } : item))
    );
  }, []);

  const actualizarPrecioItem = useCallback((id: string, precio: number) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, precio } : item))
    );
  }, []);

  const actualizarDescripcion = useCallback((id: string, descripcion: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, descripcion } : item))
    );
  }, []);

  const eliminarItem = useCallback((id: string) => {
    if (items.length === 1) {
      setErrorValidacion('Debe haber al menos un item en la orden de copiado');
      return;
    }
    setItems((prev) => prev.filter((item) => item.id !== id));
    setItemsCollapsed((prev) => {
      const newCollapsed = { ...prev };
      delete newCollapsed[id];
      return newCollapsed;
    });
    setErrorValidacion('');
  }, [items.length]);

  const toggleItemCollapse = useCallback((id: string) => {
    setItemsCollapsed(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  }, []);

  // Sistema de callbacks memoizados para evitar loops infinitos
  const priceCalculatedCallbacks = useMemo(() => {
    const callbacks: Record<string, (precio: number) => void> = {};
    items.forEach((item) => {
      callbacks[item.id] = (precio: number) => {
        actualizarPrecioItem(item.id, precio);
      };
    });
    return callbacks;
  }, [items.map(i => i.id).join(','), actualizarPrecioItem]);

  const validarYGuardar = () => {
    // Validar que hay al menos un item completo
    const itemsCompletos = items.filter(
      (item) =>
        item.config.tamanio_papel_id &&
        item.config.papel_id &&
        item.config.tipo_tinta &&
        item.config.cara_impresa &&
        item.config.cantidad_hojas &&
        item.config.cantidad_copias &&
        item.precio
    );

    if (itemsCompletos.length === 0) {
      setErrorValidacion('Debe configurar al menos un item completo para la orden de copiado');
      return;
    }

    // Calcular total
    const total = items.reduce((sum, item) => sum + (item.precio || 0), 0);

    const ordenTemporal: OrdenCopiadoTemporal = {
      id: ordenEditando?.id || `oc-temp-${Date.now()}`,
      items: itemsCompletos,
      fecha_entrega_estimada: fechaEntrega || undefined,
      observaciones: observaciones || undefined,
      total,
    };

    onGuardar(ordenTemporal);
    onClose();
  };

  const calcularTotal = () => {
    return items.reduce((sum, item) => sum + (item.precio || 0), 0);
  };

  const footerContent = (
    <div className="space-y-4">
      {/* Error de validación */}
      {errorValidacion && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700">{errorValidacion}</p>
        </div>
      )}

      {/* Resumen de totales y Acciones */}
      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">Total:</span>
          <span className="text-xl font-bold text-green-600">
            ${calcularTotal().toFixed(2)}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={validarYGuardar}>
            <FileText className="w-4 h-4" />
            {ordenEditando ? 'Actualizar Orden' : 'Asociar Orden'}
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      footer={footerContent}
      title={ordenEditando ? 'Editar Orden de Copiado Asociada' : 'Asociar Orden de Copiado'}
      size="xl"
    >
      <div className="space-y-6">

        {/* Información general */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <DatePicker
              label="Fecha Entrega Estimada (Opcional)"
              value={fechaEntrega}
              onChange={(date) => setFechaEntrega(date || '')}
              minDate={new Date()}
              placeholder="Seleccionar fecha"
            />
          </div>
        </div>

        {/* Items de copiado */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-900">Items de Copiado</h3>
            <Button variant="primary" size="sm" onClick={agregarItem}>
              <Plus className="w-4 h-4" />
              Agregar Item
            </Button>
          </div>

          <div className="space-y-3">
            {items.map((item, index) => (
              <CentroCopiadoItemForm
                key={item.id}
                itemNumber={index + 1}
                descripcion={item.descripcion}
                onDescripcionChange={(desc) => actualizarDescripcion(item.id, desc)}
                value={item.config}
                onChange={(config) => actualizarItem(item.id, config)}
                onRemove={() => eliminarItem(item.id)}
                onPriceCalculated={priceCalculatedCallbacks[item.id]}
                isCollapsed={itemsCollapsed[item.id] || false}
                onToggleCollapse={() => toggleItemCollapse(item.id)}
              />
            ))}
          </div>
        </div>

      </div>
    </Modal>
  );

}
