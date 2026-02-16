import { Activity, CalendarClock, Package } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/Button';
import type { DashboardActividadV2, DashboardProximaEntregaV2 } from '../../types/dashboard';

interface DashboardOperationalPanelProps {
  entregas: DashboardProximaEntregaV2[];
  actividad: DashboardActividadV2[];
  loading?: boolean;
  onOpenOrder: (orderId: string, tipo: 'ot' | 'copiado') => void;
  onViewMore?: () => void;
  canViewMore?: boolean;
}

function formatUrgency(value: DashboardProximaEntregaV2['nivel_urgencia']) {
  if (value === 'critico') return 'bg-rose-100 text-rose-700';
  if (value === 'urgente') return 'bg-amber-100 text-amber-700';
  if (value === 'proximo') return 'bg-yellow-100 text-yellow-800';
  return 'bg-emerald-100 text-emerald-700';
}

function formatDiasEntrega(dias: number) {
  if (dias < 0) return `Atrasada ${Math.abs(dias)}d`;
  if (dias === 0) return 'Hoy';
  if (dias === 1) return 'En 1 día';
  return `En ${dias} días`;
}

export function DashboardOperationalPanel({
  entregas,
  actividad,
  loading,
  onOpenOrder,
  onViewMore,
  canViewMore = false,
}: DashboardOperationalPanelProps) {
  return (
    <div className="grid gap-4 xl:grid-cols-3">
      <Card className="xl:col-span-2 border-slate-200 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="inline-flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-slate-500" />
            Próximas Entregas
          </CardTitle>
          {onViewMore && canViewMore ? (
            <Button variant="outline" size="sm" onClick={onViewMore} disabled={loading}>
              Ver más
            </Button>
          ) : null}
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              <div className="h-10 animate-pulse rounded bg-slate-100" />
              <div className="h-10 animate-pulse rounded bg-slate-100" />
              <div className="h-10 animate-pulse rounded bg-slate-100" />
            </div>
          ) : entregas.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-500">
              No hay entregas pendientes para este scope.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {entregas.map((item) => (
                <button
                  key={`${item.tipo_orden}-${item.id}`}
                  onClick={() => onOpenOrder(item.id, item.tipo_orden)}
                  className="flex w-full items-center justify-between gap-3 px-1 py-3 text-left hover:bg-slate-50"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-slate-900">{item.numero_orden}</p>
                    <p className="truncate text-sm text-slate-500">{item.cliente_nombre}</p>
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-200">
                        <div
                          className="h-full rounded-full bg-slate-600"
                          style={{ width: `${Math.max(0, Math.min(100, item.progreso_porcentaje ?? 0))}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium text-slate-600">
                        {item.progreso_porcentaje ?? 0}%
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-slate-700">
                      {new Date(item.fecha_estimada_entrega).toLocaleDateString('es-AR')}
                    </p>
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${formatUrgency(item.nivel_urgencia)}`}>
                      {formatDiasEntrega(item.dias_restantes)}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="inline-flex items-center gap-2">
            <Activity className="h-5 w-5 text-slate-500" />
            Actividad Reciente
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              <div className="h-12 animate-pulse rounded bg-slate-100" />
              <div className="h-12 animate-pulse rounded bg-slate-100" />
              <div className="h-12 animate-pulse rounded bg-slate-100" />
            </div>
          ) : actividad.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-500">Sin actividad en el período.</div>
          ) : (
            <div className="space-y-2">
              {actividad.slice(0, 10).map((a) => (
                <button
                  key={a.id}
                  onClick={() => onOpenOrder(a.orden_id, a.tipo_orden === 'copiado' ? 'copiado' : 'ot')}
                  className="w-full rounded-lg border border-slate-100 p-3 text-left hover:bg-slate-50"
                >
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Package className="h-3.5 w-3.5" />
                    <span>#{a.orden_numero}</span>
                  </div>
                  <p className="mt-1 text-sm font-medium text-slate-900">{a.descripcion}</p>
                  {a.detalle_extra && <p className="mt-1 text-xs text-slate-500">{a.detalle_extra}</p>}
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
