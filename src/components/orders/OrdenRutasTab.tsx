import { Route, AlertCircle } from 'lucide-react';
import { EmptyState } from '../ui/EmptyState';
import { Badge } from '../ui/Badge';

interface OrdenRutasTabProps {
  items: any[];
}

export function OrdenRutasTab({ items }: OrdenRutasTabProps) {
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
        <AlertCircle className="w-5 h-5 text-blue-600" />
        <p className="text-sm text-blue-800">
          Las rutas de producción se generarán automáticamente desde las plantillas configuradas cuando se cree la orden.
        </p>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Items en esta orden
        </h3>
        <div className="space-y-4">
          {items.map((item, index) => (
            <div
              key={index}
              className="p-4 bg-gray-50 border border-gray-200 rounded-lg"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="font-medium text-gray-900">
                  {item.producto_nombre}
                </div>
                <Badge>Cantidad: {item.cantidad}</Badge>
              </div>

              <div className="space-y-2">
                <div className="text-sm text-gray-600">
                  Se generará una ruta de producción automática con las etapas:
                </div>
                <div className="flex items-center space-x-2 ml-4">
                  <Badge variant="secondary">Pre-prensa</Badge>
                  <span className="text-gray-400">→</span>
                  <Badge variant="secondary">Principal</Badge>
                  <span className="text-gray-400">→</span>
                  <Badge variant="secondary">Post-prensa</Badge>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
