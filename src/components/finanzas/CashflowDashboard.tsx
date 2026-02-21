import { useMemo, useState } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ComposedChart,
  Bar,
  Legend,
} from 'recharts';
import dayjs from 'dayjs';
import {
  AlertTriangle,
  ArrowUpCircle,
  CalendarDays,
  LineChart,
  RefreshCw,
  ShieldAlert,
  Wallet,
} from 'lucide-react';
import { Card } from '../ui/card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { useCashflow } from '../../hooks/useCashflow';

function formatMoney(value: number) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(value);
}

const COLORS = {
  saldoArea: '#0f172a',
  ingresoCheques: '#0ea5e9',
  ingresoLiquidaciones: '#14b8a6',
  ingresoWip: '#6366f1',
  egresoCheques: '#ef4444',
  egresoTarjetas: '#f97316',
  egresoRecurrentes: '#f59e0b',
  egresoCompras: '#ec4899',
  vencidoIngreso: '#047857',
  vencidoEgreso: '#7f1d1d',
};

export function CashflowDashboard() {
  const [days, setDays] = useState(30);
  const { data, loading, error, refresh } = useCashflow(days);

  const stats = useMemo(() => {
    if (!data.length) return null;
    const currentBalance = data[0]?.saldo_acumulado || 0;
    const projectedBalance = data[data.length - 1]?.saldo_acumulado || 0;
    const minBalance = Math.min(...data.map((d) => d.saldo_acumulado));
    const criticalDays = data.filter((d) => d.saldo_acumulado < 0).length;
    const overdueOut = data.reduce((acc, d) => acc + d.total_egreso_vencido, 0);
    const overdueIn = data.reduce((acc, d) => acc + d.total_ingreso_vencido, 0);

    const incomes = data.reduce(
      (acc, d) => ({
        cheques: acc.cheques + d.ingreso_cheques,
        liquidaciones: acc.liquidaciones + d.ingreso_liquidaciones,
        wip: acc.wip + d.ingreso_wip,
      }),
      { cheques: 0, liquidaciones: 0, wip: 0 }
    );

    const expenses = data.reduce(
      (acc, d) => ({
        cheques: acc.cheques + d.egreso_cheques,
        compras: acc.compras + d.egreso_compras,
        tarjetas: acc.tarjetas + d.egreso_tarjetas,
        recurrentes: acc.recurrentes + d.egreso_recurrentes,
      }),
      { cheques: 0, compras: 0, tarjetas: 0, recurrentes: 0 }
    );

    return {
      currentBalance,
      projectedBalance,
      minBalance,
      criticalDays,
      overdueOut,
      overdueIn,
      incomes,
      expenses,
    };
  }, [data]);

  const topOutflows = useMemo(() => {
    return [...data]
      .filter((d) => d.total_egresos > 0)
      .sort((a, b) => b.total_egresos - a.total_egresos)
      .slice(0, 5);
  }, [data]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-36 animate-pulse rounded-xl border border-slate-200 bg-slate-100" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50 p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold text-red-900">No se pudo cargar la proyección</h3>
            <p className="mt-1 text-sm text-red-700">{error}</p>
          </div>
          <Button variant="outline" onClick={refresh} className="border-red-300 text-red-700">
            Reintentar
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-slate-200 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-5 text-white">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Proyección de Cashflow</h2>
            <p className="text-sm text-slate-300">
              Simulación financiera basada en cobros, egresos, vencimientos y WIP de producción.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {[30, 60, 90].map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setDays(value)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  days === value
                    ? 'bg-white text-slate-900 shadow'
                    : 'bg-slate-700/60 text-slate-100 hover:bg-slate-600/70'
                }`}
              >
                {value} días
              </button>
            ))}
            <Button
              variant="secondary"
              onClick={refresh}
              className="border-slate-500 bg-transparent text-slate-100 hover:bg-slate-700"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Actualizar
            </Button>
          </div>
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
          <Card className="rounded-xl border border-slate-200 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Saldo actual</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{formatMoney(stats.currentBalance)}</p>
            <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
              <Wallet className="h-4 w-4" />
              Caja consolidada
            </div>
          </Card>

          <Card className="rounded-xl border border-slate-200 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Saldo proyectado</p>
            <p className={`mt-2 text-2xl font-semibold ${stats.projectedBalance >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
              {formatMoney(stats.projectedBalance)}
            </p>
            <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
              <LineChart className="h-4 w-4" />
              Horizonte {days} días
            </div>
          </Card>

          <Card className="rounded-xl border border-slate-200 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pico mínimo</p>
            <p className={`mt-2 text-2xl font-semibold ${stats.minBalance >= 0 ? 'text-slate-900' : 'text-rose-700'}`}>
              {formatMoney(stats.minBalance)}
            </p>
            <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
              <ShieldAlert className="h-4 w-4" />
              Riesgo de liquidez
            </div>
          </Card>

          <Card className="rounded-xl border border-slate-200 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Cobros vencidos</p>
            <p className="mt-2 text-2xl font-semibold text-emerald-700">{formatMoney(stats.overdueIn)}</p>
            <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
              <ArrowUpCircle className="h-4 w-4" />
              Recuperación pendiente
            </div>
          </Card>

          <Card className="rounded-xl border border-slate-200 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Deudas vencidas</p>
            <p className="mt-2 text-2xl font-semibold text-rose-700">{formatMoney(stats.overdueOut)}</p>
            <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
              <AlertTriangle className="h-4 w-4" />
              Días críticos: {stats.criticalDays}
            </div>
          </Card>
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <Card className="rounded-xl border border-slate-200 p-5 xl:col-span-2">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">Tendencia de saldo acumulado</h3>
          <div className="h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 8, right: 20, left: 8, bottom: 8 }}>
                <defs>
                  <linearGradient id="saldoGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#1e293b" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#1e293b" stopOpacity={0.03} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="fecha" tickFormatter={(v) => dayjs(v).format('DD/MM')} tick={{ fill: '#64748b', fontSize: 12 }} />
                <YAxis tickFormatter={(v) => `${Math.round(v / 1000)}k`} tick={{ fill: '#64748b', fontSize: 12 }} />
                <Tooltip
                  labelFormatter={(label) => dayjs(label).format('DD/MM/YYYY')}
                  formatter={(value: number) => formatMoney(value)}
                  contentStyle={{ borderRadius: 10, borderColor: '#cbd5e1' }}
                />
                <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="4 4" />
                <Area
                  type="monotone"
                  dataKey="saldo_acumulado"
                  name="Saldo acumulado"
                  stroke={COLORS.saldoArea}
                  fill="url(#saldoGradient)"
                  strokeWidth={2.3}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="rounded-xl border border-slate-200 p-5">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">Mayores salidas</h3>
          <div className="space-y-3">
            {topOutflows.length === 0 ? (
              <p className="text-sm text-slate-400">Sin egresos relevantes en el período.</p>
            ) : (
              topOutflows.map((item) => (
                <div key={item.fecha} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-center justify-between text-sm">
                    <div className="font-medium text-slate-800">{dayjs(item.fecha).format('DD/MM')}</div>
                    <div className="font-semibold text-rose-700">-{formatMoney(item.total_egresos)}</div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {item.egreso_cheques > 0 && <Badge variant="danger">Cheques</Badge>}
                    {item.egreso_tarjetas > 0 && <Badge variant="warning">Tarjetas</Badge>}
                    {item.egreso_recurrentes > 0 && <Badge variant="info">Fijos</Badge>}
                    {item.egreso_compras > 0 && <Badge variant="secondary">Proveedores</Badge>}
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      <Card className="rounded-xl border border-slate-200 p-5">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">Composición diaria de flujos</h3>
        <div className="h-[340px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 8, right: 20, left: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="fecha" tickFormatter={(v) => dayjs(v).format('DD/MM')} tick={{ fill: '#64748b', fontSize: 12 }} />
              <YAxis tickFormatter={(v) => `${Math.round(v / 1000)}k`} tick={{ fill: '#64748b', fontSize: 12 }} />
              <Tooltip
                labelFormatter={(label) => dayjs(label).format('DD/MM/YYYY')}
                formatter={(value: number, name: string) => [formatMoney(value), name]}
                contentStyle={{ borderRadius: 10, borderColor: '#cbd5e1' }}
              />
              <Legend />
              <Bar dataKey="total_ingreso_vencido" name="Cobros vencidos" stackId="flowIn" fill={COLORS.vencidoIngreso} />
              <Bar dataKey="ingreso_cheques" name="Ingreso cheques" stackId="flowIn" fill={COLORS.ingresoCheques} />
              <Bar dataKey="ingreso_liquidaciones" name="Ingreso cuentas cte." stackId="flowIn" fill={COLORS.ingresoLiquidaciones} />
              <Bar dataKey="ingreso_wip" name="Ingreso WIP" stackId="flowIn" fill={COLORS.ingresoWip} />
              <Bar dataKey={(d) => -d.total_egreso_vencido} name="Deudas vencidas" stackId="flowOut" fill={COLORS.vencidoEgreso} />
              <Bar dataKey={(d) => -d.egreso_cheques} name="Egreso cheques" stackId="flowOut" fill={COLORS.egresoCheques} />
              <Bar dataKey={(d) => -d.egreso_compras} name="Egreso proveedores" stackId="flowOut" fill={COLORS.egresoCompras} />
              <Bar dataKey={(d) => -d.egreso_tarjetas} name="Egreso tarjetas" stackId="flowOut" fill={COLORS.egresoTarjetas} />
              <Bar dataKey={(d) => -d.egreso_recurrentes} name="Egreso fijos" stackId="flowOut" fill={COLORS.egresoRecurrentes} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card className="rounded-xl border border-slate-200 p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Detalle diario</h3>
          <span className="text-xs text-slate-400">{data.length} filas</span>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200">
          <div className="grid grid-cols-12 bg-slate-900 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-200">
            <div className="col-span-2">Fecha</div>
            <div className="col-span-3">Ingresos</div>
            <div className="col-span-3">Egresos</div>
            <div className="col-span-2 text-right">Balance día</div>
            <div className="col-span-2 text-right">Saldo acumulado</div>
          </div>

          <div className="max-h-[480px] overflow-y-auto bg-white">
            {data.map((item, index) => (
              <div
                key={item.fecha}
                className={`grid grid-cols-12 gap-3 border-t border-slate-100 px-4 py-3 text-sm ${
                  index % 2 === 0 ? 'bg-white' : 'bg-slate-50/70'
                }`}
              >
                <div className="col-span-2">
                  <div className="font-medium text-slate-800">{dayjs(item.fecha).format('DD/MM/YYYY')}</div>
                  <div className="mt-1 text-xs text-slate-400">
                    {dayjs(item.fecha).isSame(dayjs(), 'day') ? 'Hoy' : dayjs(item.fecha).format('dddd')}
                  </div>
                </div>

                <div className="col-span-3 space-y-1 text-xs">
                  {item.total_ingreso_vencido > 0 && (
                    <div className="flex justify-between text-emerald-800">
                      <span>Vencidos</span>
                      <span className="font-semibold">{formatMoney(item.total_ingreso_vencido)}</span>
                    </div>
                  )}
                  {item.ingreso_cheques > 0 && (
                    <div className="flex justify-between text-sky-700">
                      <span>Cheques</span>
                      <span>{formatMoney(item.ingreso_cheques)}</span>
                    </div>
                  )}
                  {item.ingreso_liquidaciones > 0 && (
                    <div className="flex justify-between text-teal-700">
                      <span>Ctas. cte.</span>
                      <span>{formatMoney(item.ingreso_liquidaciones)}</span>
                    </div>
                  )}
                  {item.ingreso_wip > 0 && (
                    <div className="flex justify-between text-indigo-700">
                      <span>WIP producción</span>
                      <span>{formatMoney(item.ingreso_wip)}</span>
                    </div>
                  )}
                  {item.total_ingresos === 0 && <span className="text-slate-300">-</span>}
                </div>

                <div className="col-span-3 space-y-1 text-xs">
                  {item.total_egreso_vencido > 0 && (
                    <div className="flex justify-between text-rose-800">
                      <span>Vencidos</span>
                      <span className="font-semibold">{formatMoney(item.total_egreso_vencido)}</span>
                    </div>
                  )}
                  {item.egreso_cheques > 0 && (
                    <div className="flex justify-between text-red-700">
                      <span>Cheques</span>
                      <span>{formatMoney(item.egreso_cheques)}</span>
                    </div>
                  )}
                  {item.egreso_compras > 0 && (
                    <div className="flex justify-between text-pink-700">
                      <span>Proveedores</span>
                      <span>{formatMoney(item.egreso_compras)}</span>
                    </div>
                  )}
                  {item.egreso_tarjetas > 0 && (
                    <div className="flex justify-between text-orange-700">
                      <span>Tarjetas</span>
                      <span>{formatMoney(item.egreso_tarjetas)}</span>
                    </div>
                  )}
                  {item.egreso_recurrentes > 0 && (
                    <div className="flex justify-between text-amber-700">
                      <span>Gastos fijos</span>
                      <span>{formatMoney(item.egreso_recurrentes)}</span>
                    </div>
                  )}
                  {item.total_egresos === 0 && <span className="text-slate-300">-</span>}
                </div>

                <div className="col-span-2 flex flex-col items-end justify-center">
                  <span className={`font-semibold ${item.saldo_diario >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {item.saldo_diario >= 0 ? '+' : ''}
                    {formatMoney(item.saldo_diario)}
                  </span>
                  <span className="mt-1 text-[11px] text-slate-400">{item.saldo_diario >= 0 ? 'Flujo positivo' : 'Flujo negativo'}</span>
                </div>

                <div className="col-span-2 flex items-center justify-end">
                  <span className={`text-sm font-semibold ${item.saldo_acumulado >= 0 ? 'text-slate-900' : 'text-rose-700'}`}>
                    {formatMoney(item.saldo_acumulado)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-3 flex items-center gap-3 text-xs text-slate-500">
          <CalendarDays className="h-4 w-4" />
          <span>La proyección toma fechas comprometidas, vencimientos y saldos pendientes operativos.</span>
        </div>
      </Card>
    </div>
  );
}
