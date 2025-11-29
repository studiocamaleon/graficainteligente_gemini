import { CheckCircle2, XCircle, Calendar, Clock, TrendingUp, TrendingDown } from 'lucide-react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import type { TasaCumplimiento } from '../../types/database';

interface ComplianceDetailsTableProps {
  data: TasaCumplimiento | null;
  loading?: boolean;
}

export function ComplianceDetailsTable({ data, loading = false }: ComplianceDetailsTableProps) {
  if (loading) {
    return (
      <Card>
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-64 mb-6"></div>
          <div className="space-y-3">
            <div className="h-12 bg-gray-200 rounded"></div>
            <div className="h-12 bg-gray-200 rounded"></div>
            <div className="h-12 bg-gray-200 rounded"></div>
          </div>
        </div>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Detalles de Cumplimiento
        </h3>
        <div className="flex items-center justify-center h-32 text-gray-500">
          <p>No hay datos disponibles</p>
        </div>
      </Card>
    );
  }

  const promedioGeneral = data.ordenes_a_tiempo > 0
    ? (data.promedio_dias_adelanto * data.ordenes_a_tiempo + data.promedio_dias_retraso * data.ordenes_retrasadas) / data.total_ordenes_evaluadas
    : 0;

  const rows = [
    {
      label: 'Órdenes Evaluadas',
      value: data.total_ordenes_evaluadas,
      icon: Calendar,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      description: 'Total de órdenes completadas con fecha estimada',
    },
    {
      label: 'Órdenes a Tiempo',
      value: data.ordenes_a_tiempo,
      icon: CheckCircle2,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      description: `Completadas antes o en la fecha estimada (${((data.ordenes_a_tiempo / data.total_ordenes_evaluadas) * 100).toFixed(1)}%)`,
      badge: data.promedio_dias_adelanto > 0 ? (
        <Badge variant="success" className="flex items-center gap-1">
          <TrendingUp className="w-3 h-3" />
          {data.promedio_dias_adelanto.toFixed(1)}d adelanto prom.
        </Badge>
      ) : null,
    },
    {
      label: 'Órdenes Retrasadas',
      value: data.ordenes_retrasadas,
      icon: XCircle,
      color: 'text-red-600',
      bgColor: 'bg-red-50',
      description: `Completadas después de la fecha estimada (${((data.ordenes_retrasadas / data.total_ordenes_evaluadas) * 100).toFixed(1)}%)`,
      badge: data.promedio_dias_retraso > 0 ? (
        <Badge variant="error" className="flex items-center gap-1">
          <TrendingDown className="w-3 h-3" />
          {data.promedio_dias_retraso.toFixed(1)}d retraso prom.
        </Badge>
      ) : null,
    },
    {
      label: 'Sin Fecha Estimada',
      value: data.ordenes_sin_fecha_estimada,
      icon: Clock,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50',
      description: 'Órdenes completadas sin fecha estimada (no evaluadas)',
    },
  ];

  return (
    <Card>
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Detalles de Cumplimiento
        </h3>
        <p className="text-sm text-gray-600">
          Análisis detallado del cumplimiento de plazos de entrega
        </p>
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Métrica
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Cantidad
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Detalles
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {rows.map((row, index) => {
              const Icon = row.icon;
              return (
                <tr key={index} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${row.bgColor}`}>
                        <Icon className={`w-5 h-5 ${row.color}`} />
                      </div>
                      <span className="text-sm font-medium text-gray-900">
                        {row.label}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <span className={`text-2xl font-bold ${row.color}`}>
                      {row.value}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm text-gray-600">
                        {row.description}
                      </p>
                      {row.badge}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Clock className="w-5 h-5 text-blue-600" />
          </div>
          <div className="flex-1">
            <h4 className="text-sm font-semibold text-blue-900 mb-1">
              Información sobre el Cálculo
            </h4>
            <p className="text-xs text-blue-700 leading-relaxed">
              La tasa de cumplimiento se calcula comparando la fecha de completado con la fecha estimada de entrega.
              Una orden se considera "a tiempo" si se completó antes o el mismo día de la fecha estimada.
              Las órdenes sin fecha estimada no se incluyen en el cálculo del porcentaje de cumplimiento.
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
}
