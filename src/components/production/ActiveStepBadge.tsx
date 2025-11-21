import type { EstadoOrdenItem, TipoEtapaRuta } from '../../types/database';

interface ActiveStepBadgeProps {
  pasoRelevante?: {
    nombre: string;
    estado: 'pendiente' | 'en_proceso';
    etapa: TipoEtapaRuta;
  } | null;
  estadoJob: EstadoOrdenItem;
  totalPasos: number;
  size?: 'sm' | 'md';
}

const etapaColors: Record<
  TipoEtapaRuta,
  { bg: string; text: string; border: string }
> = {
  pre_prensa: {
    bg: 'bg-purple-100',
    text: 'text-purple-700',
    border: 'border-purple-300',
  },
  principal: {
    bg: 'bg-blue-100',
    text: 'text-blue-700',
    border: 'border-blue-300',
  },
  post_prensa: {
    bg: 'bg-green-100',
    text: 'text-green-700',
    border: 'border-green-300',
  },
};

const sizeClasses = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-3 py-1 text-sm',
};

export function ActiveStepBadge({
  pasoRelevante,
  estadoJob,
  totalPasos,
  size = 'sm',
}: ActiveStepBadgeProps) {
  if (estadoJob === 'finalizado') {
    return (
      <span
        className={`inline-flex items-center font-semibold rounded-full border bg-green-100 text-green-700 border-green-300 ${sizeClasses[size]}`}
      >
        ✓ Completado
      </span>
    );
  }

  if (totalPasos === 0) {
    return (
      <span
        className={`inline-flex items-center font-semibold rounded-full border bg-amber-100 text-amber-700 border-amber-300 ${sizeClasses[size]}`}
      >
        ⚠️ Sin ruta
      </span>
    );
  }

  if (pasoRelevante) {
    const icon = pasoRelevante.estado === 'en_proceso' ? '🔄' : '→';
    const colors = etapaColors[pasoRelevante.etapa];

    return (
      <span
        className={`inline-flex items-center font-semibold rounded-full border ${colors.bg} ${colors.text} ${colors.border} ${sizeClasses[size]} max-w-[160px] truncate`}
        title={pasoRelevante.nombre}
      >
        <span className="mr-1">{icon}</span>
        <span className="truncate">{pasoRelevante.nombre}</span>
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center font-semibold rounded-full border bg-gray-100 text-gray-600 border-gray-300 ${sizeClasses[size]}`}
    >
      Sin paso activo
    </span>
  );
}
