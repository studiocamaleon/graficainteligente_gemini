import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, AlertCircle, CheckCircle } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { TasaCumplimiento } from '../../types/database';

interface TasaCumplimientoCardProps {
  data: TasaCumplimiento | null;
  loading?: boolean;
}

export function TasaCumplimientoCard({ data, loading }: TasaCumplimientoCardProps) {
  if (loading) {
    return (
      <Card className="col-span-1 lg:col-span-3">
        <CardHeader>
          <div className="h-6 bg-gray-200 rounded w-48 mb-1 animate-pulse"></div>
          <div className="h-4 bg-gray-200 rounded w-full animate-pulse"></div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="h-20 bg-gray-200 rounded w-full animate-pulse"></div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-t border-gray-100 pt-4">
              <div className="h-10 bg-gray-200 rounded animate-pulse"></div>
              <div className="h-10 bg-gray-200 rounded animate-pulse"></div>
              <div className="h-10 bg-gray-200 rounded animate-pulse"></div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.total_ordenes_evaluadas === 0) {
    return (
      <Card className="col-span-1 lg:col-span-3">
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-gray-400" />
            <CardTitle>Tasa de Cumplimiento</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="text-center py-8">
          <p className="text-muted-foreground">No hay suficientes datos para calcular la tasa de cumplimiento</p>
          <p className="text-xs text-muted-foreground mt-2">Se necesitan órdenes completadas con fecha estimada de entrega</p>
        </CardContent>
      </Card>
    );
  }

  const tasa = Number(data.tasa_cumplimiento);
  const meta = 95;

  let borderColor = 'border-red-200';
  let textColor = 'text-red-700';
  let accentColor = 'text-red-600';
  let Icon = TrendingDown;
  let mensaje = 'Necesitamos mejorar';

  if (tasa >= meta) {
    borderColor = 'border-green-200';
    textColor = 'text-green-700';
    accentColor = 'text-green-600';
    Icon = CheckCircle;
    mensaje = 'Meta alcanzada';
  } else if (tasa >= 85) {
    borderColor = 'border-yellow-200';
    textColor = 'text-yellow-700';
    accentColor = 'text-yellow-600';
    Icon = TrendingUp;
    mensaje = 'Cerca de la meta';
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="col-span-1 lg:col-span-3"
    >
      <Card className={`border-l-4 ${borderColor}`}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Icon className={`w-5 h-5 ${accentColor}`} />
              <CardTitle>Tasa de Cumplimiento</CardTitle>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Meta</p>
              <p className={`text-xs font-semibold ${textColor}`}>{meta}%</p>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <div className="flex items-end justify-between mb-6">
            <div>
              <p className={`text-4xl font-bold ${textColor}`}>{tasa.toFixed(1)}%</p>
              <p className={`text-sm font-medium ${textColor} mt-1`}>{mensaje}</p>
            </div>
            <div className="text-right">
              <div className="space-y-1">
                <div className="flex items-center justify-end gap-2">
                  <span className="text-sm text-muted-foreground">A tiempo:</span>
                  <span className="text-lg font-bold text-green-700">{data.ordenes_a_tiempo}</span>
                </div>
                <div className="flex items-center justify-end gap-2">
                  <span className="text-sm text-muted-foreground">Retrasadas:</span>
                  <span className="text-lg font-bold text-red-700">{data.ordenes_retrasadas}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-border">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Total Evaluadas</p>
              <p className="text-lg font-bold text-foreground">{data.total_ordenes_evaluadas}</p>
            </div>
            {Number(data.promedio_dias_adelanto) > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Promedio Adelanto</p>
                <p className="text-lg font-bold text-green-700">{Number(data.promedio_dias_adelanto).toFixed(1)} días</p>
              </div>
            )}
            {Number(data.promedio_dias_retraso) > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Promedio Retraso</p>
                <p className="text-lg font-bold text-red-700">{Number(data.promedio_dias_retraso).toFixed(1)} días</p>
              </div>
            )}
            {data.ordenes_sin_fecha_estimada > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Sin Fecha Estimada</p>
                <p className="text-lg font-bold text-muted-foreground">{data.ordenes_sin_fecha_estimada}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
