import type { EstadoOrdenTrabajo } from '../../types/database';

interface OrderStatusBadgeProps {
  estado: EstadoOrdenTrabajo;
  size?: 'sm' | 'md' | 'lg';
}

const estadoConfig: Record<
  EstadoOrdenTrabajo,
  { label: string; className: string }
> = {
  borrador: {
    label: 'Borrador',
    className: 'bg-gray-100 text-gray-700 border-gray-300',
  },
  pendiente: {
    label: 'Pendiente',
    className: 'bg-yellow-100 text-yellow-700 border-yellow-300',
  },
  en_proceso: {
    label: 'En Proceso',
    className: 'bg-blue-100 text-blue-700 border-blue-300',
  },
  finalizada: {
    label: 'Finalizada',
    className: 'bg-green-100 text-green-700 border-green-300',
  },
  entregada: {
    label: 'Entregada',
    className: 'bg-teal-100 text-teal-700 border-teal-300',
  },
  cancelada: {
    label: 'Cancelada',
    className: 'bg-red-100 text-red-700 border-red-300',
  },
};

const sizeClasses = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-3 py-1 text-sm',
  lg: 'px-4 py-1.5 text-base',
};

export function OrderStatusBadge({ estado, size = 'md' }: OrderStatusBadgeProps) {
  const config = estadoConfig[estado];

  return (
    <span
      className={`inline-flex items-center font-semibold rounded-full border ${config.className} ${sizeClasses[size]}`}
    >
      {config.label}
    </span>
  );
}
