import { Banknote, CreditCard, DollarSign, FileText, HelpCircle } from 'lucide-react';
import type { MetodoPago } from '../../types/database';

interface PaymentMethodIconProps {
  metodo: MetodoPago | string;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

const metodoConfig: Record<
  MetodoPago,
  { label: string; icon: typeof DollarSign; color: string }
> = {
  Efectivo: {
    label: 'Efectivo',
    icon: Banknote,
    color: 'text-green-600',
  },
  Transferencia: {
    label: 'Transferencia',
    icon: DollarSign,
    color: 'text-blue-600',
  },
  'Tarjeta Credito': {
    label: 'Tarjeta de Crédito',
    icon: CreditCard,
    color: 'text-purple-600',
  },
  'Tarjeta Debito': {
    label: 'Tarjeta de Débito',
    icon: CreditCard,
    color: 'text-orange-600',
  },
  Cheque: {
    label: 'Cheque',
    icon: FileText,
    color: 'text-gray-600',
  },
  Otro: {
    label: 'Otro',
    icon: HelpCircle,
    color: 'text-gray-500',
  },
};

const sizeClasses = {
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-6 h-6',
};

export function PaymentMethodIcon({ metodo, size = 'md', showLabel = false, className = '' }: PaymentMethodIconProps) {
  const config = metodoConfig[metodo as MetodoPago];

  if (!config) {
    const Icon = CreditCard;
    const defaultColor = 'text-gray-600';

    if (showLabel) {
      return (
        <div className="inline-flex items-center gap-2">
          <Icon className={`${sizeClasses[size]} ${defaultColor} ${className}`} />
          <span className="text-sm font-medium text-gray-700">{metodo}</span>
        </div>
      );
    }

    return <Icon className={`${sizeClasses[size]} ${defaultColor} ${className}`} />;
  }

  const Icon = config.icon;

  if (showLabel) {
    return (
      <div className="inline-flex items-center gap-2">
        <Icon className={`${sizeClasses[size]} ${config.color} ${className}`} />
        <span className="text-sm font-medium text-gray-700">{config.label}</span>
      </div>
    );
  }

  return <Icon className={`${sizeClasses[size]} ${config.color} ${className}`} />;
}
