import { Target, TrendingDown, AlertTriangle } from 'lucide-react';
import { Card } from '../ui/Card';
import type { TasaCumplimiento } from '../../types/database';

interface ComplianceRateCardProps {
  data: TasaCumplimiento;
  loading?: boolean;
}

export function ComplianceRateCard({ data, loading = false }: ComplianceRateCardProps) {
  if (loading) {
    return (
      <Card className="border-2">
        <div className="animate-pulse">
          <div className="flex items-center justify-between mb-6">
            <div className="flex-1">
              <div className="h-5 bg-gray-200 rounded w-48 mb-3"></div>
              <div className="h-16 bg-gray-200 rounded w-32"></div>
            </div>
            <div className="w-16 h-16 bg-gray-200 rounded-xl"></div>
          </div>
          <div className="grid grid-cols-3 gap-4 pt-4 border-t border-gray-200">
            <div className="h-12 bg-gray-200 rounded"></div>
            <div className="h-12 bg-gray-200 rounded"></div>
            <div className="h-12 bg-gray-200 rounded"></div>
          </div>
        </div>
      </Card>
    );
  }

  const tasa = data.tasa_cumplimiento;

  // Determinar color y estado según la tasa
  const getColor = () => {
    if (tasa >= 95) return 'green';
    if (tasa >= 85) return 'yellow';
    return 'red';
  };

  const color = getColor();

  const colorClasses = {
    green: {
      bg: 'bg-green-50',
      border: 'border-green-500',
      icon: 'text-green-600',
      text: 'text-green-900',
      badge: 'bg-green-100 text-green-800',
    },
    yellow: {
      bg: 'bg-yellow-50',
      border: 'border-yellow-500',
      icon: 'text-yellow-600',
      text: 'text-yellow-900',
      badge: 'bg-yellow-100 text-yellow-800',
    },
    red: {
      bg: 'bg-red-50',
      border: 'border-red-500',
      icon: 'text-red-600',
      text: 'text-red-900',
      badge: 'bg-red-100 text-red-800',
    },
  };

  const colors = colorClasses[color];

  const getMensaje = () => {
    if (tasa >= 95) return 'Excelente cumplimiento';
    if (tasa >= 85) return 'Necesita atención';
    return 'Crítico - Acción urgente';
  };

  const IconStatus = tasa >= 95 ? Target : tasa >= 85 ? TrendingDown : AlertTriangle;

  return (
    <Card className={`border-l-4 ${colors.border} ${colors.bg}`}>
      <div className="flex items-start justify-between mb-6">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h2 className="text-xl font-bold text-gray-900">Tasa de Cumplimiento</h2>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${colors.badge}`}>
              {getMensaje()}
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <p className={`text-6xl font-bold ${colors.text}`}>
              {tasa.toFixed(1)}%
            </p>
          </div>
          <p className="text-sm text-gray-600 mt-2">
            {data.ordenes_a_tiempo} de {data.total_ordenes_evaluadas} órdenes entregadas a tiempo
          </p>
        </div>

        <div className={`p-4 rounded-xl ${colors.bg}`}>
          <IconStatus className={`w-12 h-12 ${colors.icon}`} />
        </div>
      </div>

      {/* Métricas Secundarias */}
      <div className="grid grid-cols-3 gap-4 pt-4 border-t border-gray-200">
        <div>
          <p className="text-xs text-gray-500 mb-1">A Tiempo</p>
          <p className="text-2xl font-bold text-green-600">{data.ordenes_a_tiempo}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">Retrasadas</p>
          <p className="text-2xl font-bold text-red-600">{data.ordenes_retrasadas}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">Retraso Prom.</p>
          <p className="text-2xl font-bold text-gray-700">
            {data.promedio_dias_retraso > 0 ? `${data.promedio_dias_retraso.toFixed(1)}d` : '-'}
          </p>
        </div>
      </div>

      {/* Advertencia si hay órdenes sin fecha estimada */}
      {data.ordenes_sin_fecha_estimada > 0 && (
        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-2">
          <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-yellow-900">Advertencia</p>
            <p className="text-xs text-yellow-700">
              {data.ordenes_sin_fecha_estimada} órdenes completadas sin fecha estimada no están incluidas en el cálculo
            </p>
          </div>
        </div>
      )}

      {/* Meta del 95% */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">Meta de cumplimiento:</span>
          <span className="font-bold text-gray-900">≥ 95%</span>
        </div>
      </div>
    </Card>
  );
}
