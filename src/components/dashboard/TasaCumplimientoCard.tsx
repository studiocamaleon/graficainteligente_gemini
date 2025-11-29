import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, AlertCircle, CheckCircle } from 'lucide-react';
import { Card } from '../ui/Card';
import { TasaCumplimiento } from '../../types/database';

interface TasaCumplimientoCardProps {
  data: TasaCumplimiento | null;
  loading?: boolean;
}

export function TasaCumplimientoCard({ data, loading }: TasaCumplimientoCardProps) {
  if (loading) {
    return (
      <Card padding="lg">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-48 mb-4"></div>
          <div className="h-20 bg-gray-200 rounded w-full"></div>
        </div>
      </Card>
    );
  }

  if (!data || data.total_ordenes_evaluadas === 0) {
    return (
      <Card padding="lg">
        <div className="flex items-center gap-3 mb-3">
          <AlertCircle className="w-6 h-6 text-gray-400" />
          <h3 className="text-lg font-bold text-gray-900">Tasa de Cumplimiento</h3>
        </div>
        <div className="text-center py-8">
          <p className="text-gray-500">No hay suficientes datos para calcular la tasa de cumplimiento</p>
          <p className="text-sm text-gray-400 mt-2">Se necesitan órdenes completadas con fecha estimada de entrega</p>
        </div>
      </Card>
    );
  }

  const tasa = Number(data.tasa_cumplimiento);
  const meta = 95;

  let bgColor = 'bg-red-50';
  let borderColor = 'border-red-200';
  let textColor = 'text-red-700';
  let accentColor = 'text-red-600';
  let Icon = TrendingDown;
  let mensaje = 'Necesitamos mejorar. ¡Todos a enfocarse!';

  if (tasa >= meta) {
    bgColor = 'bg-green-50';
    borderColor = 'border-green-200';
    textColor = 'text-green-700';
    accentColor = 'text-green-600';
    Icon = CheckCircle;
    mensaje = '¡Excelente trabajo! Meta alcanzada';
  } else if (tasa >= 85) {
    bgColor = 'bg-yellow-50';
    borderColor = 'border-yellow-200';
    textColor = 'text-yellow-700';
    accentColor = 'text-yellow-600';
    Icon = TrendingUp;
    mensaje = 'Cerca de la meta. ¡Sigamos mejorando!';
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card padding="lg" className={`${bgColor} border-2 ${borderColor}`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Icon className={`w-6 h-6 ${accentColor}`} />
            <h3 className="text-lg font-bold text-gray-900">Tasa de Cumplimiento</h3>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-600">Meta</p>
            <p className={`text-sm font-semibold ${textColor}`}>{meta}%</p>
          </div>
        </div>

        <div className="flex items-end justify-between mb-4">
          <div>
            <p className={`text-6xl font-bold ${textColor}`}>{tasa.toFixed(1)}%</p>
            <p className={`text-lg font-medium ${textColor} mt-1`}>{mensaje}</p>
          </div>
          <div className="text-right">
            <div className="space-y-1">
              <div className="flex items-center justify-end gap-2">
                <span className="text-sm text-gray-600">A tiempo:</span>
                <span className="text-lg font-bold text-green-700">{data.ordenes_a_tiempo}</span>
              </div>
              <div className="flex items-center justify-end gap-2">
                <span className="text-sm text-gray-600">Retrasadas:</span>
                <span className="text-lg font-bold text-red-700">{data.ordenes_retrasadas}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-gray-300">
          <div>
            <p className="text-xs text-gray-600 mb-1">Total Evaluadas</p>
            <p className="text-xl font-bold text-gray-900">{data.total_ordenes_evaluadas}</p>
          </div>
          {Number(data.promedio_dias_adelanto) > 0 && (
            <div>
              <p className="text-xs text-gray-600 mb-1">Promedio Adelanto</p>
              <p className="text-xl font-bold text-green-700">{Number(data.promedio_dias_adelanto).toFixed(1)} días</p>
            </div>
          )}
          {Number(data.promedio_dias_retraso) > 0 && (
            <div>
              <p className="text-xs text-gray-600 mb-1">Promedio Retraso</p>
              <p className="text-xl font-bold text-red-700">{Number(data.promedio_dias_retraso).toFixed(1)} días</p>
            </div>
          )}
          {data.ordenes_sin_fecha_estimada > 0 && (
            <div>
              <p className="text-xs text-gray-600 mb-1">Sin Fecha Estimada</p>
              <p className="text-xl font-bold text-gray-600">{data.ordenes_sin_fecha_estimada}</p>
            </div>
          )}
        </div>
      </Card>
    </motion.div>
  );
}
