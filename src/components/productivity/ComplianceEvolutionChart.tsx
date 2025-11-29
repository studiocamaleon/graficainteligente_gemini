import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Card } from '../ui/Card';
import type { EvolutivoTasaCumplimiento } from '../../types/database';

interface ComplianceEvolutionChartProps {
  data: EvolutivoTasaCumplimiento[];
  loading?: boolean;
}

export function ComplianceEvolutionChart({ data, loading = false }: ComplianceEvolutionChartProps) {
  if (loading) {
    return (
      <Card>
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-64 mb-6"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Evolución de Tasa de Cumplimiento
        </h3>
        <div className="flex items-center justify-center h-64 text-gray-500">
          <p>No hay datos suficientes para mostrar la evolución</p>
        </div>
      </Card>
    );
  }

  const maxTasa = Math.max(...data.map(d => d.tasa_cumplimiento), 100);
  const minTasa = Math.min(...data.map(d => d.tasa_cumplimiento), 0);
  const range = maxTasa - minTasa;
  const yAxisMin = Math.max(0, minTasa - range * 0.1);
  const yAxisMax = Math.min(100, maxTasa + range * 0.1);

  const getTendenciaIcon = (tendencia: 'up' | 'down' | 'neutral') => {
    switch (tendencia) {
      case 'up':
        return <TrendingUp className="w-4 h-4 text-green-600" />;
      case 'down':
        return <TrendingDown className="w-4 h-4 text-red-600" />;
      case 'neutral':
        return <Minus className="w-4 h-4 text-gray-600" />;
    }
  };

  const getTasaColor = (tasa: number) => {
    if (tasa >= 95) return 'text-green-600';
    if (tasa >= 85) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getBarColor = (tasa: number) => {
    if (tasa >= 95) return 'bg-green-500';
    if (tasa >= 85) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getBarHeight = (tasa: number) => {
    const normalizedValue = ((tasa - yAxisMin) / (yAxisMax - yAxisMin)) * 100;
    return Math.max(2, normalizedValue);
  };

  return (
    <Card>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">
          Evolución de Tasa de Cumplimiento
        </h3>
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-green-500 rounded"></div>
            <span className="text-gray-600">≥95%</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-yellow-500 rounded"></div>
            <span className="text-gray-600">85-94%</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-red-500 rounded"></div>
            <span className="text-gray-600">&lt;85%</span>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {data.map((item, index) => (
          <div key={index} className="group">
            <div className="flex items-center gap-3 mb-1">
              <span className="text-sm font-medium text-gray-700 w-32">
                {item.periodo_label}
              </span>
              <div className="flex-1 flex items-center gap-2">
                <div className="flex-1 bg-gray-100 rounded-full h-8 relative overflow-hidden">
                  <div
                    className={`h-full ${getBarColor(item.tasa_cumplimiento)} transition-all duration-500 rounded-full flex items-center justify-end pr-3`}
                    style={{ width: `${getBarHeight(item.tasa_cumplimiento)}%` }}
                  >
                    {item.tasa_cumplimiento > 10 && (
                      <span className="text-white text-sm font-bold">
                        {item.tasa_cumplimiento.toFixed(1)}%
                      </span>
                    )}
                  </div>
                  {item.tasa_cumplimiento <= 10 && (
                    <span className={`absolute left-2 top-1/2 -translate-y-1/2 text-sm font-bold ${getTasaColor(item.tasa_cumplimiento)}`}>
                      {item.tasa_cumplimiento.toFixed(1)}%
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 w-24">
                  {getTendenciaIcon(item.tendencia)}
                  <span className="text-xs text-gray-600">
                    {item.ordenes_a_tiempo}/{item.total_ordenes}
                  </span>
                </div>
              </div>
            </div>

            <div className="opacity-0 group-hover:opacity-100 transition-opacity pl-32 pb-2">
              <div className="text-xs text-gray-500 flex gap-4">
                <span>A tiempo: {item.ordenes_a_tiempo}</span>
                <span>Retrasadas: {item.ordenes_retrasadas}</span>
                <span>Total: {item.total_ordenes}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 pt-4 border-t border-gray-200">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">Meta de cumplimiento:</span>
          <span className="font-bold text-gray-900">≥ 95%</span>
        </div>
      </div>
    </Card>
  );
}
