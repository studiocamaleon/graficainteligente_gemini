import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/card';
import type { CompletedTaskLogEntry } from '../../../hooks/useProductionPerformance';

interface CompletedTasksLogTableProps {
  data: CompletedTaskLogEntry[];
  loading?: boolean;
}

const formatDateTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('es-AR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatDuration = (minutes: number) => {
  if (!Number.isFinite(minutes) || minutes <= 0) return '0 min';
  if (minutes >= 60) {
    const hours = minutes / 60;
    return `${hours.toLocaleString('es-AR', { maximumFractionDigits: 2 })} h`;
  }
  return `${minutes.toLocaleString('es-AR', { maximumFractionDigits: 0 })} min`;
};

const formatEstado = (estado: string) => {
  if (estado === 'completado') return 'Completado';
  if (estado === 'omitido') return 'Omitido';
  return estado;
};

export function CompletedTasksLogTable({ data, loading = false }: CompletedTasksLogTableProps) {
  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader>
        <CardTitle>Log de tareas finalizadas</CardTitle>
        <CardDescription>Detalle por usuario, paso y orden (últimos 500 registros del período)</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-48 w-full animate-pulse rounded bg-slate-100" />
        ) : data.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
            Sin tareas finalizadas para los filtros actuales.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div className="max-h-[460px] min-w-[960px] overflow-y-auto rounded-lg border border-slate-200">
              <table className="w-full border-collapse text-sm">
                <thead className="sticky top-0 bg-slate-100 text-slate-700">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold">Finalizada</th>
                    <th className="px-3 py-2 text-left font-semibold">Usuario</th>
                    <th className="px-3 py-2 text-left font-semibold">OT</th>
                    <th className="px-3 py-2 text-left font-semibold">Item</th>
                    <th className="px-3 py-2 text-left font-semibold">Paso</th>
                    <th className="px-3 py-2 text-left font-semibold">Estación</th>
                    <th className="px-3 py-2 text-left font-semibold">Estado</th>
                    <th className="px-3 py-2 text-right font-semibold">Duración</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((row) => (
                    <tr key={row.rutaId} className="border-t border-slate-200 text-slate-700">
                      <td className="px-3 py-2 whitespace-nowrap">{formatDateTime(row.fechaFin)}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{row.responsableNombre}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{row.numeroOrden}</td>
                      <td className="px-3 py-2">{row.itemNombre}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{row.pasoNombre}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{row.estacionNombre}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{formatEstado(row.estadoPaso)}</td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">{formatDuration(row.duracionMinutos)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
