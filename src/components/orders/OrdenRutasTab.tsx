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
  if (items.length === 0) {
    return (
      <EmptyState
        icon={Route}
        title="No hay items en la orden"
        description="Las rutas de producción se generarán automáticamente al agregar items"
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
        {items.map((item, index) => (
          <ItemRoutePreview
            key={item.id || index}
            item={item}
            index={index}
            items={items}
            setItems={setItems}
            onUpdateStepComment={onUpdateStepComment}
            readOnly={readOnly}
            allowManualSteps={true}
          />
        ))}
      </div>
    </div>
  );
}
