import { Card } from '../ui/Card';
import { MetricaEtapa } from '../../hooks/useProductivityMetrics';

interface StageDistributionChartProps {
  data: MetricaEtapa[];
  loading?: boolean;
}

const etapaColors = {
  pre_prensa: {
    bg: 'bg-purple-500',
    text: 'text-purple-600',
    label: 'Pre-prensa',
  },
  principal: {
    bg: 'bg-blue-500',
    text: 'text-blue-600',
    label: 'Principal',
  },
  post_prensa: {
    bg: 'bg-green-500',
    text: 'text-green-600',
    label: 'Post-prensa',
  },
  instalacion: {
    bg: 'bg-orange-500',
    text: 'text-orange-600',
    label: 'Instalación',
  },
};

export function StageDistributionChart({ data, loading }: StageDistributionChartProps) {
  if (loading) {
    return (
      <Card>
        <h3 className="text-lg font-semibold mb-6">Distribución por Etapa</h3>
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-2">
              <div className="h-4 bg-gray-200 rounded w-32"></div>
              <div className="h-8 bg-gray-200 rounded"></div>
            </div>
          ))}
        </div>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card>
        <h3 className="text-lg font-semibold mb-4">Distribución por Etapa</h3>
        <p className="text-gray-500 text-center py-8">No hay datos disponibles</p>
      </Card>
    );
  }

  const totalMinutos = data.reduce((sum, item) => sum + item.minutos_totales, 0);

  return (
    <Card>
      <h3 className="text-lg font-semibold mb-6">Distribución por Etapa</h3>

      <div className="space-y-6">
        {data.map((etapa) => {
          const config = etapaColors[etapa.etapa_tipo as keyof typeof etapaColors] || {
            bg: 'bg-gray-500',
            text: 'text-gray-600',
            label: etapa.etapa_tipo,
          };

          const porcentaje = (etapa.minutos_totales / totalMinutos) * 100;

          return (
            <div key={etapa.etapa_tipo} className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-gray-900">{config.label}</span>
                <span className="text-gray-600">
                  {etapa.minutos_totales.toFixed(0)} min ({porcentaje.toFixed(1)}%)
                </span>
              </div>

              <div className="relative h-3 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`absolute inset-y-0 left-0 ${config.bg} rounded-full transition-all duration-500`}
                  style={{ width: `${porcentaje}%` }}
                ></div>
              </div>

              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>{etapa.total_pasos} pasos</span>
                <span>Promedio: {etapa.minutos_promedio.toFixed(1)} min/paso</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 pt-6 border-t border-gray-200">
        <div className="flex items-center justify-between text-sm font-medium">
          <span className="text-gray-900">Total</span>
          <span className="text-gray-900">{totalMinutos.toFixed(0)} minutos</span>
        </div>
      </div>
    </Card>
  );
}
