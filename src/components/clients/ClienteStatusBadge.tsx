import { CheckCircle2, XCircle, Clock } from 'lucide-react';

interface ClienteStatusBadgeProps {
  status: 'pending' | 'approved' | 'rejected';
  className?: string;
}

export function ClienteStatusBadge({ status, className = '' }: ClienteStatusBadgeProps) {
  const config = {
    pending: {
      label: 'Pendiente',
      icon: Clock,
      className: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    },
    approved: {
      label: 'Aprobado',
      icon: CheckCircle2,
      className: 'bg-green-100 text-green-800 border-green-300',
    },
    rejected: {
      label: 'Rechazado',
      icon: XCircle,
      className: 'bg-red-100 text-red-800 border-red-300',
    },
  };

  const { label, icon: Icon, className: statusClassName } = config[status];

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold border ${statusClassName} ${className}`}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}
