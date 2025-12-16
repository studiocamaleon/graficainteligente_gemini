import { Check, Loader2, Circle, X, Pause, Clock } from 'lucide-react';
import type { TrackingPaso } from '../../types/tracking';
import { getEstadoPasoLabel, getEtapaLabel, getCategoriaPausaLabel, getCategoriaPausaIcon } from '../../types/tracking';
import dayjs from 'dayjs';

interface TrackingStepProgressProps {
  pasos: TrackingPaso[];
}

export function TrackingStepProgress({ pasos }: TrackingStepProgressProps) {
  if (pasos.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        <p>No hay pasos de producción registrados</p>
      </div>
    );
  }

  const getStepIcon = (estado: string) => {
    switch (estado) {
      case 'completado':
        return <Check className="w-5 h-5 text-green-400" />;
      case 'en_proceso':
        return <Loader2 className="w-5 h-5 text-cyan-400 animate-spin" />;
      case 'pausado':
        return <Pause className="w-5 h-5 text-orange-400 animate-pulse" />;
      case 'omitido':
        return <X className="w-5 h-5 text-red-400" />;
      default:
        return <Circle className="w-3 h-3 text-gray-500" />;
    }
  };

  const getStepColor = (estado: string) => {
    switch (estado) {
      case 'completado':
        return 'border-green-500 bg-green-500/10 shadow-green-500/30';
      case 'en_proceso':
        return 'border-cyan-500 bg-cyan-500/10 shadow-cyan-500/30 animate-pulse';
      case 'pausado':
        return 'border-orange-500 bg-orange-500/10 shadow-orange-500/30 animate-pulse';
      case 'omitido':
        return 'border-red-500 bg-red-500/10 shadow-red-500/30';
      default:
        return 'border-gray-600 bg-gray-700/30';
    }
  };

  const getLineColor = (estado: string) => {
    switch (estado) {
      case 'completado':
        return 'bg-gradient-to-b from-green-500 to-green-600';
      case 'en_proceso':
        return 'bg-gradient-to-b from-cyan-500 to-cyan-600';
      case 'pausado':
        return 'bg-gradient-to-b from-orange-500 to-orange-600';
      default:
        return 'bg-gray-700';
    }
  };

  return (
    <div className="space-y-1">
      {pasos.map((paso, index) => {
        const isLast = index === pasos.length - 1;
        const showLine = !isLast;

        return (
          <div key={paso.id} className="flex">
            <div className="flex flex-col items-center mr-4">
              <div
                className={`w-10 h-10 rounded-full border-2 flex items-center justify-center shadow-lg transition-all duration-300 ${getStepColor(
                  paso.estado_paso
                )}`}
              >
                {getStepIcon(paso.estado_paso)}
              </div>

              {showLine && (
                <div
                  className={`w-1 h-12 mt-1 transition-all duration-500 ${getLineColor(
                    paso.estado_paso
                  )}`}
                />
              )}
            </div>

            <div className="flex-1 pb-8">
              <div className="bg-[#1A1F3A] border border-cyan-500/10 rounded-xl p-4 hover:border-cyan-500/30 transition-all duration-300">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h4 className="font-semibold text-white text-lg">{paso.paso_nombre}</h4>
                    <p className="text-sm text-gray-400">{getEtapaLabel(paso.tipo_etapa)}</p>
                  </div>
                  <span
                    className={`text-xs px-3 py-1 rounded-full font-medium ${paso.estado_paso === 'completado'
                        ? 'bg-green-500/20 text-green-300'
                        : paso.estado_paso === 'en_proceso'
                          ? 'bg-cyan-500/20 text-cyan-300'
                          : paso.estado_paso === 'pausado'
                            ? 'bg-orange-500/20 text-orange-300 animate-pulse'
                            : paso.estado_paso === 'omitido'
                              ? 'bg-red-500/20 text-red-300'
                              : 'bg-gray-500/20 text-gray-400'
                      }`}
                  >
                    {getEstadoPasoLabel(paso.estado_paso)}
                  </span>
                </div>

                {/* Mensaje contextual de pausa */}
                {paso.estado_paso === 'pausado' && paso.pausa_info?.esta_pausado && paso.pausa_info.categoria_motivo && (
                  <div className="mb-3 bg-orange-500/10 border border-orange-500/30 rounded-lg p-3">
                    <div className="flex items-start gap-2">
                      <span className="text-2xl">{getCategoriaPausaIcon(paso.pausa_info.categoria_motivo)}</span>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-orange-300 mb-1">
                          {getCategoriaPausaLabel(paso.pausa_info.categoria_motivo)}
                        </p>
                        {paso.pausa_info.tiempo_pausado_horas !== undefined && (
                          <div className="flex items-center gap-1.5 text-xs text-orange-400">
                            <Clock className="w-3 h-3" />
                            <span>
                              Pausado hace{' '}
                              {paso.pausa_info.tiempo_pausado_horas < 1
                                ? `${Math.round(paso.pausa_info.tiempo_pausado_horas * 60)} minutos`
                                : paso.pausa_info.tiempo_pausado_horas < 24
                                  ? `${Math.floor(paso.pausa_info.tiempo_pausado_horas)} horas`
                                  : `${Math.floor(paso.pausa_info.tiempo_pausado_horas / 24)} días`}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {paso.fecha_inicio && (
                  <div className="text-sm text-gray-400 mb-2">
                    <span className="font-medium">Inicio:</span>{' '}
                    {dayjs(paso.fecha_inicio).format('DD/MM/YYYY HH:mm')}
                    {paso.fecha_fin && (
                      <>
                        {' • '}
                        <span className="font-medium">Fin:</span>{' '}
                        {dayjs(paso.fecha_fin).format('DD/MM/YYYY HH:mm')}
                      </>
                    )}
                  </div>
                )}

                {/* Indicador de pausas previas */}
                {(paso.cantidad_pausas || 0) > 0 && paso.estado_paso !== 'pausado' && (
                  <div className="mt-2 text-xs text-gray-500 flex items-center gap-1">
                    <Pause className="w-3 h-3" />
                    <span>
                      Este paso fue pausado {paso.cantidad_pausas} {paso.cantidad_pausas === 1 ? 'vez' : 'veces'}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
