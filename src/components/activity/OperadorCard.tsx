import { Clock, CheckCircle2, XCircle, Zap } from 'lucide-react';
import { Avatar } from '../ui/Avatar';
import { Card } from '../ui/card';
import type { MetricasRendimientoOperador } from '../../types/database';

interface OperadorCardProps {
  metricas: MetricasRendimientoOperador;
  isTopPerformer?: boolean;
  onClick?: () => void;
}

export function OperadorCard({ metricas, isTopPerformer, onClick }: OperadorCardProps) {
  const formatHoras = (horas: number) => {
    return `${horas.toFixed(1)}h`;
  };

  const formatMinutos = (minutos: number) => {
    return `${Math.round(minutos)} min`;
  };

  return (
    <Card
      hover={!!onClick}
      onClick={onClick}
      className={`relative ${isTopPerformer ? 'ring-2 ring-yellow-400' : ''}`}
    >
      {isTopPerformer && (
        <div className="absolute top-0 right-0 -mt-2 -mr-2">
          <div className="bg-yellow-400 text-yellow-900 p-2 rounded-full shadow-lg">
            <Zap className="w-4 h-4 fill-current" />
          </div>
        </div>
      )}

      <div className="flex items-start gap-4 mb-4">
        <Avatar
          name={metricas.responsable_nombre}
          src={metricas.responsable_avatar || undefined}
          size="lg"
        />
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 truncate">
            {metricas.responsable_nombre}
          </h3>
          <p className="text-sm text-gray-500 truncate">{metricas.responsable_email}</p>
          {isTopPerformer && (
            <span className="inline-flex items-center gap-1 mt-1 text-xs font-medium text-yellow-700">
              <Zap className="w-3 h-3" />
              Top Performer
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <div className="flex items-center gap-1 text-sm text-gray-500 mb-1">
            <CheckCircle2 className="w-4 h-4 text-green-500" />
            <span>Completados</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {metricas.total_pasos_completados}
          </p>
        </div>

        <div>
          <div className="flex items-center gap-1 text-sm text-gray-500 mb-1">
            <Clock className="w-4 h-4 text-blue-500" />
            <span>Horas</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {formatHoras(metricas.tiempo_total_horas)}
          </p>
        </div>
      </div>

      <div className="space-y-2 py-3 border-t border-gray-200">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">Promedio por paso</span>
          <span className="font-medium text-gray-900">
            {formatMinutos(metricas.tiempo_promedio_minutos)}
          </span>
        </div>

        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">Tasa de completitud</span>
          <span className="font-medium text-green-600">
            {metricas.tasa_completitud.toFixed(0)}%
          </span>
        </div>

        {metricas.total_pasos_omitidos > 0 && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600 flex items-center gap-1">
              <XCircle className="w-3 h-3 text-gray-400" />
              Omitidos
            </span>
            <span className="font-medium text-gray-600">
              {metricas.total_pasos_omitidos}
            </span>
          </div>
        )}
      </div>

      <div className="mt-3 pt-3 border-t border-gray-200">
        <div className="text-xs text-gray-500 mb-2">Distribución por etapa</div>
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="text-center">
            <div className="font-semibold text-blue-600">{metricas.pasos_prensa}</div>
            <div className="text-gray-500">Prensa</div>
          </div>
          <div className="text-center">
            <div className="font-semibold text-purple-600">
              {metricas.pasos_post_prensa}
            </div>
            <div className="text-gray-500">Post</div>
          </div>
          <div className="text-center">
            <div className="font-semibold text-green-600">
              {metricas.pasos_terminacion}
            </div>
            <div className="text-gray-500">Term.</div>
          </div>
        </div>
      </div>
    </Card>
  );
}
