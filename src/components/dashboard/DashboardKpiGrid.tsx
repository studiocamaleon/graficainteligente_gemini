import { AlertTriangle, CheckCircle2, CircleDashed, Clock3, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import type { DashboardKpisV2, DashboardScope } from '../../types/dashboard';

interface DashboardKpiGridProps {
  scope: DashboardScope;
  kpis: DashboardKpisV2;
  loading?: boolean;
  onOpenRoute?: (path: string) => void;
}

const kpiMeta = [
  { key: 'pendientes', label: 'Pendientes', icon: CircleDashed, formula: "estado='pendiente'" },
  { key: 'enProceso', label: 'En proceso', icon: Clock3, formula: "estado='en_proceso'" },
  {
    key: 'vencidas',
    label: 'Vencidas',
    icon: AlertTriangle,
    formula: 'pendiente/en_proceso con fecha estimada < hoy',
  },
  {
    key: 'finalizadasPeriodo',
    label: 'Finalizadas',
    icon: CheckCircle2,
    formula: "estado finalizada|entregada con fecha_completado en período",
  },
  {
    key: 'cumplimiento',
    label: 'Cumplimiento',
    icon: TrendingUp,
    suffix: '%',
    formula: 'finalizadas a tiempo / finalizadas evaluadas * 100',
  },
] as const;

function deltaClass(delta: number) {
  if (delta > 0) return 'text-emerald-700 bg-emerald-50 border-emerald-100';
  if (delta < 0) return 'text-rose-700 bg-rose-50 border-rose-100';
  return 'text-slate-600 bg-slate-50 border-slate-100';
}

function getRoute(scope: DashboardScope, key: (typeof kpiMeta)[number]['key']) {
  if (scope === 'ot') {
    if (key === 'pendientes') return '/app/orders/ordenes?estado=pendiente';
    if (key === 'enProceso') return '/app/orders/ordenes?estado=en_proceso';
    if (key === 'vencidas') return '/app/orders/ordenes';
    if (key === 'finalizadasPeriodo') return '/app/orders/ordenes?estado=finalizada';
    return '/app/dashboard';
  }
  if (key === 'pendientes') return '/app/centro-copiado/ordenes?estado=pendiente';
  if (key === 'enProceso') return '/app/centro-copiado/ordenes?estado=en_proceso';
  if (key === 'vencidas') return '/app/centro-copiado/ordenes';
  if (key === 'finalizadasPeriodo') return '/app/centro-copiado/ordenes?estado=finalizada';
  return '/app/dashboard';
}

export function DashboardKpiGrid({ scope, kpis, loading, onOpenRoute }: DashboardKpiGridProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      {kpiMeta.map((meta) => {
        const Icon = meta.icon;
        const metric = kpis[meta.key];
        const valueText =
          meta.key === 'cumplimiento'
            ? `${metric.value.toFixed(1)}${meta.suffix || ''}`
            : metric.value.toLocaleString('es-AR');

        return (
          <Card
            key={meta.key}
            className="cursor-pointer border-slate-200 shadow-sm transition hover:border-slate-300"
            onClick={() => onOpenRoute?.(getRoute(scope, meta.key))}
            title={meta.formula}
          >
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between text-sm font-medium text-slate-600">
                {meta.label}
                <span className="rounded-md bg-slate-100 p-1.5 text-slate-600">
                  <Icon className="h-4 w-4" />
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="h-8 w-20 animate-pulse rounded bg-slate-200" />
              ) : (
                <>
                  <div className="text-2xl font-semibold text-slate-900">{valueText}</div>
                  <div className="mt-2 flex items-center gap-2 text-xs">
                    <span className={`rounded border px-2 py-0.5 font-medium ${deltaClass(metric.deltaAbs)}`}>
                      {metric.deltaAbs > 0 ? '+' : ''}
                      {meta.key === 'cumplimiento' ? metric.deltaAbs.toFixed(1) : metric.deltaAbs}
                    </span>
                    <span className="text-slate-500">
                      vs anterior ({metric.deltaPct > 0 ? '+' : ''}
                      {metric.deltaPct.toFixed(1)}%)
                    </span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
