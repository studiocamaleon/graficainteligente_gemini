import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/card';
import { Tooltip } from '../../ui/Tooltip';
import type { CompletedTaskLogEntry } from '../../../hooks/useProductionPerformance';
import { Clock3 } from 'lucide-react';

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

const formatElapsedDaysHours = (minutes: number | null) => {
  if (minutes === null || !Number.isFinite(minutes) || minutes < 0) return '-';
  const totalHours = Math.floor(minutes / 60);
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  return `${days} d ${hours} h`;
};

const formatEstado = (estado: string) => {
  if (estado === 'completado') return 'Completado';
  if (estado === 'omitido') return 'Omitido';
  return estado;
};

export function CompletedTasksLogTable({ data, loading = false }: CompletedTasksLogTableProps) {
  return (
    <Card className="w-full min-w-0 overflow-hidden border-slate-200 shadow-sm">
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
          <div className="max-h-[460px] overflow-y-auto rounded-lg border border-slate-200">
            <table className="w-full table-fixed border-collapse text-sm">
                <thead className="sticky top-0 bg-slate-100 text-slate-700">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold">Finalizada</th>
                    <th className="px-3 py-2 text-left font-semibold">Usuario</th>
                    <th className="px-3 py-2 text-left font-semibold">OT</th>
                    <th className="hidden px-3 py-2 text-left font-semibold md:table-cell">Item</th>
                    <th className="px-3 py-2 text-left font-semibold">Paso</th>
                    <th className="hidden px-3 py-2 text-left font-semibold lg:table-cell">Estación</th>
                    <th className="hidden px-3 py-2 text-left font-semibold xl:table-cell">Estado</th>
                    <th className="w-16 px-3 py-2 text-right font-semibold">
                      <div className="flex justify-end">
                        <Tooltip content="Tiempo entre hitos">
                          <span className="inline-flex cursor-help text-slate-600">
                            <Clock3 className="h-4 w-4" />
                          </span>
                        </Tooltip>
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((row) => (
                    <tr key={row.rutaId} className="border-t border-slate-200 text-slate-700">
                      <td className="px-3 py-2 text-xs sm:text-sm">{formatDateTime(row.fechaFin)}</td>
                      <td className="px-3 py-2 break-words">{row.responsableNombre}</td>
                      <td className="px-3 py-2 break-words">{row.numeroOrden}</td>
                      <td className="hidden px-3 py-2 break-words md:table-cell">{row.itemNombre}</td>
                      <td className="px-3 py-2 break-words">{row.pasoNombre}</td>
                      <td className="hidden px-3 py-2 break-words lg:table-cell">{row.estacionNombre}</td>
                      <td className="hidden px-3 py-2 break-words xl:table-cell">{formatEstado(row.estadoPaso)}</td>
                      <td className="px-3 py-2 text-right">{formatElapsedDaysHours(row.tiempoEntreHitosMinutos)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
