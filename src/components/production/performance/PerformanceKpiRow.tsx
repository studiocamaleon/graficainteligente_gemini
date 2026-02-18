import { CheckCircle2, Clock3, GaugeCircle, ListChecks } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import type { PerformanceKpis } from '../../../hooks/useProductionPerformance';

interface PerformanceKpiRowProps {
  kpis: PerformanceKpis;
  loading?: boolean;
}

const formatNumber = (value: number) => value.toLocaleString('es-AR');
const formatHours = (value: number) => `${value.toLocaleString('es-AR', { maximumFractionDigits: 2 })} h`;
const formatDays = (value: number) => `${value.toLocaleString('es-AR', { maximumFractionDigits: 2 })} d`;
const formatPct = (value: number) => `${value.toLocaleString('es-AR', { maximumFractionDigits: 1 })}%`;

export function PerformanceKpiRow({ kpis, loading = false }: PerformanceKpiRowProps) {
  const cards = [
    {
      title: 'Tareas terminadas',
      value: formatNumber(kpis.tareasTerminadas),
      icon: ListChecks,
      hint: 'Pasos completados u omitidos',
    },
    {
      title: 'Órdenes completas 100%',
      value: formatNumber(kpis.ordenesCompletas),
      icon: CheckCircle2,
      hint: 'Todas sus rutas finalizadas',
    },
    {
      title: 'Ciclo promedio',
      value: formatHours(kpis.cicloPromedioHoras),
      icon: Clock3,
      hint: `Equivale a ${formatDays(kpis.cicloPromedioDias)}`,
    },
    {
      title: 'Cumplidas en fecha',
      value: formatPct(kpis.cumplimientoPct),
      icon: GaugeCircle,
      hint: 'Sobre órdenes con entrega estimada',
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <Card key={card.title} className="border-slate-200 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">{card.title}</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="h-8 w-24 animate-pulse rounded bg-slate-100" />
              ) : (
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-2xl font-semibold text-slate-900">{card.value}</p>
                    <p className="mt-1 text-xs text-slate-500">{card.hint}</p>
                  </div>
                  <Icon className="h-5 w-5 text-slate-400" />
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
