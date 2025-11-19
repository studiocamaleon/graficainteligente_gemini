import { Clock, AlertCircle } from 'lucide-react';
import { EmptyState } from '../ui/EmptyState';
import { Badge } from '../ui/Badge';

interface Evento {
  id: string;
  tipo_evento: string;
  descripcion: string;
  created_at: string;
  usuario?: {
    full_name: string;
  };
}

interface OrdenHistorialTabProps {
  eventos: Evento[];
}

export function OrdenHistorialTab({ eventos }: OrdenHistorialTabProps) {
  if (eventos.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-2 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <AlertCircle className="w-5 h-5 text-blue-600" />
          <p className="text-sm text-blue-800">
            El historial de eventos se generará automáticamente cuando se cree la orden.
          </p>
        </div>

        <EmptyState
          icon={Clock}
          title="Sin eventos registrados"
          description="Los eventos y cambios en la orden se registrarán automáticamente aquí"
        />
      </div>
    );
  }

  const getTipoEventoBadge = (tipo: string) => {
    const tipos: Record<string, { label: string; variant: any }> = {
      creacion: { label: 'Creación', variant: 'success' },
      modificacion: { label: 'Modificación', variant: 'secondary' },
      cambio_estado: { label: 'Cambio de Estado', variant: 'warning' },
      item_agregado: { label: 'Item Agregado', variant: 'secondary' },
      item_modificado: { label: 'Item Modificado', variant: 'secondary' },
      item_eliminado: { label: 'Item Eliminado', variant: 'danger' },
      pago_registrado: { label: 'Pago Registrado', variant: 'success' },
    };

    const config = tipos[tipo] || { label: tipo, variant: 'secondary' };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900">Historial de Eventos</h3>

      <div className="relative">
        <div className="absolute left-4 top-0 bottom-0 w-px bg-gray-200" />

        <div className="space-y-6">
          {eventos.map(evento => (
            <div key={evento.id} className="relative pl-10">
              <div className="absolute left-0 w-8 h-8 bg-white border-2 border-blue-500 rounded-full flex items-center justify-center">
                <Clock className="w-4 h-4 text-blue-500" />
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  {getTipoEventoBadge(evento.tipo_evento)}
                  <span className="text-sm text-gray-500">
                    {new Date(evento.created_at).toLocaleString('es-AR')}
                  </span>
                </div>

                <p className="text-sm text-gray-700">{evento.descripcion}</p>

                {evento.usuario && (
                  <p className="text-xs text-gray-500 mt-2">
                    Por: {evento.usuario.full_name}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
