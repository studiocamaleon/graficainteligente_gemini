import { Card } from '../ui/card';
import { CuelloBottella } from '../../hooks/useProductivityMetrics';
import { AlertTriangle, TrendingUp } from 'lucide-react';
import { Badge } from '../ui/Badge';

interface BottleneckAlertProps {
  data: CuelloBottella[];
  loading?: boolean;
}

export function BottleneckAlert({ data, loading }: BottleneckAlertProps) {
  if (loading) {
    return (
      <Card>
        <div className="flex items-center gap-3 mb-4">
          <AlertTriangle className="w-5 h-5 text-orange-600" />
          <h3 className="text-lg font-semibold">Cuellos de Botella</h3>
        </div>
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-gray-200 rounded"></div>
          ))}
        </div>
      </Card>
    );
  }

  const bottlenecks = data.filter((item) => item.es_cuello_botella);

  if (bottlenecks.length === 0) {
    return (
      <Card className="border-green-200 bg-green-50">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-green-100 rounded-lg">
            <TrendingUp className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-green-900 mb-1">
              No se detectaron cuellos de botella
            </h3>
            <p className="text-sm text-green-700">
              Todos los pasos están operando dentro de rangos normales de tiempo y consistencia.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="border-orange-200">
      <div className="flex items-center gap-3 mb-4">
        <AlertTriangle className="w-5 h-5 text-orange-600" />
        <h3 className="text-lg font-semibold">
          Cuellos de Botella Detectados ({bottlenecks.length})
        </h3>
      </div>

      <div className="space-y-3">
        {bottlenecks.map((cuello, index) => (
          <div
            key={index}
            className="p-4 border border-orange-100 rounded-lg bg-orange-50 hover:bg-orange-100 transition-colors"
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                <h4 className="font-semibold text-gray-900">{cuello.paso_nombre}</h4>
                <Badge variant="orange" size="sm" className="mt-1">
                  {cuello.tipo_etapa.replace('_', '-')}
                </Badge>
              </div>
              <span className="text-lg font-bold text-orange-600">
                {cuello.minutos_promedio.toFixed(1)} min
              </span>
            </div>

            <p className="text-sm text-gray-700 mb-2">{cuello.razon}</p>

            <div className="grid grid-cols-3 gap-4 text-xs">
              <div>
                <span className="text-gray-600">Ejecuciones:</span>
                <span className="ml-1 font-medium text-gray-900">{cuello.total_ejecuciones}</span>
              </div>
              <div>
                <span className="text-gray-600">Desv. Est.:</span>
                <span className="ml-1 font-medium text-gray-900">
                  {cuello.desviacion_estandar.toFixed(1)} min
                </span>
              </div>
              <div>
                <span className="text-gray-600">Coef. Var.:</span>
                <span className="ml-1 font-medium text-gray-900">
                  {cuello.coeficiente_variacion.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-900">
          <strong>Recomendación:</strong> Considera revisar estos pasos para identificar
          oportunidades de optimización, recursos adicionales o mejoras en los procesos.
        </p>
      </div>
    </Card>
  );
}
