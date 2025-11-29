import { AlertTriangle, CheckCircle, TrendingUp, TrendingDown } from 'lucide-react';
import { Card } from '../ui/Card';
import type { TasaSenaData } from '../../types/reportes';

interface TasaSenaCardProps {
  data?: TasaSenaData | null;
  loading?: boolean;
}

const META_SENA = 50;

export function TasaSenaCard({ data, loading }: TasaSenaCardProps) {
  if (loading) {
    return (
      <Card>
        <div className="p-8 animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-24 bg-gray-200 rounded"></div>
        </div>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card>
        <div className="p-8 text-center text-gray-500">
          No hay datos disponibles
        </div>
      </Card>
    );
  }

  const tasaSena = data.tasa_sena_promedio;
  const diferenciaMeta = tasaSena - META_SENA;
  const porcentajeHaciaMeta = (tasaSena / META_SENA) * 100;

  const getEstado = () => {
    if (tasaSena < 30) {
      return {
        icono: AlertTriangle,
        color: 'text-red-600',
        bgColor: 'bg-red-50',
        borderColor: 'border-red-200',
        mensaje: 'Alerta Roja: Riesgo de Liquidez',
        emoji: '🚨',
      };
    }
    if (tasaSena < 45) {
      return {
        icono: AlertTriangle,
        color: 'text-yellow-600',
        bgColor: 'bg-yellow-50',
        borderColor: 'border-yellow-200',
        mensaje: 'Alerta Amarilla: Mejorable',
        emoji: '⚠️',
      };
    }
    if (tasaSena < 55) {
      return {
        icono: CheckCircle,
        color: 'text-green-600',
        bgColor: 'bg-green-50',
        borderColor: 'border-green-200',
        mensaje: 'Cerca de Meta: Buen Desempeño',
        emoji: '✅',
      };
    }
    return {
      icono: CheckCircle,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50',
      borderColor: 'border-emerald-200',
      mensaje: 'Excelente: Por Encima de Meta',
      emoji: '🎉',
    };
  };

  const estado = getEstado();
  const IconoEstado = estado.icono;

  return (
    <Card>
      <div className={`p-6 border-l-4 ${estado.borderColor}`}>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-gray-900">
            Análisis de Tasa de Seña
          </h3>
          <span className="text-3xl">{estado.emoji}</span>
        </div>

        <div className={`${estado.bgColor} rounded-lg p-6 mb-6 border ${estado.borderColor}`}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm text-gray-600 mb-1">Tasa de Seña Promedio</p>
              <p className="text-4xl font-bold text-gray-900">{tasaSena.toFixed(1)}%</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600 mb-1">Meta</p>
              <p className="text-2xl font-bold text-gray-700">{META_SENA}%</p>
            </div>
          </div>

          <div className="flex items-center gap-2 mb-2">
            <IconoEstado className={`w-5 h-5 ${estado.color}`} />
            <span className={`text-sm font-semibold ${estado.color}`}>
              {estado.mensaje}
            </span>
          </div>

          <div className="flex items-center gap-2 text-sm">
            {diferenciaMeta >= 0 ? (
              <>
                <TrendingUp className="w-4 h-4 text-green-600" />
                <span className="text-green-600 font-medium">
                  +{diferenciaMeta.toFixed(1)}% por encima de la meta
                </span>
              </>
            ) : (
              <>
                <TrendingDown className="w-4 h-4 text-red-600" />
                <span className="text-red-600 font-medium">
                  {diferenciaMeta.toFixed(1)}% por debajo de la meta
                </span>
              </>
            )}
          </div>
        </div>

        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Progreso hacia Meta</span>
            <span className="text-sm font-bold text-gray-900">{porcentajeHaciaMeta.toFixed(0)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-4">
            <div
              className={`h-4 rounded-full transition-all duration-500 ${
                tasaSena >= META_SENA ? 'bg-green-500' : 'bg-orange-500'
              }`}
              style={{ width: `${Math.min(porcentajeHaciaMeta, 100)}%` }}
            ></div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <p className="text-sm text-gray-600 mb-1">Órdenes con Seña</p>
            <p className="text-2xl font-bold text-gray-900">{data.ordenes_con_sena}</p>
            <p className="text-xs text-green-600 mt-1">
              {data.porcentaje_ordenes_con_sena.toFixed(1)}% del total
            </p>
          </div>
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <p className="text-sm text-gray-600 mb-1">Órdenes sin Seña</p>
            <p className="text-2xl font-bold text-gray-900">{data.ordenes_sin_sena}</p>
            <p className="text-xs text-red-600 mt-1">
              {(100 - data.porcentaje_ordenes_con_sena).toFixed(1)}% del total
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div>
            <p className="text-xs text-gray-600 mb-1">Total Cobrado</p>
            <p className="text-lg font-bold text-green-600">${data.total_cobrado.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-600 mb-1">Saldo Pendiente</p>
            <p className="text-lg font-bold text-orange-600">${data.saldo_pendiente.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-600 mb-1">Monto Prom. Seña</p>
            <p className="text-lg font-bold text-blue-600">${data.monto_sena_promedio.toFixed(2)}</p>
          </div>
        </div>

        {tasaSena < 45 && (
          <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-sm font-semibold text-blue-900 mb-2">
              💡 Recomendaciones
            </p>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Reforzar política de solicitud del 50% de seña en nuevos trabajos</li>
              <li>• Capacitar al equipo sobre la importancia de la seña para liquidez</li>
              <li>• Considerar descuentos o incentivos para pagos anticipados mayores</li>
            </ul>
          </div>
        )}
      </div>
    </Card>
  );
}
