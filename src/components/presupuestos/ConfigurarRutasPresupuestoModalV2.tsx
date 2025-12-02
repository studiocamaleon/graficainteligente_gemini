import { useState, useEffect } from 'react';
import { X, Route, AlertTriangle, CheckCircle } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { ItemRoutePreview } from '../orders/ItemRoutePreview';

interface ItemPresupuesto {
  id: string;
  tipo_item: string;
  producto_nombre: string;
  descripcion?: string;
  producto_id?: string | null;
  cantidad: number;
  configuracion?: any;
  rutas_generadas?: any[];
}

interface RutaStep {
  etapa: string;
  paso_id: string;
  paso_nombre: string;
  orden: number;
}

interface ConfigurarRutasPresupuestoModalV2Props {
  isOpen: boolean;
  onClose: () => void;
  items: ItemPresupuesto[];
  onConfirm: (rutasPorItem: Record<string, RutaStep[]>) => void;
}

export function ConfigurarRutasPresupuestoModalV2({
  isOpen,
  onClose,
  items,
  onConfirm,
}: ConfigurarRutasPresupuestoModalV2Props) {
  const [itemsWithRoutes, setItemsWithRoutes] = useState<ItemPresupuesto[]>([]);

  useEffect(() => {
    if (isOpen) {
      // Filtrar solo items personalizados (con guión bajo como en BD)
      const itemsPersonalizados = items.filter(item => item.tipo_item === 'item_personalizado');

      // Inicializar items con rutas vacías si no existen
      setItemsWithRoutes(
        itemsPersonalizados.map(item => ({
          ...item,
          rutas_generadas: item.rutas_generadas || [],
        }))
      );
    }
  }, [isOpen, items]);

  const handleConfirm = () => {
    // Validar que todos los items tengan al menos 1 paso
    const itemsSinRutas = itemsWithRoutes.filter(
      (item) => !item.rutas_generadas || item.rutas_generadas.length === 0
    );

    if (itemsSinRutas.length > 0) {
      alert(
        `Los siguientes items aún no tienen rutas configuradas:\n${itemsSinRutas
          .map((i) => `- ${i.producto_nombre}`)
          .join('\n')}\n\nAgrega al menos un paso de producción a cada item.`
      );
      return;
    }

    // Convertir a formato esperado por backend
    const rutasPorItem: Record<string, RutaStep[]> = {};
    itemsWithRoutes.forEach((item) => {
      if (item.rutas_generadas && item.rutas_generadas.length > 0) {
        rutasPorItem[item.id] = item.rutas_generadas.map((ruta: any) => ({
          etapa: ruta.etapa,
          paso_id: ruta.paso_id,
          paso_nombre: ruta.paso_nombre,
          orden: ruta.orden,
        }));
      }
    });

    onConfirm(rutasPorItem);
    onClose();
  };

  const handleClose = () => {
    if (
      itemsWithRoutes.some(
        (item) => item.rutas_generadas && item.rutas_generadas.length > 0
      )
    ) {
      if (
        !window.confirm(
          'Hay rutas configuradas que se perderán. ¿Deseas cancelar de todas formas?'
        )
      ) {
        return;
      }
    }
    onClose();
  };

  if (!isOpen) return null;

  // Estadísticas de configuración
  const itemsConfigurados = itemsWithRoutes.filter(
    (item) => item.rutas_generadas && item.rutas_generadas.length > 0
  ).length;
  const totalItems = itemsWithRoutes.length;
  const allConfigured = itemsConfigurados === totalItems;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Configurar Rutas de Producción"
      maxWidth="5xl"
    >
      <div className="space-y-6">
        {/* Header con info */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex gap-3">
            <Route className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-blue-800 mb-1">
                Configuración de Rutas para Items Personalizados
              </p>
              <p className="text-sm text-blue-700">
                Los items personalizados del presupuesto necesitan rutas de producción
                configuradas manualmente. Usa el botón "Agregar Paso" en cada item para
                definir los pasos necesarios.
              </p>
            </div>
          </div>
        </div>

        {/* Barra de progreso */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-gray-700">
              Progreso de configuración
            </span>
            <span className={`font-semibold ${allConfigured ? 'text-green-600' : 'text-gray-600'}`}>
              {itemsConfigurados} / {totalItems} items configurados
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
            <div
              className={`h-full transition-all duration-300 rounded-full ${
                allConfigured ? 'bg-green-500' : 'bg-blue-500'
              }`}
              style={{
                width: `${totalItems > 0 ? (itemsConfigurados / totalItems) * 100 : 0}%`,
              }}
            />
          </div>
        </div>

        {/* Items personalizados */}
        {itemsWithRoutes.length === 0 ? (
          <div className="flex items-center gap-2 p-4 bg-gray-50 border border-gray-200 rounded-lg text-gray-600">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <p className="text-sm">
              No hay items personalizados en este presupuesto que requieran configuración.
            </p>
          </div>
        ) : (
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
            {itemsWithRoutes.map((item, index) => (
              <ItemRoutePreview
                key={item.id}
                item={item}
                index={index}
                items={itemsWithRoutes}
                setItems={setItemsWithRoutes}
                readOnly={false}
                allowManualSteps={true}
              />
            ))}
          </div>
        )}

        {/* Footer con advertencia y botones */}
        <div className="space-y-4 pt-4 border-t">
          {!allConfigured && itemsWithRoutes.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <div className="flex gap-2">
                <AlertTriangle className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-yellow-800">
                  Todos los items personalizados deben tener al menos un paso de producción
                  configurado antes de continuar con la conversión.
                </p>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleConfirm}
              disabled={!allConfigured}
              className={
                allConfigured
                  ? 'bg-green-600 hover:bg-green-700'
                  : ''
              }
            >
              {allConfigured ? (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Confirmar y Continuar
                </>
              ) : (
                'Configurar Todos los Items'
              )}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
