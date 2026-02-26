import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/card';
import type { CompletedByStationPoint } from '../../../hooks/useProductionPerformance';

interface CompletedByStationChartProps {
  data: CompletedByStationPoint[];
  loading?: boolean;
}

export function CompletedByStationChart({ data, loading = false }: CompletedByStationChartProps) {
  return (
    <Card className="w-full min-w-0 overflow-hidden border-slate-200 shadow-sm">
      <CardHeader>
        <CardTitle>Rendimiento por estación</CardTitle>
        <CardDescription>Tareas completadas agrupadas por estación</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[280px] w-full">
          {loading ? (
            <div className="h-full w-full animate-pulse rounded bg-slate-100" />
          ) : data.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-slate-500">
              Sin datos en el período.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} layout="vertical" margin={{ left: 8, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} />
                <YAxis
                  type="category"
                  dataKey="estacionNombre"
                  width={130}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip formatter={(value: number) => [value.toLocaleString('es-AR'), 'Tareas']} />
                <Bar dataKey="tareasTerminadas" fill="#334155" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
