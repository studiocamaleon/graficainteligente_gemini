import {
  FileText,
  Clock,
  CheckCircle,
  TrendingUp,
  DollarSign,
  AlertCircle,
  Calculator,
} from 'lucide-react';
import { Card } from '../ui/card';
import { usePresupuestosStats } from '../../hooks/usePresupuestosStats';
import type { PresupuestosFilters } from '../../types/presupuestos';

interface PresupuestosStatsProps {
  filters?: PresupuestosFilters;
}

export function PresupuestosStats({ filters }: PresupuestosStatsProps) {
  const { stats, loading } = usePresupuestosStats(filters);

  if (loading || !stats) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="p-4 animate-pulse">
            <div className="h-16 bg-gray-100 rounded"></div>
          </Card>
        ))}
      </div>
    );
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const totalEnviados =
    stats.enviado_count +
    stats.aprobado_count +
    stats.rechazado_count +
    stats.convertido_count +
    stats.vencido_count;

  const tasaConversion = stats.total_count > 0
    ? (stats.convertido_count / stats.total_count) * 100
    : 0;

  const statCards = [
    {
      title: 'Total Presupuestos',
      value: stats.total_count.toString(),
      icon: FileText,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      title: 'Pendientes de Cotizar',
      value: stats.pendientes_cotizar_count.toString(),
      subtitle: 'En borradores',
      icon: Calculator,
      color: stats.pendientes_cotizar_count > 0 ? 'text-amber-600' : 'text-gray-400',
      bgColor: stats.pendientes_cotizar_count > 0 ? 'bg-amber-50' : 'bg-gray-50',
    },
    {
      title: 'En Negociación',
      value: stats.enviado_count.toString(),
      subtitle: formatCurrency(stats.valor_en_negociacion),
      icon: Clock,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
    },
    {
      title: 'Aprobados',
      value: stats.aprobado_count.toString(),
      subtitle: `${stats.convertido_count} convertidos`,
      icon: CheckCircle,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    },
    {
      title: 'Tasa Conversión',
      value: `${tasaConversion.toFixed(1)}%`,
      subtitle: `${stats.convertido_count} de ${stats.total_count}`,
      icon: TrendingUp,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
    },
    {
      title: 'Valor Total',
      value: formatCurrency(stats.valor_total),
      icon: DollarSign,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50',
    },
    {
      title: 'Por Vencer (7 días)',
      value: stats.por_vencer_count.toString(),
      subtitle: stats.vencido_count > 0 ? `${stats.vencido_count} vencidos` : undefined,
      icon: AlertCircle,
      color: stats.por_vencer_count > 0 ? 'text-yellow-600' : 'text-gray-400',
      bgColor: stats.por_vencer_count > 0 ? 'bg-yellow-50' : 'bg-gray-50',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {statCards.map((stat, index) => {
        const Icon = stat.icon;
        return (
          <Card key={index} className="p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-sm text-gray-600 mb-1">{stat.title}</p>
                <p className="text-2xl font-bold text-gray-900 mb-1">
                  {stat.value}
                </p>
                {stat.subtitle && (
                  <p className="text-xs text-gray-500">{stat.subtitle}</p>
                )}
              </div>
              <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                <Icon className={`w-5 h-5 ${stat.color}`} />
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
