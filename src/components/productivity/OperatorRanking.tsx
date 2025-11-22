import { Card } from '../ui/Card';
import { SimpleTable } from '../ui/SimpleTable';
import { MetricaOperario } from '../../hooks/useProductivityMetrics';
import { Award, User } from 'lucide-react';

interface OperatorRankingProps {
  data: MetricaOperario[];
  loading?: boolean;
}

export function OperatorRanking({ data, loading }: OperatorRankingProps) {
  if (loading) {
    return (
      <Card>
        <h3 className="text-lg font-semibold mb-6">Ranking de Operarios</h3>
        <div className="animate-pulse space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-4">
              <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-200 rounded w-32"></div>
                <div className="h-3 bg-gray-200 rounded w-48"></div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card>
        <h3 className="text-lg font-semibold mb-4">Ranking de Operarios</h3>
        <div className="text-center py-8">
          <User className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-500">No hay datos de operarios disponibles</p>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex items-center gap-3 mb-6">
        <Award className="w-5 h-5 text-yellow-600" />
        <h3 className="text-lg font-semibold">Ranking de Operarios</h3>
      </div>

      <SimpleTable>
        <thead className="bg-gray-50 border-b-2 border-gray-200">
          <tr>
            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Posición</th>
            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Operario</th>
            <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Pasos Completados</th>
            <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Tiempo Prom./Paso</th>
            <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Total Horas</th>
            <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Consistencia</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {data.map((operario, index) => {
            const isTop3 = index < 3;
            const positionColor =
              index === 0
                ? 'text-yellow-600 bg-yellow-50'
                : index === 1
                ? 'text-gray-600 bg-gray-100'
                : index === 2
                ? 'text-orange-600 bg-orange-50'
                : 'text-gray-700';

            const consistencia = operario.desviacion_estandar / operario.minutos_promedio_por_paso;
            const consistenciaLabel =
              consistencia < 0.2
                ? 'Excelente'
                : consistencia < 0.5
                ? 'Buena'
                : 'Regular';
            const consistenciaColor =
              consistencia < 0.2
                ? 'text-green-600 bg-green-50'
                : consistencia < 0.5
                ? 'text-blue-600 bg-blue-50'
                : 'text-yellow-600 bg-yellow-50';

            return (
              <tr key={operario.operario_id} className={`hover:bg-gray-50 ${isTop3 ? 'bg-gray-50' : ''}`}>
                <td className="px-6 py-4">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                      isTop3 ? positionColor : 'bg-white border border-gray-200'
                    }`}
                  >
                    {index + 1}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-sm font-semibold">
                      {operario.operario_nombre.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">{operario.operario_nombre}</div>
                      {operario.operario_email && (
                        <div className="text-xs text-gray-500">{operario.operario_email}</div>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 text-right font-semibold">{operario.total_pasos_completados}</td>
                <td className="px-6 py-4 text-right">
                  {operario.minutos_promedio_por_paso.toFixed(1)} min
                </td>
                <td className="px-6 py-4 text-right">{operario.total_horas.toFixed(1)} h</td>
                <td className="px-6 py-4 text-right">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${consistenciaColor}`}>
                    {consistenciaLabel}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </SimpleTable>

      {data.length > 0 && (
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-900">
            <strong>Nota:</strong> El ranking se basa en la cantidad de pasos completados. La
            consistencia mide la variabilidad en los tiempos de ejecución.
          </p>
        </div>
      )}
    </Card>
  );
}
