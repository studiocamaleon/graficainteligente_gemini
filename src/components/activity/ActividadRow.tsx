import { Clock, Box, FileText } from 'lucide-react';
import { Avatar } from '../ui/Avatar';
import { Badge } from '../ui/Badge';
import type { ActividadUsuario } from '../../types/database';
import { formatDistanceToNow } from '../../utils/dates';

interface ActividadRowProps {
  actividad: ActividadUsuario;
  onClickOrden?: (ordenId: string) => void;
}

export function ActividadRow({ actividad, onClickOrden }: ActividadRowProps) {
  const formatDuracion = (minutos: number | null) => {
    if (!minutos) return '-';
    if (minutos < 60) return `${Math.round(minutos)} min`;
    const horas = Math.floor(minutos / 60);
    const mins = Math.round(minutos % 60);
    return `${horas}h ${mins}m`;
  };

  const getEtapaColor = (etapa: string) => {
    switch (etapa) {
      case 'prensa':
        return 'bg-blue-100 text-blue-800';
      case 'post-prensa':
        return 'bg-purple-100 text-purple-800';
      case 'terminacion':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="flex items-center gap-4 p-4 bg-white border border-gray-200 rounded-lg hover:shadow-sm transition-shadow">
      <div className="flex-shrink-0">
        <Avatar
          name={actividad.responsable_nombre}
          src={actividad.responsable_avatar || undefined}
          size="md"
        />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <p className="font-medium text-gray-900 truncate">
            {actividad.responsable_nombre}
          </p>
          <Badge
            variant={actividad.estado_paso === 'completado' ? 'success' : 'secondary'}
          >
            {actividad.estado_paso === 'completado' ? 'Completado' : 'Omitido'}
          </Badge>
        </div>

        <div className="flex items-center gap-4 text-sm text-gray-600">
          <div className="flex items-center gap-1">
            <Box className="w-4 h-4" />
            <span className="font-medium">{actividad.paso_nombre}</span>
          </div>

          {actividad.estacion_nombre && (
            <span className="text-gray-500">• {actividad.estacion_nombre}</span>
          )}

          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getEtapaColor(actividad.tipo_etapa)}`}>
            {actividad.tipo_etapa}
          </span>
        </div>

        <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
          <button
            onClick={() => onClickOrden?.(actividad.orden_id)}
            className="flex items-center gap-1 hover:text-blue-600 transition-colors"
          >
            <FileText className="w-4 h-4" />
            <span>Orden #{actividad.numero_orden}</span>
          </button>

          <span>• {actividad.producto_nombre}</span>
          {actividad.cliente_nombre && (
            <span>• {actividad.cliente_nombre}</span>
          )}
        </div>

        {actividad.notas && (
          <div className="mt-2 text-sm text-gray-600 italic">
            "{actividad.notas}"
          </div>
        )}
      </div>

      <div className="flex-shrink-0 text-right">
        <div className="flex items-center gap-1 text-sm font-medium text-gray-900 mb-1">
          <Clock className="w-4 h-4" />
          <span>{formatDuracion(actividad.duracion_minutos)}</span>
        </div>
        <div className="text-xs text-gray-500">
          {formatDistanceToNow(new Date(actividad.fecha_fin))}
        </div>
      </div>
    </div>
  );
}
