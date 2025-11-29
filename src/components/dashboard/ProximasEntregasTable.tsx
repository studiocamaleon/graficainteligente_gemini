import { motion } from 'framer-motion';
import { Calendar, AlertCircle, Clock, Package } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { ProximaEntrega, UrgenciaConfig } from '../../types/dashboard';

interface ProximasEntregasTableProps {
  entregas: ProximaEntrega[];
  loading?: boolean;
}

const urgenciaConfig: Record<string, UrgenciaConfig> = {
  critico: {
    color: 'bg-red-500',
    bgColor: 'bg-red-50',
    textColor: 'text-red-700',
    label: 'Crítico',
  },
  urgente: {
    color: 'bg-orange-500',
    bgColor: 'bg-orange-50',
    textColor: 'text-orange-700',
    label: 'Urgente',
  },
  proximo: {
    color: 'bg-yellow-500',
    bgColor: 'bg-yellow-50',
    textColor: 'text-yellow-700',
    label: 'Próximo',
  },
  normal: {
    color: 'bg-green-500',
    bgColor: 'bg-green-50',
    textColor: 'text-green-700',
    label: 'Normal',
  },
};

export function ProximasEntregasTable({ entregas, loading }: ProximasEntregasTableProps) {
  const navigate = useNavigate();

  if (loading) {
    return (
      <Card padding="lg">
        <div className="flex items-center justify-between mb-6">
          <div className="h-6 bg-gray-200 rounded w-48 animate-pulse"></div>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-gray-100 rounded animate-pulse"></div>
          ))}
        </div>
      </Card>
    );
  }

  if (entregas.length === 0) {
    return (
      <Card padding="lg">
        <div className="flex items-center gap-3 mb-6">
          <Calendar className="w-6 h-6 text-green-600" />
          <h3 className="text-lg font-bold text-gray-900">Próximas Entregas</h3>
        </div>
        <div className="text-center py-12">
          <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 font-medium">¡Todo al día!</p>
          <p className="text-sm text-gray-400 mt-1">No hay entregas próximas pendientes</p>
        </div>
      </Card>
    );
  }

  const formatearFecha = (fecha: string) => {
    return new Date(fecha).toLocaleDateString('es-ES', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
    });
  };

  const getDiasTexto = (dias: number) => {
    if (dias === 0) return 'Hoy';
    if (dias === 1) return 'Mañana';
    if (dias < 0) return `Vencida (${Math.abs(dias)}d)`;
    return `En ${dias} días`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card padding="lg">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Calendar className="w-6 h-6 text-blue-600" />
            <h3 className="text-lg font-bold text-gray-900">Próximas Entregas</h3>
          </div>
          <Badge variant="info" className="text-sm">
            {entregas.length} {entregas.length === 1 ? 'orden' : 'órdenes'}
          </Badge>
        </div>

        <div className="space-y-3">
          {entregas.map((entrega, index) => {
            const config = urgenciaConfig[entrega.nivel_urgencia];

            return (
              <motion.div
                key={entrega.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => navigate(`/app/orders/${entrega.id}`)}
                className={`${config.bgColor} border-l-4 ${config.color.replace('bg-', 'border-')} rounded-lg p-4 hover:shadow-md transition-all cursor-pointer`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-bold text-gray-900">#{entrega.numero_orden}</span>
                      <Badge variant={entrega.estado === 'pendiente' ? 'warning' : 'info'} className="text-xs">
                        {entrega.estado === 'pendiente' ? 'Pendiente' : 'En Proceso'}
                      </Badge>
                    </div>

                    <p className="text-sm text-gray-700 font-medium truncate mb-2">
                      {entrega.cliente_nombre}
                    </p>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-gray-600">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>{formatearFecha(entrega.fecha_estimada_entrega)}</span>
                      </div>
                      <div className={`flex items-center gap-1 font-semibold ${config.textColor}`}>
                        <Clock className="w-3.5 h-3.5" />
                        <span>{getDiasTexto(entrega.dias_restantes)}</span>
                      </div>
                    </div>

                    {entrega.total_pasos > 0 && (
                      <div className="mt-3">
                        <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                          <span>Progreso</span>
                          <span className="font-semibold">
                            {entrega.pasos_completados}/{entrega.total_pasos} pasos
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full transition-all"
                            style={{ width: `${entrega.progreso_porcentaje}%` }}
                          ></div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col items-center">
                    <div className={`w-12 h-12 rounded-full ${config.color} flex items-center justify-center`}>
                      <AlertCircle className="w-6 h-6 text-white" />
                    </div>
                    <span className={`text-2xl font-bold ${config.textColor} mt-1`}>
                      {entrega.progreso_porcentaje}%
                    </span>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {entregas.length >= 10 && (
          <div className="mt-4 text-center">
            <p className="text-sm text-gray-500">
              Mostrando las 10 entregas más próximas
            </p>
          </div>
        )}
      </Card>
    </motion.div>
  );
}
