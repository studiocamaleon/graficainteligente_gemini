import { useState, useEffect } from 'react';
import { X, Route, AlertTriangle, Plus, Trash2, Check } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { AddPasoManualModal } from '../orders/AddPasoManualModal';

interface ItemPersonalizado {
  id: string;
  producto_nombre: string;
  descripcion: string;
}

interface RutaStep {
  etapa: string;
  paso_id: string;
  paso_nombre: string;
  orden: number;
}

interface ConfigurarRutasPresupuestoModalProps {
  isOpen: boolean;
  onClose: () => void;
  itemsPersonalizados: ItemPersonalizado[];
  onConfirm: (rutasPorItem: Record<string, RutaStep[]>) => void;
}

export function ConfigurarRutasPresupuestoModal({
  isOpen,
  onClose,
  itemsPersonalizados,
  onConfirm,
}: ConfigurarRutasPresupuestoModalProps) {
  const [rutasPorItem, setRutasPorItem] = useState<Record<string, RutaStep[]>>({});
  const [itemActual, setItemActual] = useState<string | null>(null);
  const [showAddPasoModal, setShowAddPasoModal] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setRutasPorItem({});
      setItemActual(null);
    }
  }, [isOpen]);

  const handleAddPaso = (paso: RutaStep) => {
    if (!itemActual) return;

    setRutasPorItem((prev) => ({
      ...prev,
      [itemActual]: [...(prev[itemActual] || []), paso],
    }));
  };

  const handleRemovePaso = (itemId: string, pasoIndex: number) => {
    setRutasPorItem((prev) => ({
      ...prev,
      [itemId]: (prev[itemId] || []).filter((_, idx) => idx !== pasoIndex),
    }));
  };

  const handleConfirm = () => {
    // Validar que todos los items tengan al menos 1 paso
    const itemsSinRutas = itemsPersonalizados.filter(
      (item) => !rutasPorItem[item.id] || rutasPorItem[item.id].length === 0
    );

    if (itemsSinRutas.length > 0) {
      alert(
        `Los siguientes items aún no tienen rutas configuradas:\n${itemsSinRutas
          .map((i) => `- ${i.producto_nombre}`)
          .join('\n')}`
      );
      return;
    }

    onConfirm(rutasPorItem);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title="Configurar Rutas de Producción"
        maxWidth="4xl"
      >
        <div className="space-y-6">
          {/* Advertencia */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex gap-3">
              <Route className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-blue-800 mb-1">
                  Configuración requerida antes de convertir
                </p>
                <p className="text-sm text-blue-700">
                  Los items personalizados necesitan rutas de producción configuradas
                  manualmente. Agrega los pasos necesarios para cada item.
                </p>
              </div>
            </div>
          </div>

          {/* Items personalizados */}
          <div className="space-y-4">
            {itemsPersonalizados.map((item) => {
              const rutasItem = rutasPorItem[item.id] || [];
              const tieneRutas = rutasItem.length > 0;

              return (
                <div
                  key={item.id}
                  className="border-2 border-gray-200 rounded-lg overflow-hidden"
                >
                  {/* Header */}
                  <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-gray-900">
                              {item.producto_nombre}
                            </p>
                            {tieneRutas ? (
                              <Badge variant="success" className="flex items-center gap-1">
                                <Check className="w-3 h-3" />
                                {rutasItem.length} {rutasItem.length === 1 ? 'paso' : 'pasos'}
                              </Badge>
                            ) : (
                              <Badge variant="warning" className="flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3" />
                                Sin configurar
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-gray-500 mt-0.5">
                            {item.descripcion}
                          </p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => {
                          setItemActual(item.id);
                          setShowAddPasoModal(true);
                        }}
                      >
                        <Plus className="w-4 h-4" />
                        Agregar Paso
                      </Button>
                    </div>
                  </div>

                  {/* Pasos configurados */}
                  {rutasItem.length > 0 && (
                    <div className="p-4">
                      <div className="space-y-2">
                        {rutasItem.map((paso, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
                          >
                            <div className="flex items-center gap-3 flex-1">
                              <span className="text-sm font-medium text-gray-500">
                                #{paso.orden}
                              </span>
                              <div className="flex-1">
                                <p className="text-sm font-medium text-gray-900">
                                  {paso.paso_nombre}
                                </p>
                                <p className="text-xs text-gray-500 capitalize">
                                  {paso.etapa.replace('_', ' ')}
                                </p>
                              </div>
                            </div>
                            <Button
                              size="sm"
                              variant="danger"
                              onClick={() => handleRemovePaso(item.id, idx)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Botones */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button onClick={handleConfirm}>
              Confirmar y Convertir
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal para agregar pasos */}
      {itemActual && (
        <AddPasoManualModal
          isOpen={showAddPasoModal}
          onClose={() => {
            setShowAddPasoModal(false);
            setItemActual(null);
          }}
          onAdd={handleAddPaso}
          itemNombre={
            itemsPersonalizados.find((i) => i.id === itemActual)?.producto_nombre || ''
          }
          currentStepsCount={rutasPorItem[itemActual]?.length || 0}
        />
      )}
    </>
  );
}
