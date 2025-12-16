import { Card } from '../ui/Card';
import { MetricaPaso } from '../../hooks/useProductivityMetrics';
import { Badge } from '../ui/Badge';

interface StepPerformanceChartProps {
  data: MetricaPaso[];
  loading?: boolean;
  limit?: number;
}

const etapaColors = {
  pre_prensa: 'blue',
  principal: 'green',
  post_prensa: 'orange',
} as const;

export function StepPerformanceChart({ data, loading, limit = 10 }: StepPerformanceChartProps) {
  if (loading) {
    return (
      <Card>
        <h3 className="text-lg font-semibold mb-6">Pasos Más Lentos</h3>
        <div className="animate-pulse space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="space-y-2">
              <div className="h-4 bg-gray-200 rounded w-40"></div>
              <div className="h-6 bg-gray-200 rounded"></div>
            </div>
          ))}
        </div>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card>
        <h3 className="text-lg font-semibold mb-4">Pasos Más Lentos</h3>
        <p className="text-gray-500 text-center py-8">No hay datos disponibles</p>
      </Card>
    );
  }

  const limitedData = data.slice(0, limit);
  const maxMinutos = Math.max(...limitedData.map((p) => p.minutos_promedio));

  return (
    <Card>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold">Pasos Más Lentos</h3>
        <span className="text-sm text-gray-500">Top {limit}</span>
      </div>

      <div className="space-y-4">
        {limitedData.map((paso, index) => {
          const porcentaje = (paso.minutos_promedio / maxMinutos) * 100;
          const etapaColor = etapaColors[paso.tipo_etapa as keyof typeof etapaColors] || 'gray';

          return (
            <div key={`${paso.paso_id}-${index}`} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="font-medium text-gray-900 truncate">{paso.paso_nombre}</span>
                  <Badge variant={etapaColor} size="sm">
                    {paso.tipo_etapa.replace('_', '-')}
                  </Badge>
                </div>
                <span className="text-sm font-semibold text-gray-900 ml-4">
                  {paso.minutos_promedio.toFixed(1)} min
                </span>
              </div>

              <div className="relative">
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-500"
                    style={{ width: `${porcentaje}%` }}
                  ></div>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>{paso.total_ejecuciones} ejecuciones</span>
                <span>
                  Rango: {paso.minutos_minimo.toFixed(1)} - {paso.minutos_maximo.toFixed(1)} min
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {data.length > limit && (
        <div className="mt-6 pt-4 border-t border-gray-200 text-center">
          <p className="text-sm text-gray-500">
            Mostrando {limit} de {data.length} pasos
          </p>
        </div>
      )}
    </Card>
  );
}
