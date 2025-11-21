import type { EstadoOrdenItem } from '../../types/database';

interface ItemStatusBadgeProps {
  estado: EstadoOrdenItem;
  size?: 'sm' | 'md' | 'lg';
}

const estadoConfig: Record<
  EstadoOrdenItem,
  { label: string; className: string }
> = {
  pendiente: {
    label: 'Pendiente',
    className: 'bg-yellow-100 text-yellow-700 border-yellow-300',
  },
  en_proceso: {
    label: 'En Proceso',
    className: 'bg-blue-100 text-blue-700 border-blue-300',
  },
  finalizado: {
    label: 'Finalizado',
    className: 'bg-green-100 text-green-700 border-green-300',
  },
};

const sizeClasses = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-3 py-1 text-sm',
  lg: 'px-4 py-1.5 text-base',
};

export function ItemStatusBadge({ estado, size = 'md' }: ItemStatusBadgeProps) {
  const config = estadoConfig[estado];

  return (
    <span
      className={`inline-flex items-center font-semibold rounded-full border ${config.className} ${sizeClasses[size]}`}
    >
      {config.label}
    </span>
  );
}
