import { Clock } from 'lucide-react';
import { EmptyState } from '../ui/EmptyState';
import { Badge } from '../ui/Badge';

interface PresupuestoHistorialTabProps {
  presupuestoId: string;
}

export function PresupuestoHistorialTab({ presupuestoId }: PresupuestoHistorialTabProps) {
  // TODO: Implementar con hook usePresupuestoHistorial en futuras fases
  const historial: any[] = [];

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getAccionBadge = (accion: string) => {
    const config: Record<string, any> = {
      creado: { label: 'Creado', variant: 'success' },
      modificado: { label: 'Modificado', variant: 'info' },
      enviado: { label: 'Enviado', variant: 'warning' },
      aprobado: { label: 'Aprobado', variant: 'success' },
      rechazado: { label: 'Rechazado', variant: 'danger' },
      convertido: { label: 'Convertido', variant: 'success' },
    };

    const c = config[accion] || { label: accion, variant: 'secondary' };
    return <Badge variant={c.variant}>{c.label}</Badge>;
  };

  if (historial.length === 0) {
    return (
      <EmptyState
        icon={Clock}
        title="No hay historial"
        description="Aún no hay cambios registrados en este presupuesto"
      />
    );
  }

  return (
    <div className="space-y-4">
      {historial.map((registro: any) => (
        <div
          key={registro.id}
          className="bg-white border border-gray-200 rounded-lg p-4"
        >
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2">
              {getAccionBadge(registro.accion)}
              <span className="text-sm text-gray-600">
                {formatDate(registro.created_at)}
              </span>
            </div>
          </div>
          {registro.usuario && (
            <p className="text-sm text-gray-600">
              Por: {registro.usuario.full_name}
            </p>
          )}
          {registro.detalles && (
            <pre className="mt-2 text-xs text-gray-500 whitespace-pre-wrap">
              {JSON.stringify(registro.detalles, null, 2)}
            </pre>
          )}
        </div>
      ))}
    </div>
  );
}
