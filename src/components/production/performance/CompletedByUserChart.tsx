import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/card';
import type { CompletedByUserPoint } from '../../../hooks/useProductionPerformance';

interface CompletedByUserChartProps {
  data: CompletedByUserPoint[];
  loading?: boolean;
}

export function CompletedByUserChart({ data, loading = false }: CompletedByUserChartProps) {
  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader>
        <CardTitle>Tareas terminadas por usuario</CardTitle>
        <CardDescription>Ranking de ejecución en el período seleccionado</CardDescription>
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
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="responsableNombre" tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                <Tooltip formatter={(value: number) => [value.toLocaleString('es-AR'), 'Tareas']} />
                <Bar dataKey="tareasTerminadas" fill="#0f172a" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
