import { Bell, Check, CheckCheck, Clock, AlertTriangle, Package, X } from 'lucide-react';
import { useNotificaciones } from '../../hooks/useNotificaciones';
import { Badge } from '../ui/Badge';
import type { TipoNotificacion } from '../../types/notifications';

export function NotificationsPanel() {
  const {
    notificaciones,
    noLeidas,
    loading,
    marcarComoLeida,
    marcarTodasComoLeidas,
    eliminarNotificacion,
  } = useNotificaciones();

  const getIconByTipo = (tipo: TipoNotificacion) => {
    switch (tipo) {
      case 'pausa_prolongada':
        return AlertTriangle;
      case 'paso_completado':
        return Check;
      case 'orden_finalizada':
        return Package;
      case 'alerta_produccion':
        return AlertTriangle;
      default:
        return Clock;
    }
  };

  const getColorByTipo = (tipo: TipoNotificacion) => {
    switch (tipo) {
      case 'pausa_prolongada':
        return 'text-orange-500 bg-orange-50';
      case 'paso_completado':
        return 'text-green-500 bg-green-50';
      case 'orden_finalizada':
        return 'text-blue-500 bg-blue-50';
      case 'alerta_produccion':
        return 'text-red-500 bg-red-50';
      default:
        return 'text-gray-500 bg-gray-50';
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Ahora';
    if (diffMins < 60) return `Hace ${diffMins} min`;
    if (diffHours < 24) return `Hace ${diffHours}h`;
    if (diffDays === 1) return 'Ayer';
    return `Hace ${diffDays} días`;
  };

  if (loading) {
    return (
      <div className="w-96 bg-white rounded-lg shadow-lg border border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-gray-700" />
            <h3 className="font-semibold text-gray-900">Notificaciones</h3>
          </div>
        </div>
        <div className="p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-sm text-gray-500 mt-2">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-96 bg-white rounded-lg shadow-lg border border-gray-200 max-h-[600px] flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-gray-700" />
          <h3 className="font-semibold text-gray-900">Notificaciones</h3>
          {noLeidas > 0 && (
            <Badge variant="error" className="ml-1">
              {noLeidas}
            </Badge>
          )}
        </div>
        {noLeidas > 0 && (
          <button
            onClick={marcarTodasComoLeidas}
            className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1 transition-colors"
            title="Marcar todas como leídas"
          >
            <CheckCheck className="w-4 h-4" />
            <span>Marcar todas</span>
          </button>
        )}
      </div>

      {/* Lista de notificaciones */}
      <div className="overflow-y-auto flex-1">
        {notificaciones.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Bell className="w-12 h-12 mx-auto mb-2 text-gray-300" />
            <p className="font-medium">No hay notificaciones</p>
            <p className="text-sm mt-1">Te avisaremos cuando haya novedades</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {notificaciones.map((notif) => {
              const Icon = getIconByTipo(notif.tipo);
              const colorClass = getColorByTipo(notif.tipo);

              return (
                <div
                  key={notif.id}
                  className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors relative group ${
                    !notif.leida ? 'bg-blue-50/50' : ''
                  }`}
                  onClick={() => !notif.leida && marcarComoLeida(notif.id)}
                >
                  <div className="flex items-start gap-3">
                    {/* Icono */}
                    <div className={`mt-1 p-2 rounded-lg ${colorClass}`}>
                      <Icon className="w-4 h-4" />
                    </div>

                    {/* Contenido */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <p className="font-medium text-gray-900 text-sm leading-tight">
                          {notif.titulo}
                        </p>
                        {!notif.leida && (
                          <div
                            className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-1"
                            title="No leída"
                          />
                        )}
                      </div>

                      <p className="text-sm text-gray-600 mb-2 leading-relaxed">
                        {notif.mensaje}
                      </p>

                      {/* Metadata adicional para pausas prolongadas */}
                      {notif.tipo === 'pausa_prolongada' && notif.metadata.horas_pausado && (
                        <div className="flex items-center gap-2 text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded">
                          <Clock className="w-3 h-3" />
                          <span className="font-medium">
                            {notif.metadata.horas_pausado.toFixed(1)} horas pausado
                          </span>
                        </div>
                      )}

                      <p className="text-xs text-gray-400 mt-2">
                        {formatTimeAgo(notif.created_at)}
                      </p>
                    </div>

                    {/* Botón eliminar */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        eliminarNotificacion(notif.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-gray-200 rounded"
                      title="Eliminar notificación"
                    >
                      <X className="w-4 h-4 text-gray-500" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      {notificaciones.length > 0 && (
        <div className="p-3 border-t border-gray-200 text-center flex-shrink-0">
          <p className="text-xs text-gray-500">
            Mostrando {notificaciones.length} notificaciones recientes
          </p>
        </div>
      )}
    </div>
  );
}
