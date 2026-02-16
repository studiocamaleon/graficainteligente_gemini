import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import type { DashboardSeriesV2 } from '../../types/dashboard';

interface DashboardChartsPanelProps {
  series: DashboardSeriesV2;
  loading?: boolean;
}

export function DashboardChartsPanel({ series, loading }: DashboardChartsPanelProps) {
  const createdVsDone = series.creadas.map((p, idx) => ({
    label: p.label,
    creadas: p.value ?? 0,
    finalizadas: series.finalizadas[idx]?.value ?? 0,
  }));

  return (
    <div className="grid gap-4 xl:grid-cols-3">
      <Card className="xl:col-span-2 border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle>Evolución Operativa</CardTitle>
          <CardDescription>Creadas vs finalizadas en el período</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[280px] w-full">
            {loading ? (
              <div className="h-full w-full animate-pulse rounded bg-slate-100" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={createdVsDone}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="creadas" stroke="#334155" strokeWidth={2} />
                  <Line type="monotone" dataKey="finalizadas" stroke="#0f766e" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle>Órdenes Abiertas por Antigüedad</CardTitle>
          <CardDescription>Cantidad de órdenes abiertas según días desde creación</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[280px] w-full">
            {loading ? (
              <div className="h-full w-full animate-pulse rounded bg-slate-100" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={series.backlogAging}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="bucket" tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#475569" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="xl:col-span-3 border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle>Cumplimiento Diario</CardTitle>
          <CardDescription>% de órdenes finalizadas en fecha (días sin datos quedan vacíos)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[240px] w-full">
            {loading ? (
              <div className="h-full w-full animate-pulse rounded bg-slate-100" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={series.cumplimiento}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} />
                  <YAxis domain={[0, 100]} tickLine={false} axisLine={false} />
                  <Tooltip
                    formatter={(value: any) => (value === null || value === undefined ? 'Sin datos' : `${Number(value).toFixed(0)}%`)}
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="#1d4ed8"
                    strokeWidth={2.5}
                    dot={false}
                    connectNulls={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
