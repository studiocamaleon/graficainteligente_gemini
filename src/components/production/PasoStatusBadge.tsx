import type { EstadoPaso } from '../../types/database';
import { CheckCircle2, Circle, Clock, XCircle } from 'lucide-react';

interface PasoStatusBadgeProps {
  estado: EstadoPaso;
  showIcon?: boolean;
  size?: 'sm' | 'md';
}

const estadoConfig: Record<
  EstadoPaso,
  { label: string; className: string; Icon: typeof Circle }
> = {
  pendiente: {
    label: 'Pendiente',
    className: 'bg-gray-100 text-gray-700',
    Icon: Circle,
  },
  en_proceso: {
    label: 'En Proceso',
    className: 'bg-blue-100 text-blue-700',
    Icon: Clock,
  },
  completado: {
    label: 'Completado',
    className: 'bg-green-100 text-green-700',
    Icon: CheckCircle2,
  },
  omitido: {
    label: 'Omitido',
    className: 'bg-gray-200 text-gray-600',
    Icon: XCircle,
  },
};

const sizeClasses = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-sm',
};

const iconSizeClasses = {
  sm: 'w-3 h-3',
  md: 'w-3.5 h-3.5',
};

export function PasoStatusBadge({
  estado,
  showIcon = true,
  size = 'sm',
}: PasoStatusBadgeProps) {
  const { label, className, Icon } = estadoConfig[estado];

  return (
    <span
      className={`inline-flex items-center gap-1 font-medium rounded-full ${className} ${sizeClasses[size]}`}
    >
      {showIcon && <Icon className={iconSizeClasses[size]} />}
      {label}
    </span>
  );
}
