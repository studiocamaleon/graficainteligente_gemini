import { Pause, Play, Clock, TrendingUp, AlertTriangle, Package } from 'lucide-react';
import type { PausasKPIs } from '../../hooks/usePausasAnalytics';

interface PausasKPICardsProps {
  kpis: PausasKPIs | null;
  loading: boolean;
}

export function PausasKPICards({ kpis, loading }: PausasKPICardsProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white rounded-lg border border-gray-200 p-6 animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
            <div className="h-8 bg-gray-200 rounded w-3/4"></div>
          </div>
        ))}
      </div>
    );
  }

  if (!kpis) {
    return null;
  }

  const cards = [
    {
      title: 'Total de Pausas',
      value: kpis.total_pausas,
      icon: Pause,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      subtitle: `${kpis.pausas_activas} activas, ${kpis.pausas_cerradas} cerradas`,
    },
    {
      title: 'Tiempo Total Pausado',
      value: `${kpis.tiempo_total_pausado_horas}h`,
      icon: Clock,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
      subtitle: `Promedio: ${kpis.tiempo_promedio_pausa_horas}h por pausa`,
    },
    {
      title: 'Pausa Más Larga',
      value: `${kpis.pausa_mas_larga_horas}h`,
      icon: AlertTriangle,
      color: 'text-red-600',
      bgColor: 'bg-red-50',
      subtitle: 'En el período seleccionado',
    },
    {
      title: 'Órdenes Afectadas',
      value: kpis.ordenes_afectadas,
      icon: Package,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      subtitle: `${kpis.pasos_pausados_unicos} pasos únicos`,
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card, index) => (
        <div
          key={index}
          className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow"
        >
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-medium text-gray-600">{card.title}</p>
            <div className={`${card.bgColor} p-2 rounded-lg`}>
              <card.icon className={`w-5 h-5 ${card.color}`} />
            </div>
          </div>
          <div className="mb-2">
            <p className={`text-3xl font-bold ${card.color}`}>{card.value}</p>
          </div>
          <p className="text-xs text-gray-500">{card.subtitle}</p>
        </div>
      ))}
    </div>
  );
}
