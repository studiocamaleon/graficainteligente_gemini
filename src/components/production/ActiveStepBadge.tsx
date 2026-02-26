import type { EstadoOrdenItem, TipoEtapaRuta } from '../../types/database';

interface ActiveStepBadgeProps {
  pasoRelevante?: {
    nombre: string;
    estacion_nombre?: string | null;
    estado: 'pendiente' | 'en_proceso' | 'pausado';
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
    bg: 'bg-slate-100',
    text: 'text-slate-700',
    border: 'border-slate-200',
  },
  principal: {
    bg: 'bg-slate-100',
    text: 'text-slate-700',
    border: 'border-slate-200',
  },
  post_prensa: {
    bg: 'bg-slate-100',
    text: 'text-slate-700',
    border: 'border-slate-200',
  },
  instalacion: {
    bg: 'bg-slate-100',
    text: 'text-slate-700',
    border: 'border-slate-200',
  },
};

const sizeClasses = {
  sm: 'px-2 py-0.5 text-[11px]',
  md: 'px-3 py-1 text-xs',
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
        className={`inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 font-semibold text-emerald-700 ${sizeClasses[size]}`}
      >
        Completado
      </span>
    );
  }

  if (totalPasos === 0) {
    return (
      <span
        className={`inline-flex items-center rounded-full border border-amber-200 bg-amber-50 font-semibold text-amber-700 ${sizeClasses[size]}`}
      >
        Sin ruta
      </span>
    );
  }

  if (pasoRelevante) {
    const colors = pasoRelevante.estado === 'pausado'
      ? { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' }
      : etapaColors[pasoRelevante.etapa];
    const badgeText = pasoRelevante.estacion_nombre || pasoRelevante.nombre;

    return (
      <span
        className={`inline-flex items-center rounded-full border font-semibold ${colors.bg} ${colors.text} ${colors.border} ${sizeClasses[size]} max-w-[180px] truncate sm:max-w-[220px]`}
        title={pasoRelevante.estacion_nombre ? `Paso: ${pasoRelevante.nombre}` : pasoRelevante.nombre}
      >
        <span className="truncate">{badgeText}</span>
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center rounded-full border border-slate-200 bg-slate-100 font-semibold text-slate-600 ${sizeClasses[size]}`}
    >
      Sin paso activo
    </span>
  );
}
