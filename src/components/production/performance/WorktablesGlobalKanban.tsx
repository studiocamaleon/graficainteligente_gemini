import { Badge } from '../../ui/Badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/card';
import type { PerformanceOption, WorktableGroup, WorktableTask } from '../../../hooks/useProductionPerformance';

interface WorktablesGlobalKanbanProps {
  users: PerformanceOption[];
  groups: WorktableGroup[];
  loading?: boolean;
}

const urgencyConfig: Record<WorktableTask['urgencia'], { label: string; variant: 'danger' | 'warning' | 'info' | 'default' }> = {
  vencida: { label: 'Vencida', variant: 'danger' },
  hoy: { label: 'Entrega hoy', variant: 'warning' },
  manana: { label: 'Entrega mañana', variant: 'info' },
  futura: { label: 'Próxima', variant: 'default' },
  sin_fecha: { label: 'Sin fecha', variant: 'default' },
};

const formatDate = (value: string | null) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

export function WorktablesGlobalKanban({ users, groups, loading = false }: WorktablesGlobalKanbanProps) {
  const groupByUser = new Map(groups.map((group) => [group.userId, group]));

  return (
    <Card className="w-full min-w-0 overflow-hidden border-slate-200 shadow-sm">
      <CardHeader>
        <CardTitle>Mesa de trabajo global</CardTitle>
        <CardDescription>Qué tareas tiene cada usuario actualmente en su mesa</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-40 w-full animate-pulse rounded bg-slate-100" />
        ) : users.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
            No hay usuarios activos para mostrar.
          </div>
        ) : (
          <div className="pb-2">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {users.map((user) => {
                const group = groupByUser.get(user.id);
                const tasks = group?.tasks || [];

                return (
                  <div key={user.id} className="min-w-0 rounded-lg border border-slate-200 bg-slate-50/70 p-3">
                    <div className="mb-3 flex items-center justify-between">
                      <p className="truncate pr-2 text-sm font-semibold text-slate-800" title={user.label}>{user.label}</p>
                      <Badge size="sm" variant={tasks.length > 0 ? 'primary' : 'default'}>
                        {tasks.length}
                      </Badge>
                    </div>

                    <div className="space-y-2">
                      {tasks.length === 0 ? (
                        <div className="rounded-md border border-dashed border-slate-300 bg-white p-3 text-xs text-slate-500">
                          Sin tareas en mesa.
                        </div>
                      ) : (
                        tasks.map((task) => {
                          const urgency = urgencyConfig[task.urgencia] || urgencyConfig.sin_fecha;
                          return (
                            <div key={task.rutaId} className="min-w-0 rounded-md border border-slate-200 bg-white p-3 shadow-sm">
                              <div className="mb-1 flex items-start justify-between gap-2">
                                <p className="truncate text-xs font-semibold text-slate-700" title={task.numeroOrden}>{task.numeroOrden}</p>
                                <Badge size="sm" variant={urgency.variant}>{urgency.label}</Badge>
                              </div>
                              <p className="truncate text-xs text-slate-700" title={task.clienteNombre}>{task.clienteNombre}</p>
                              <p className="mt-1 truncate text-xs text-slate-600" title={`${task.pasoNombre} · ${task.estacionNombre}`}>{task.pasoNombre} · {task.estacionNombre}</p>
                              <p className="mt-2 text-[11px] text-slate-500">Entrega: {formatDate(task.fechaEstimadaEntrega)}</p>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
