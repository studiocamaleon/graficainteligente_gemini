import { Route, Info } from 'lucide-react';
import { EmptyState } from '../ui/EmptyState';
import { ItemRoutePreview } from './ItemRoutePreview';

interface OrdenRutasTabProps {
  items: any[];
  setItems?: (items: any[]) => void;
  onUpdateStepComment?: (itemIndex: number, stepId: string, comment: string | null) => void;
  readOnly?: boolean;
}

export function OrdenRutasTab({ items, setItems, onUpdateStepComment, readOnly = false }: OrdenRutasTabProps) {
  // Contar items reales de producción (excluir servicios de cobro)
  const productionItemsCount = items.filter(i => !i.es_servicio_cobro).length;

  if (productionItemsCount === 0) {
    return (
      <EmptyState
        icon={Route}
        title="No hay items de producción"
        description="Agrega productos físicos a esta orden para configurar sus rutas. Los servicios de cobro no generan rutas propias."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-2 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <Info className="w-5 h-5 text-blue-600 flex-shrink-0" />
        <div className="text-sm text-blue-800">
          <p className="font-medium mb-1">Vista previa de rutas de producción</p>
          <p className="text-blue-700">
            Estas rutas se generarán automáticamente en la base de datos al crear la orden.
            Los pasos se evalúan según los servicios y acabados seleccionados en cada producto.
            {!readOnly && ' Puedes agregar comentarios opcionales en cada paso para el operador de producción.'}
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {items.map((item, index) => {
          // Si es un servicio de cobro, no lo mostramos en la lista de rutas
          if (item.es_servicio_cobro) return null;

          return (
            <ItemRoutePreview
              key={item.id || index}
              item={item}
              index={index} // Importante: Mantener el índice original del array para actualizaciones correctas
              items={items}
              setItems={setItems}
              onUpdateStepComment={onUpdateStepComment}
              readOnly={readOnly}
              allowManualSteps={true}
            />
          );
        })}
      </div>
    </div>
  );
}
