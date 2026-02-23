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
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  AlertTriangle,
  ArrowUpCircle,
  CalendarDays,
  Download,
  LineChart,
  RefreshCw,
  ShieldAlert,
  Wallet,
} from 'lucide-react';
import { Card } from '../ui/card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { useCashflow, type CashflowCollectionBasis, type CashflowPoint } from '../../hooks/useCashflow';

type ScenarioId = 'conservador' | 'base' | 'optimista';

interface ScenarioConfig {
  ingresosFactor: number;
  egresosFactor: number;
  label: string;
  description: string;
}

interface CashflowViewPoint extends CashflowPoint {
  ingreso_cheques_display: number;
  ingreso_liquidaciones_display: number;
  ingreso_wip_display: number;
  total_ingreso_vencido_display: number;
  egreso_cheques_display: number;
  egreso_tarjetas_display: number;
  egreso_recurrentes_display: number;
  egreso_compras_display: number;
  total_egreso_vencido_display: number;
}

const SCENARIOS: Record<ScenarioId, ScenarioConfig> = {
  conservador: {
    ingresosFactor: 0.85,
    egresosFactor: 1.1,
    label: 'Conservador',
    description: 'Cobrás 15% menos y pagás 10% más.',
  },
  base: {
    ingresosFactor: 1,
    egresosFactor: 1,
    label: 'Base',
    description: 'Sin ajustes sobre la proyección real.',
  },
  optimista: {
    ingresosFactor: 1.1,
    egresosFactor: 0.95,
    label: 'Optimista',
    description: 'Cobrás 10% más y egresás 5% menos.',
  },
};

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

function formatMoney(value: number) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function CashflowDashboard() {
  const [days, setDays] = useState(30);
  const [scenario, setScenario] = useState<ScenarioId>('base');
  const [includeOverdue, setIncludeOverdue] = useState(true);
  const [collectionBasis, setCollectionBasis] = useState<CashflowCollectionBasis>('total');
  const { data, loading, error, refresh } = useCashflow(days, collectionBasis);

  const scenarioConfig = SCENARIOS[scenario];

  const viewData = useMemo<CashflowViewPoint[]>(() => {
    if (!data.length) return [];

    const inferredStartBalance = (data[0]?.saldo_acumulado || 0) - (data[0]?.saldo_diario || 0);
    let runningBalance = inferredStartBalance;

    return data.map((row) => {
      const overdueIn = includeOverdue ? row.total_ingreso_vencido : 0;
      const overdueOut = includeOverdue ? row.total_egreso_vencido : 0;

      const ingresoCheques = row.ingreso_cheques * scenarioConfig.ingresosFactor;
      const ingresoLiquidaciones = row.ingreso_liquidaciones * scenarioConfig.ingresosFactor;
      const ingresoWip = row.ingreso_wip * scenarioConfig.ingresosFactor;
      const ingresoVencido = overdueIn * scenarioConfig.ingresosFactor;

      const egresoCheques = row.egreso_cheques * scenarioConfig.egresosFactor;
      const egresoTarjetas = row.egreso_tarjetas * scenarioConfig.egresosFactor;
      const egresoRecurrentes = row.egreso_recurrentes * scenarioConfig.egresosFactor;
      const egresoCompras = row.egreso_compras * scenarioConfig.egresosFactor;
      const egresoVencido = overdueOut * scenarioConfig.egresosFactor;

      const totalIngresos =
        ingresoCheques + ingresoLiquidaciones + ingresoWip + ingresoVencido;
      const totalEgresos =
        egresoCheques + egresoTarjetas + egresoRecurrentes + egresoCompras + egresoVencido;
      const saldoDiario = totalIngresos - totalEgresos;

      runningBalance += saldoDiario;

      return {
        ...row,
        ingreso_cheques_display: ingresoCheques,
        ingreso_liquidaciones_display: ingresoLiquidaciones,
        ingreso_wip_display: ingresoWip,
        total_ingreso_vencido_display: ingresoVencido,
        egreso_cheques_display: egresoCheques,
        egreso_tarjetas_display: egresoTarjetas,
        egreso_recurrentes_display: egresoRecurrentes,
        egreso_compras_display: egresoCompras,
        total_egreso_vencido_display: egresoVencido,
        total_ingresos: totalIngresos,
        total_egresos: totalEgresos,
        saldo_diario: saldoDiario,
        saldo_acumulado: runningBalance,
        ingresos: totalIngresos,
        egresos: totalEgresos,
      };
    });
  }, [data, includeOverdue, scenarioConfig.egresosFactor, scenarioConfig.ingresosFactor]);

  const stats = useMemo(() => {
    if (!viewData.length) return null;

    const currentBalance = viewData[0]?.saldo_acumulado || 0;
    const projectedBalance = viewData[viewData.length - 1]?.saldo_acumulado || 0;
    const minBalance = Math.min(...viewData.map((d) => d.saldo_acumulado));
    const criticalDays = viewData.filter((d) => d.saldo_acumulado < 0).length;
    const overdueOut = viewData.reduce((acc, d) => acc + d.total_egreso_vencido_display, 0);
    const overdueIn = viewData.reduce((acc, d) => acc + d.total_ingreso_vencido_display, 0);

    return {
      currentBalance,
      projectedBalance,
      minBalance,
      criticalDays,
      overdueOut,
      overdueIn,
    };
  }, [viewData]);

  const topOutflows = useMemo(() => {
    return [...viewData]
      .filter((d) => d.total_egresos > 0)
      .sort((a, b) => b.total_egresos - a.total_egresos)
      .slice(0, 5);
  }, [viewData]);

  const handleExportCsv = () => {
    if (!viewData.length) return;
    const headers = [
      'fecha',
      'ingreso_cheques',
      'ingreso_cuentas_corrientes',
      'ingreso_wip',
      'ingreso_vencido',
      'egreso_cheques',
      'egreso_proveedores',
      'egreso_tarjetas',
      'egreso_recurrentes',
      'egreso_vencido',
      'total_ingresos',
      'total_egresos',
      'saldo_diario',
      'saldo_acumulado',
    ];
    const rows = viewData.map((row) => [
      row.fecha,
      row.ingreso_cheques_display,
      row.ingreso_liquidaciones_display,
      row.ingreso_wip_display,
      row.total_ingreso_vencido_display,
      row.egreso_cheques_display,
      row.egreso_compras_display,
      row.egreso_tarjetas_display,
      row.egreso_recurrentes_display,
      row.total_egreso_vencido_display,
      row.total_ingresos,
      row.total_egresos,
      row.saldo_diario,
      row.saldo_acumulado,
    ]);

    const csv = [headers, ...rows]
      .map((line) => line.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute(
      'download',
      `cashflow_detalle_${scenario}_base-${collectionBasis}_${includeOverdue ? 'con_vencidos' : 'sin_vencidos'}_${days}d.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportPdf = () => {
    if (!viewData.length) return;
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(12);
    doc.text('Detalle Diario de Cashflow', 14, 14);
    doc.setFontSize(9);
    doc.text(
      `Escenario: ${scenarioConfig.label} | Base cobro: ${collectionBasis === 'total' ? 'Totales' : 'Cobrables'} | Vencidos: ${includeOverdue ? 'Incluidos' : 'Excluidos'} | Horizonte: ${days} días`,
      14,
      20
    );

    const head = [[
      'Fecha',
      'Ingresos',
      'Egresos',
      'Balance Día',
      'Saldo Acumulado',
    ]];

    const body = viewData.map((row) => [
      dayjs(row.fecha).format('DD/MM/YYYY'),
      formatNumber(row.total_ingresos),
      formatNumber(row.total_egresos),
      formatNumber(row.saldo_diario),
      formatNumber(row.saldo_acumulado),
    ]);

    autoTable(doc, {
      head,
      body,
      startY: 25,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [15, 23, 42] },
      alternateRowStyles: { fillColor: [248, 250, 252] },
    });

    doc.save(`cashflow_detalle_${scenario}_base-${collectionBasis}_${days}d.pdf`);
  };

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
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Proyección de Cashflow</h2>
            <p className="text-sm text-slate-300">
              Simulación financiera basada en cobros, egresos, vencimientos y WIP de producción.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
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

        <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
          <div className="rounded-lg border border-slate-600 bg-slate-800/70 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-300">Escenario</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {(Object.keys(SCENARIOS) as ScenarioId[]).map((scenarioId) => (
                <button
                  key={scenarioId}
                  type="button"
                  onClick={() => setScenario(scenarioId)}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                    scenario === scenarioId
                      ? 'bg-cyan-300 text-slate-900'
                      : 'bg-slate-700 text-slate-100 hover:bg-slate-600'
                  }`}
                >
                  {SCENARIOS[scenarioId].label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-slate-300">{scenarioConfig.description}</p>
          </div>

          <div className="rounded-lg border border-slate-600 bg-slate-800/70 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-300">Supuestos</p>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-sm text-slate-100">Base de cobro</span>
              <div className="inline-flex rounded-md border border-slate-500 bg-slate-700/70 p-0.5">
                <button
                  type="button"
                  onClick={() => setCollectionBasis('total')}
                  className={`rounded px-2.5 py-1 text-xs font-semibold transition ${
                    collectionBasis === 'total'
                      ? 'bg-cyan-300 text-slate-900'
                      : 'text-slate-100 hover:bg-slate-600'
                  }`}
                >
                  Totales
                </button>
                <button
                  type="button"
                  onClick={() => setCollectionBasis('cobrable')}
                  className={`rounded px-2.5 py-1 text-xs font-semibold transition ${
                    collectionBasis === 'cobrable'
                      ? 'bg-cyan-300 text-slate-900'
                      : 'text-slate-100 hover:bg-slate-600'
                  }`}
                >
                  Cobrables
                </button>
              </div>
            </div>
            <p className="mt-2 text-xs text-slate-300">
              {collectionBasis === 'total'
                ? 'Totales: incluye todo WIP pendiente.'
                : 'Cobrables: solo WIP finalizado/entregado con saldo pendiente.'}
            </p>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-sm text-slate-100">Incluir vencidos en proyección</span>
              <button
                type="button"
                onClick={() => setIncludeOverdue((prev) => !prev)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                  includeOverdue ? 'bg-cyan-400' : 'bg-slate-500'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                    includeOverdue ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
            <p className="mt-2 text-xs text-slate-300">
              {includeOverdue ? 'Se consideran cobros/deudas vencidas.' : 'Se excluyen vencidos para foco en flujo futuro.'}
            </p>
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
              <AreaChart data={viewData} margin={{ top: 8, right: 20, left: 8, bottom: 8 }}>
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
                    {item.egreso_cheques_display > 0 && <Badge variant="danger">Cheques</Badge>}
                    {item.egreso_tarjetas_display > 0 && <Badge variant="warning">Tarjetas</Badge>}
                    {item.egreso_recurrentes_display > 0 && <Badge variant="info">Fijos</Badge>}
                    {item.egreso_compras_display > 0 && <Badge variant="secondary">Proveedores</Badge>}
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
            <ComposedChart data={viewData} margin={{ top: 8, right: 20, left: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="fecha" tickFormatter={(v) => dayjs(v).format('DD/MM')} tick={{ fill: '#64748b', fontSize: 12 }} />
              <YAxis tickFormatter={(v) => `${Math.round(v / 1000)}k`} tick={{ fill: '#64748b', fontSize: 12 }} />
              <Tooltip
                labelFormatter={(label) => dayjs(label).format('DD/MM/YYYY')}
                formatter={(value: number, name: string) => [formatMoney(value), name]}
                contentStyle={{ borderRadius: 10, borderColor: '#cbd5e1' }}
              />
              <Legend />
              <Bar dataKey="total_ingreso_vencido_display" name="Cobros vencidos" stackId="flowIn" fill={COLORS.vencidoIngreso} />
              <Bar dataKey="ingreso_cheques_display" name="Ingreso cheques" stackId="flowIn" fill={COLORS.ingresoCheques} />
              <Bar dataKey="ingreso_liquidaciones_display" name="Ingreso cuentas cte." stackId="flowIn" fill={COLORS.ingresoLiquidaciones} />
              <Bar dataKey="ingreso_wip_display" name="Ingreso WIP" stackId="flowIn" fill={COLORS.ingresoWip} />
              <Bar dataKey={(d: CashflowViewPoint) => -d.total_egreso_vencido_display} name="Deudas vencidas" stackId="flowOut" fill={COLORS.vencidoEgreso} />
              <Bar dataKey={(d: CashflowViewPoint) => -d.egreso_cheques_display} name="Egreso cheques" stackId="flowOut" fill={COLORS.egresoCheques} />
              <Bar dataKey={(d: CashflowViewPoint) => -d.egreso_compras_display} name="Egreso proveedores" stackId="flowOut" fill={COLORS.egresoCompras} />
              <Bar dataKey={(d: CashflowViewPoint) => -d.egreso_tarjetas_display} name="Egreso tarjetas" stackId="flowOut" fill={COLORS.egresoTarjetas} />
              <Bar dataKey={(d: CashflowViewPoint) => -d.egreso_recurrentes_display} name="Egreso fijos" stackId="flowOut" fill={COLORS.egresoRecurrentes} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card className="rounded-xl border border-slate-200 p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Detalle diario</h3>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleExportCsv}>
              <Download className="mr-2 h-4 w-4" />
              CSV
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportPdf}>
              <Download className="mr-2 h-4 w-4" />
              PDF
            </Button>
            <span className="text-xs text-slate-400">{viewData.length} filas</span>
          </div>
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
            {viewData.map((item, index) => (
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
                  {item.total_ingreso_vencido_display > 0 && (
                    <div className="flex justify-between text-emerald-800">
                      <span>Vencidos</span>
                      <span className="font-semibold">{formatMoney(item.total_ingreso_vencido_display)}</span>
                    </div>
                  )}
                  {item.ingreso_cheques_display > 0 && (
                    <div className="flex justify-between text-sky-700">
                      <span>Cheques</span>
                      <span>{formatMoney(item.ingreso_cheques_display)}</span>
                    </div>
                  )}
                  {item.ingreso_liquidaciones_display > 0 && (
                    <div className="flex justify-between text-teal-700">
                      <span>Ctas. cte.</span>
                      <span>{formatMoney(item.ingreso_liquidaciones_display)}</span>
                    </div>
                  )}
                  {item.ingreso_wip_display > 0 && (
                    <div className="flex justify-between text-indigo-700">
                      <span>WIP producción</span>
                      <span>{formatMoney(item.ingreso_wip_display)}</span>
                    </div>
                  )}
                  {item.total_ingresos === 0 && <span className="text-slate-300">-</span>}
                </div>

                <div className="col-span-3 space-y-1 text-xs">
                  {item.total_egreso_vencido_display > 0 && (
                    <div className="flex justify-between text-rose-800">
                      <span>Vencidos</span>
                      <span className="font-semibold">{formatMoney(item.total_egreso_vencido_display)}</span>
                    </div>
                  )}
                  {item.egreso_cheques_display > 0 && (
                    <div className="flex justify-between text-red-700">
                      <span>Cheques</span>
                      <span>{formatMoney(item.egreso_cheques_display)}</span>
                    </div>
                  )}
                  {item.egreso_compras_display > 0 && (
                    <div className="flex justify-between text-pink-700">
                      <span>Proveedores</span>
                      <span>{formatMoney(item.egreso_compras_display)}</span>
                    </div>
                  )}
                  {item.egreso_tarjetas_display > 0 && (
                    <div className="flex justify-between text-orange-700">
                      <span>Tarjetas</span>
                      <span>{formatMoney(item.egreso_tarjetas_display)}</span>
                    </div>
                  )}
                  {item.egreso_recurrentes_display > 0 && (
                    <div className="flex justify-between text-amber-700">
                      <span>Gastos fijos</span>
                      <span>{formatMoney(item.egreso_recurrentes_display)}</span>
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
          <span>Escenario, base de cobro y vencidos impactan KPIs, gráficos y exportaciones.</span>
        </div>
      </Card>
    </div>
  );
}
