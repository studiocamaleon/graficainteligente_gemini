import { Pause, Clock } from 'lucide-react';

interface PausaBadgeProps {
  variant?: 'default' | 'detailed';
  tiempoPausadoHoras?: number;
  cantidadPausas?: number;
  className?: string;
}

export function PausaBadge({
  variant = 'default',
  tiempoPausadoHoras,
  cantidadPausas,
  className = '',
}: PausaBadgeProps) {
  const formatTiempo = (horas: number) => {
    if (horas < 1) {
      const minutos = Math.round(horas * 60);
      return `${minutos}min`;
    }
    if (horas < 24) {
      const h = Math.floor(horas);
      const m = Math.round((horas - h) * 60);
      return m > 0 ? `${h}h ${m}min` : `${h}h`;
    }
    const dias = Math.floor(horas / 24);
    const h = Math.floor(horas % 24);
    return h > 0 ? `${dias}d ${h}h` : `${dias}d`;
  };

  if (variant === 'default') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700 border border-orange-200 ${className}`}
      >
        <Pause className="w-3 h-3 animate-pulse" />
        Pausado
      </span>
    );
  }

  return (
    <div
      className={`inline-flex items-center gap-3 px-3 py-2 rounded-lg bg-orange-50 border border-orange-200 ${className}`}
    >
      <div className="flex items-center gap-1.5">
        <Pause className="w-4 h-4 text-orange-600 animate-pulse" />
        <span className="text-sm font-medium text-orange-900">Pausado</span>
      </div>

      {(tiempoPausadoHoras !== undefined || cantidadPausas !== undefined) && (
        <div className="flex items-center gap-3 text-xs">
          {tiempoPausadoHoras !== undefined && (
            <div className="flex items-center gap-1 text-orange-700">
              <Clock className="w-3 h-3" />
              <span>{formatTiempo(tiempoPausadoHoras)}</span>
            </div>
          )}

          {cantidadPausas !== undefined && cantidadPausas > 0 && (
            <div className="flex items-center gap-1 text-orange-700">
              <span className="font-medium">{cantidadPausas}</span>
              <span>{cantidadPausas === 1 ? 'pausa' : 'pausas'}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
