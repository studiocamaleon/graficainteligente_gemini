import { FileText, Clock, CheckCircle, DollarSign, TrendingUp, Calendar } from 'lucide-react';
import { Card } from '../ui/card';
import type { EstadisticasFacturacion } from '../../hooks/useFacturas';

interface FacturasKPICardsProps {
  estadisticas: EstadisticasFacturacion | null;
  loading?: boolean;
}

export function FacturasKPICards({ estadisticas, loading }: FacturasKPICardsProps) {
  if (loading || !estadisticas) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Card key={i} className="p-6 animate-pulse">
            <div className="h-12 bg-gray-200 rounded mb-2"></div>
            <div className="h-8 bg-gray-200 rounded"></div>
          </Card>
        ))}
      </div>
    );
  }

  const kpis = [
    {
      icon: FileText,
      label: 'Total con Factura',
      value: estadisticas.total_ordenes_requieren_factura,
      color: 'blue',
      format: 'number',
    },
    {
      icon: Clock,
      label: 'Pendientes',
      value: estadisticas.ordenes_pendientes,
      color: 'yellow',
      format: 'number',
    },
    {
      icon: CheckCircle,
      label: 'Facturadas',
      value: estadisticas.ordenes_facturadas,
      color: 'green',
      format: 'number',
    },
    {
      icon: DollarSign,
      label: 'IVA Pendiente',
      value: estadisticas.monto_iva_pendiente,
      color: 'red',
      format: 'currency',
    },
    {
      icon: TrendingUp,
      label: 'IVA Facturado',
      value: estadisticas.monto_iva_facturado,
      color: 'emerald',
      format: 'currency',
    },
    {
      icon: Calendar,
      label: 'Días Promedio',
      value: estadisticas.promedio_dias_facturacion,
      color: 'purple',
      format: 'days',
    },
  ];

  const formatValue = (value: number, format: string) => {
    if (format === 'currency') {
      return new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: 'ARS',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(value);
    }
    if (format === 'days') {
      return `${Math.round(value)} días`;
    }
    return value.toString();
  };

  const getColorClasses = (color: string) => {
    const colors = {
      blue: {
        bg: 'bg-blue-50',
        icon: 'text-blue-600',
        text: 'text-blue-900',
      },
      yellow: {
        bg: 'bg-yellow-50',
        icon: 'text-yellow-600',
        text: 'text-yellow-900',
      },
      green: {
        bg: 'bg-green-50',
        icon: 'text-green-600',
        text: 'text-green-900',
      },
      red: {
        bg: 'bg-red-50',
        icon: 'text-red-600',
        text: 'text-red-900',
      },
      emerald: {
        bg: 'bg-emerald-50',
        icon: 'text-emerald-600',
        text: 'text-emerald-900',
      },
      purple: {
        bg: 'bg-purple-50',
        icon: 'text-purple-600',
        text: 'text-purple-900',
      },
    };
    return colors[color as keyof typeof colors] || colors.blue;
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
      {kpis.map((kpi) => {
        const colors = getColorClasses(kpi.color);
        const Icon = kpi.icon;

        return (
          <Card key={kpi.label} className={`p-6 ${colors.bg} border-none`}>
            <div className="flex items-center gap-3 mb-3">
              <div className={`p-2 rounded-lg bg-white/80`}>
                <Icon className={`w-5 h-5 ${colors.icon}`} />
              </div>
            </div>
            <div>
              <p className={`text-sm font-medium ${colors.text} mb-1`}>{kpi.label}</p>
              <p className={`text-2xl font-bold ${colors.text}`}>
                {formatValue(kpi.value, kpi.format)}
              </p>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
