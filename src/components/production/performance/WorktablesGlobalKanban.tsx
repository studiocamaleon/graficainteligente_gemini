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
    <Card className="border-slate-200 shadow-sm">
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
          <div className="overflow-x-auto pb-2">
            <div className="grid min-w-[900px] grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-4">
              {users.map((user) => {
                const group = groupByUser.get(user.id);
                const tasks = group?.tasks || [];

                return (
                  <div key={user.id} className="rounded-lg border border-slate-200 bg-slate-50/70 p-3">
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-sm font-semibold text-slate-800">{user.label}</p>
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
                            <div key={task.rutaId} className="rounded-md border border-slate-200 bg-white p-3 shadow-sm">
                              <div className="mb-1 flex items-start justify-between gap-2">
                                <p className="text-xs font-semibold text-slate-700">{task.numeroOrden}</p>
                                <Badge size="sm" variant={urgency.variant}>{urgency.label}</Badge>
                              </div>
                              <p className="text-xs text-slate-700">{task.clienteNombre}</p>
                              <p className="mt-1 text-xs text-slate-600">{task.pasoNombre} · {task.estacionNombre}</p>
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
