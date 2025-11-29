import { motion } from 'framer-motion';
import { Activity, Plus, ArrowRight, CheckCircle, Truck, XCircle, Play, Pause } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../ui/Card';
import { ActividadReciente } from '../../types/dashboard';
import { TipoEventoHistorial } from '../../types/database';
import { TipoEventoProduccion } from '../../types/dashboard';

interface ActividadRecienteListProps {
  actividades: ActividadReciente[];
  loading?: boolean;
}

const eventosIcons: Record<TipoEventoHistorial | TipoEventoProduccion, { icon: typeof Activity; color: string }> = {
  creacion: { icon: Plus, color: 'text-blue-600' },
  modificacion: { icon: ArrowRight, color: 'text-gray-600' },
  cambio_estado: { icon: ArrowRight, color: 'text-orange-600' },
  pago_registrado: { icon: CheckCircle, color: 'text-green-600' },
  nota_agregada: { icon: ArrowRight, color: 'text-gray-600' },
  item_agregado: { icon: Plus, color: 'text-blue-600' },
  item_modificado: { icon: ArrowRight, color: 'text-gray-600' },
  item_eliminado: { icon: XCircle, color: 'text-red-600' },
  cotizacion_enviada: { icon: Truck, color: 'text-purple-600' },
  orden_confirmada: { icon: CheckCircle, color: 'text-green-600' },
  orden_cancelada: { icon: XCircle, color: 'text-red-600' },
  paso_iniciado: { icon: Play, color: 'text-blue-600' },
  paso_completado: { icon: CheckCircle, color: 'text-green-600' },
  paso_pausado: { icon: Pause, color: 'text-orange-600' },
  paso_reanudado: { icon: Play, color: 'text-blue-600' },
};

export function ActividadRecienteList({ actividades, loading }: ActividadRecienteListProps) {
  const navigate = useNavigate();

  if (loading) {
    return (
      <Card padding="lg">
        <div className="h-6 bg-gray-200 rounded w-48 mb-6 animate-pulse"></div>
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="w-8 h-8 bg-gray-200 rounded-full animate-pulse"></div>
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-200 rounded w-3/4 animate-pulse"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2 animate-pulse"></div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    );
  }

  if (actividades.length === 0) {
    return (
      <Card padding="lg">
        <div className="flex items-center gap-3 mb-6">
          <Activity className="w-6 h-6 text-blue-600" />
          <h3 className="text-lg font-bold text-gray-900">Actividad Reciente</h3>
        </div>
        <div className="text-center py-12">
          <Activity className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No hay actividad reciente</p>
        </div>
      </Card>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card padding="lg">
        <div className="flex items-center gap-3 mb-6">
          <Activity className="w-6 h-6 text-blue-600" />
          <h3 className="text-lg font-bold text-gray-900">Actividad Reciente</h3>
        </div>

        <div className="space-y-4">
          {actividades.map((actividad, index) => {
            const config = eventosIcons[actividad.tipo_evento] || {
              icon: Activity,
              color: 'text-gray-600',
            };
            const Icon = config.icon;

            return (
              <motion.div
                key={actividad.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => navigate(`/app/orders/${actividad.orden_id}`)}
                className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer group"
              >
                <div className={`w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 group-hover:bg-white transition-colors`}>
                  <Icon className={`w-4 h-4 ${config.color}`} />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900 mb-1">
                    {actividad.descripcion}
                    {actividad.detalle_extra && (
                      <span className="font-semibold text-gray-700"> • {actividad.detalle_extra}</span>
                    )}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span className="font-mono font-semibold text-blue-600">
                      #{actividad.orden_numero}
                    </span>
                    {actividad.usuario_nombre && (
                      <>
                        <span>•</span>
                        <span>{actividad.usuario_nombre}</span>
                      </>
                    )}
                    <span>•</span>
                    <span>{actividad.tiempo_relativo}</span>
                  </div>
                </div>

                <div className="flex-shrink-0">
                  <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600 transition-colors" />
                </div>
              </motion.div>
            );
          })}
        </div>
      </Card>
    </motion.div>
  );
}
