import { motion } from 'framer-motion';
import { Activity, Plus, ArrowRight, CheckCircle, Truck, XCircle, Play, Pause } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { ActividadReciente } from '../../types/dashboard';
import { TipoEventoHistorial } from '../../types/database';
import { TipoEventoProduccion } from '../../types/dashboard';

interface ActividadRecienteListProps {
  actividades: ActividadReciente[];
  loading?: boolean;
}

const eventosIcons: Record<TipoEventoHistorial | TipoEventoProduccion, { icon: typeof Activity; color: string }> = {
  creacion: { icon: Plus, color: 'text-blue-600' },
  modificacion: { icon: ArrowRight, color: 'text-gray-500' },
  cambio_estado: { icon: ArrowRight, color: 'text-orange-600' },
  pago_registrado: { icon: CheckCircle, color: 'text-green-600' },
  nota_agregada: { icon: ArrowRight, color: 'text-gray-500' },
  item_agregado: { icon: Plus, color: 'text-blue-600' },
  item_modificado: { icon: ArrowRight, color: 'text-gray-500' },
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
      <Card className="col-span-1 lg:col-span-3">
        <CardHeader>
          <div className="h-6 bg-gray-200 rounded w-48 mb-2 animate-pulse"></div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-start gap-4">
                <div className="w-8 h-8 bg-gray-200 rounded-full animate-pulse"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-3/4 animate-pulse"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2 animate-pulse"></div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="col-span-1 lg:col-span-3">
      <CardHeader className="flex flex-row items-center gap-2">
        <Activity className="w-5 h-5 text-muted-foreground" />
        <CardTitle>Actividad Reciente</CardTitle>
      </CardHeader>
      <CardContent>
        {actividades.length === 0 ? (
          <div className="text-center py-12">
            <Activity className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-50" />
            <p className="text-muted-foreground">No hay actividad reciente</p>
          </div>
        ) : (
          <div className="space-y-1">
            {actividades.map((actividad, index) => {
              const config = eventosIcons[actividad.tipo_evento] || {
                icon: Activity,
                color: 'text-gray-500',
              };
              const Icon = config.icon;

              return (
                <motion.div
                  key={actividad.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => navigate(`/app/orders/${actividad.orden_id}`)}
                  className="flex items-start gap-3 p-3 rounded-md hover:bg-muted/50 transition-colors cursor-pointer group"
                >
                  <div className={`mt-0.5 w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0 group-hover:bg-background border border-transparent group-hover:border-border transition-all`}>
                    <Icon className={`w-4 h-4 ${config.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                      <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                        {actividad.descripcion}
                      </p>
                      <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                        #{actividad.orden_numero}
                      </span>
                    </div>
                    {actividad.detalle_extra && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {actividad.detalle_extra}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-muted-foreground">
                        {new Date(actividad.created_at).toLocaleString()}
                      </span>
                      {actividad.usuario_nombre && (
                        <>
                          <span className="text-muted-foreground">•</span>
                          <span className="text-xs text-muted-foreground font-medium">
                            {actividad.usuario_nombre}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
