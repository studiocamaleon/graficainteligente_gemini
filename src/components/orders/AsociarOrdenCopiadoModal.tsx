import { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, Trash2, FileText, Calendar, X } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
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
  clienteNombre: string;
  ordenEditando?: OrdenCopiadoTemporal;
}

export function AsociarOrdenCopiadoModal({
  isOpen,
  onClose,
  onGuardar,
  clienteNombre,
  ordenEditando,
}: AsociarOrdenCopiadoModalProps) {
  const [fechaEntrega, setFechaEntrega] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [items, setItems] = useState<ItemCopiadoWithId[]>([]);
  const [errorValidacion, setErrorValidacion] = useState('');

  // Inicializar con datos de edición si existen
  useEffect(() => {
    if (ordenEditando) {
      setItems(ordenEditando.items);
      setFechaEntrega(ordenEditando.fecha_entrega_estimada || '');
      setObservaciones(ordenEditando.observaciones || '');
    } else {
      // Iniciar con un item en blanco
      setItems([{
        id: `item-${Date.now()}`,
        config: { cantidad_copias: 1 },
      }]);
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
    setItems((prev) => [...prev, nuevoItem]);
  }, []);

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
    setErrorValidacion('');
  }, [items.length]);

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

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={ordenEditando ? 'Editar Orden de Copiado Asociada' : 'Asociar Orden de Copiado'}
      size="xl"
    >
      <div className="space-y-6">
        {/* Info del cliente */}
        <Card className="bg-blue-50 border-blue-200">
          <div className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <FileText className="w-5 h-5 text-blue-600" />
              <span className="text-sm font-medium text-blue-900">
                Cliente de la Orden de Trabajo
              </span>
            </div>
            <p className="text-lg font-bold text-blue-900 ml-7">{clienteNombre}</p>
            <p className="text-xs text-blue-700 ml-7 mt-1">
              La orden de copiado se creará para este cliente y se asociará automáticamente
            </p>
          </div>
        </Card>

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

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Observaciones (Opcional)
          </label>
          <textarea
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Notas específicas para esta orden de copiado..."
          />
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

          <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
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
                isCollapsed={false}
              />
            ))}
          </div>
        </div>

        {/* Error de validación */}
        {errorValidacion && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700">{errorValidacion}</p>
          </div>
        )}

        {/* Resumen de totales */}
        <Card className="bg-gray-50">
          <div className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Total Orden de Copiado:</span>
              <span className="text-2xl font-bold text-green-600">
                ${calcularTotal().toFixed(2)}
              </span>
            </div>
            <p className="text-xs text-gray-600 mt-2">
              Este total se sumará al total de la Orden de Trabajo
            </p>
          </div>
        </Card>

        {/* Acciones */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={validarYGuardar}>
            <FileText className="w-4 h-4" />
            {ordenEditando ? 'Actualizar Orden' : 'Asociar Orden de Copiado'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
