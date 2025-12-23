import { TrendingUp, TrendingDown, ShoppingCart, DollarSign, CreditCard, Target, Percent } from 'lucide-react';
import { Card } from '../ui/card';
import type { ReporteGeneralKPIs } from '../../types/reportes';

interface VentasKPICardsProps {
  data?: ReporteGeneralKPIs | null;
  loading?: boolean;
}

export function VentasKPICards({ data, loading }: VentasKPICardsProps) {
  const kpis = [
    {
      title: 'Total de Ventas',
      value: data ? `$${data.total_ventas.toFixed(2)}` : '-',
      change: data?.variacion_ventas || 0,
      icon: DollarSign,
      color: 'bg-blue-500',
      description: undefined,
    },
    {
      title: 'Cantidad de Órdenes',
      value: data?.total_ordenes || 0,
      change: data?.variacion_ordenes || 0,
      icon: ShoppingCart,
      color: 'bg-green-500',
      description: undefined,
    },
    {
      title: 'Ticket Promedio',
      value: data ? `$${data.ticket_promedio.toFixed(2)}` : '-',
      change: 0,
      icon: Target,
      color: 'bg-orange-500',
      description: undefined,
    },
    {
      title: 'Total Cobrado',
      value: data ? `$${data.total_cobrado.toFixed(2)}` : '-',
      change: 0,
      icon: CreditCard,
      color: 'bg-teal-500',
      description: undefined,
    },
    {
      title: 'Saldo Pendiente',
      value: data ? `$${data.saldo_pendiente.toFixed(2)}` : '-',
      change: 0,
      icon: DollarSign,
      color: 'bg-amber-500',
      description: undefined,
    },
    {
      title: 'Tasa de Cobro',
      value: data ? `${data.tasa_cobro.toFixed(1)}%` : '-',
      change: 0,
      icon: Percent,
      color: 'bg-cyan-500',
      description: 'No incluye órdenes de cuenta corriente',
    },
  ];

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Card key={i}>
            <div className="p-6 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
              <div className="h-8 bg-gray-200 rounded w-3/4"></div>
            </div>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {kpis.map((kpi, index) => {
        const Icon = kpi.icon;
        const isPositive = kpi.change > 0;
        const isNegative = kpi.change < 0;

        return (
          <Card key={index}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className={`p-3 rounded-lg ${kpi.color}`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                {kpi.change !== 0 && (
                  <div className={`flex items-center gap-1 text-sm font-medium ${
                    isPositive ? 'text-green-600' : isNegative ? 'text-red-600' : 'text-gray-600'
                  }`}>
                    {isPositive ? (
                      <TrendingUp className="w-4 h-4" />
                    ) : isNegative ? (
                      <TrendingDown className="w-4 h-4" />
                    ) : null}
                    <span>{Math.abs(kpi.change).toFixed(1)}%</span>
                  </div>
                )}
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">{kpi.title}</p>
                <p className="text-2xl font-bold text-gray-900">{kpi.value}</p>
                {kpi.description && (
                  <p className="text-xs text-gray-500 mt-1">{kpi.description}</p>
                )}
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
