import { Clock, CheckCircle2, XCircle, User, MessageSquare } from 'lucide-react';
import type { OrdenItemRuta } from '../../types/database';
import { formatDate } from '../../utils/stringUtils';

interface StepCardProps {
  ruta: OrdenItemRuta;
  isActive: boolean;
  canStart: boolean;
  children?: React.ReactNode;
}

const etapaColors: Record<string, string> = {
  pre_prensa: 'border-purple-300 bg-purple-50',
  principal: 'border-blue-300 bg-blue-50',
  post_prensa: 'border-green-300 bg-green-50',
};

const estadoStyles = {
  pendiente: {
    border: 'border-gray-300',
    bg: 'bg-white',
    icon: Clock,
    iconColor: 'text-gray-400',
    text: 'text-gray-600',
  },
  en_proceso: {
    border: 'border-blue-400',
    bg: 'bg-blue-50',
    icon: Clock,
    iconColor: 'text-blue-600 animate-pulse',
    text: 'text-blue-700',
  },
  completado: {
    border: 'border-green-400',
    bg: 'bg-green-50',
    icon: CheckCircle2,
    iconColor: 'text-green-600',
    text: 'text-green-700',
  },
  omitido: {
    border: 'border-orange-400',
    bg: 'bg-orange-50',
    icon: XCircle,
    iconColor: 'text-orange-600',
    text: 'text-orange-700',
  },
};

export function StepCard({ ruta, isActive, canStart, children }: StepCardProps) {
  const style = estadoStyles[ruta.estado_paso];
  const Icon = style.icon;

  const calcularDuracion = (): string | null => {
    if (!ruta.fecha_inicio || !ruta.fecha_fin) return null;

    const inicio = new Date(ruta.fecha_inicio);
    const fin = new Date(ruta.fecha_fin);
    const diffMs = fin.getTime() - inicio.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 60) {
      return `${diffMins} min`;
    } else {
      const hours = Math.floor(diffMins / 60);
      const mins = diffMins % 60;
      return `${hours}h ${mins}m`;
    }
  };

  const duracion = calcularDuracion();

  return (
    <div
      className={`
        border-2 rounded-lg p-4 transition-all duration-200
        ${style.border} ${style.bg}
        ${isActive ? 'ring-2 ring-blue-500 ring-offset-2 shadow-lg' : ''}
        ${!canStart && ruta.estado_paso === 'pendiente' ? 'opacity-60' : ''}
      `}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-1">
          <Icon className={`w-5 h-5 ${style.iconColor}`} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-2">
            <h4 className={`font-semibold ${style.text}`}>{ruta.paso_nombre}</h4>
            {isActive && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                Activo
              </span>
            )}
          </div>

          {ruta.comentario_vendedor && (
            <div className="flex items-start gap-2 mb-2">
              <MessageSquare className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-gray-600">{ruta.comentario_vendedor}</p>
            </div>
          )}

          <div className="flex flex-wrap gap-3 text-xs text-gray-600">
            {ruta.fecha_inicio && (
              <div className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                <span>Inicio: {formatDate(ruta.fecha_inicio)}</span>
              </div>
            )}

            {ruta.fecha_fin && (
              <div className="flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Fin: {formatDate(ruta.fecha_fin)}</span>
              </div>
            )}

            {duracion && (
              <div className="flex items-center gap-1 font-medium text-blue-600">
                <span>Duración: {duracion}</span>
              </div>
            )}
          </div>

          {ruta.responsable_id && (
            <div className="flex items-center gap-1 mt-2 text-xs text-gray-500">
              <User className="w-3.5 h-3.5" />
              <span>Responsable: {ruta.responsable_nombre || 'Usuario desconocido'}</span>
            </div>
          )}

          {ruta.notas && (
            <div className="mt-2 pt-2 border-t border-gray-200">
              <p className="text-xs text-gray-500 mb-1 font-medium">Notas:</p>
              <p className="text-xs text-gray-700">{ruta.notas}</p>
            </div>
          )}

          {children && <div className="mt-3 pt-3 border-t border-gray-200">{children}</div>}
        </div>
      </div>
    </div>
  );
}
