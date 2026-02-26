import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/card';
import { Select } from '../../ui/Select';
import type { PerformanceOption, TasksTimelinePoint } from '../../../hooks/useProductionPerformance';

interface TasksEvolutionChartProps {
  data: TasksTimelinePoint[];
  users: PerformanceOption[];
  selectedUserId: string | null;
  loading?: boolean;
  onUserChange: (userId: string | null) => void;
}

export function TasksEvolutionChart({
  data,
  users,
  selectedUserId,
  loading = false,
  onUserChange,
}: TasksEvolutionChartProps) {
  return (
    <Card className="w-full min-w-0 overflow-hidden border-slate-200 shadow-sm">
      <CardHeader className="gap-3 md:flex md:flex-row md:items-end md:justify-between">
        <div>
          <CardTitle>Evolución de tareas finalizadas</CardTitle>
          <CardDescription>Serie diaria por usuario seleccionado</CardDescription>
        </div>
        <div className="w-full md:w-64">
          <Select
            label="Usuario del gráfico"
            value={selectedUserId || ''}
            onChange={(value) => onUserChange(value || null)}
          >
            <option value="">Todos los usuarios</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.label}
              </option>
            ))}
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] w-full">
          {loading ? (
            <div className="h-full w-full animate-pulse rounded bg-slate-100" />
          ) : data.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-slate-500">
              Sin tareas finalizadas en el período.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                <defs>
                  <linearGradient id="tasksArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="#06b6d4" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                <Tooltip
                  formatter={(value: number) => [Number(value).toLocaleString('es-AR'), 'Tareas']}
                  labelFormatter={(label) => `Día: ${label}`}
                />
                <Area
                  type="monotone"
                  dataKey="tareasTerminadas"
                  stroke="#0891b2"
                  strokeWidth={2.6}
                  fill="url(#tasksArea)"
                  dot={{ r: 2.8, strokeWidth: 0, fill: '#0e7490' }}
                  activeDot={{ r: 4 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
