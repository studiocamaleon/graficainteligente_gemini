import { Banknote, CreditCard, DollarSign, FileText, HelpCircle } from 'lucide-react';
import type { MetodoPago } from '../../types/database';

interface PaymentMethodIconProps {
  metodo: MetodoPago;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
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

export function PaymentMethodIcon({ metodo, size = 'md', showLabel = false }: PaymentMethodIconProps) {
  const config = metodoConfig[metodo];
  const Icon = config.icon;

  if (showLabel) {
    return (
      <div className="inline-flex items-center gap-2">
        <Icon className={`${sizeClasses[size]} ${config.color}`} />
        <span className="text-sm font-medium text-gray-700">{config.label}</span>
      </div>
    );
  }

  return <Icon className={`${sizeClasses[size]} ${config.color}`} />;
}
