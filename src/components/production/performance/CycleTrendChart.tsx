import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/card';
import type { CycleTrendPoint } from '../../../hooks/useProductionPerformance';

interface CycleTrendChartProps {
  data: CycleTrendPoint[];
  loading?: boolean;
}

export function CycleTrendChart({ data, loading = false }: CycleTrendChartProps) {
  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader>
        <CardTitle>Ciclo promedio diario</CardTitle>
        <CardDescription>Horas desde creación hasta orden 100% completa</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[280px] w-full">
          {loading ? (
            <div className="h-full w-full animate-pulse rounded bg-slate-100" />
          ) : data.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-slate-500">
              Sin órdenes completas en el período.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} />
                <Tooltip
                  formatter={(value: number) => [`${Number(value).toLocaleString('es-AR', { maximumFractionDigits: 2 })} h`, 'Ciclo']}
                  labelFormatter={(label) => `Día: ${label}`}
                />
                <Line type="monotone" dataKey="cicloPromedioHoras" stroke="#0f766e" strokeWidth={2.5} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
