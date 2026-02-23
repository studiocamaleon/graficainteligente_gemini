import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Download, Loader2, Sparkles, TrendingUp, Wand2 } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Card } from '../ui/card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { CashflowV2AssumptionsPanel } from './CashflowV2AssumptionsPanel';
import { CashflowV2KpiStrip } from './CashflowV2KpiStrip';
import { CashflowV2BalanceAreaChart } from './charts/CashflowV2BalanceAreaChart';
import { CashflowV2FlowWaterfallChart } from './charts/CashflowV2FlowWaterfallChart';
import { CashflowV2InflowStackedChart } from './charts/CashflowV2InflowStackedChart';
import { CashflowV2OutflowStackedChart } from './charts/CashflowV2OutflowStackedChart';
import { CashflowV2StressHeatmapChart } from './charts/CashflowV2StressHeatmapChart';
import { useCashflowV2 } from '../../hooks/useCashflowV2';
import type { CashflowV2AssumptionsDelta, CashflowV2Basis, CashflowV2Point } from '../../types/finanzas-cashflow-v2';
import { DEFAULT_CASHFLOW_V2_ASSUMPTIONS } from '../../types/finanzas-cashflow-v2';

function formatMoney(value: number) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0);
}

function toAbsoluteFactors(a: CashflowV2AssumptionsDelta) {
  return {
    wipOverdue: (100 + a.delta_wip_overdue_collectable) / 100,
    wipFuture: (100 + a.delta_wip_future_completion) / 100,
    ingresos: (100 + a.delta_ingresos) / 100,
    egresos: (100 + a.delta_egresos) / 100,
    includeOverdue: a.include_overdue,
  };
}

export function CashflowV2Dashboard() {
  const [days, setDays] = useState(30);
  const [basis, setBasis] = useState<CashflowV2Basis>('total');
  const [uiAssumptions, setUiAssumptions] = useState<CashflowV2AssumptionsDelta>(DEFAULT_CASHFLOW_V2_ASSUMPTIONS);
  const [syncedAssumptions, setSyncedAssumptions] = useState<CashflowV2AssumptionsDelta>(DEFAULT_CASHFLOW_V2_ASSUMPTIONS);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data, loading, syncing, error, refresh } = useCashflowV2(days, basis, syncedAssumptions);

  const uiHash = JSON.stringify(uiAssumptions);
  const syncedHash = JSON.stringify(syncedAssumptions);
  const hasPendingSync = uiHash !== syncedHash;

  useEffect(() => {
    if (!hasPendingSync) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSyncedAssumptions(uiAssumptions);
    }, 400);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [uiAssumptions, hasPendingSync]);

  const commitAssumptionsNow = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setSyncedAssumptions(uiAssumptions);
  };

  const previewData = useMemo<CashflowV2Point[]>(() => {
    if (!data.length) return [];

    const ui = toAbsoluteFactors(uiAssumptions);
    const synced = toAbsoluteFactors(syncedAssumptions);

    const ratioIngresos = synced.ingresos === 0 ? 1 : ui.ingresos / synced.ingresos;
    const ratioEgresos = synced.egresos === 0 ? 1 : ui.egresos / synced.egresos;
    const ratioWipFuture = (synced.wipFuture * synced.ingresos) === 0 ? 1 : (ui.wipFuture * ui.ingresos) / (synced.wipFuture * synced.ingresos);
    const ratioWipOverdue = (synced.wipOverdue * synced.ingresos) === 0 ? 1 : (ui.wipOverdue * ui.ingresos) / (synced.wipOverdue * synced.ingresos);

    const initialBalance = (data[0]?.saldo_acumulado || 0) - (data[0]?.saldo_diario || 0);
    let runningBalance = initialBalance;

    return data.map((row) => {
      const ingreso_cheques = row.ingreso_cheques * ratioIngresos;
      const ingreso_liquidaciones = row.ingreso_liquidaciones * ratioIngresos;
      const ingreso_wip_futuro = row.ingreso_wip_futuro * ratioWipFuture;
      const ingreso_wip_vencido = ui.includeOverdue ? row.ingreso_wip_vencido * ratioWipOverdue : 0;
      const ingreso_otros_vencidos = ui.includeOverdue ? row.ingreso_otros_vencidos * ratioIngresos : 0;

      const egreso_cheques = row.egreso_cheques * ratioEgresos;
      const egreso_tarjetas = row.egreso_tarjetas * ratioEgresos;
      const egreso_recurrentes = row.egreso_recurrentes * ratioEgresos;
      const egreso_compras = row.egreso_compras * ratioEgresos;
      const total_egreso_vencido = ui.includeOverdue ? row.total_egreso_vencido * ratioEgresos : 0;

      const total_ingreso_vencido = ingreso_wip_vencido + ingreso_otros_vencidos;
      const total_ingresos = ingreso_cheques + ingreso_liquidaciones + ingreso_wip_futuro + total_ingreso_vencido;
      const total_egresos = egreso_cheques + egreso_tarjetas + egreso_recurrentes + egreso_compras + total_egreso_vencido;
      const saldo_diario = total_ingresos - total_egresos;

      runningBalance += saldo_diario;

      return {
        ...row,
        ingreso_cheques,
        ingreso_liquidaciones,
        ingreso_wip_futuro,
        ingreso_wip_vencido,
        ingreso_otros_vencidos,
        egreso_cheques,
        egreso_tarjetas,
        egreso_recurrentes,
        egreso_compras,
        total_ingreso_vencido,
        total_egreso_vencido,
        total_ingresos,
        total_egresos,
        saldo_diario,
        saldo_acumulado: runningBalance,
      };
    });
  }, [data, uiAssumptions, syncedAssumptions]);

  const stats = useMemo(() => {
    if (!previewData.length) return null;
    const currentBalance = previewData[0]?.saldo_acumulado || 0;
    const projectedBalance = previewData[previewData.length - 1]?.saldo_acumulado || 0;
    const criticalDays = previewData.filter((d) => d.saldo_acumulado < 0).length;

    const totalIngresos = previewData.reduce((acc, d) => acc + d.total_ingresos, 0);
    const totalEgresos = previewData.reduce((acc, d) => acc + d.total_egresos, 0);
    const totalIngresoVencido = previewData.reduce((acc, d) => acc + d.total_ingreso_vencido, 0);
    const totalWipVencido = previewData.reduce((acc, d) => acc + d.ingreso_wip_vencido, 0);
    const totalOtrosVencidos = previewData.reduce((acc, d) => acc + d.ingreso_otros_vencidos, 0);
    const totalEgresoVencido = previewData.reduce((acc, d) => acc + d.total_egreso_vencido, 0);

    return {
      currentBalance,
      projectedBalance,
      criticalDays,
      totalIngresos,
      totalEgresos,
      totalIngresoVencido,
      totalWipVencido,
      totalOtrosVencidos,
      totalEgresoVencido,
    };
  }, [previewData]);

  const handleAssumptionsChange = (patch: Partial<CashflowV2AssumptionsDelta>) => {
    setUiAssumptions((prev) => ({ ...prev, ...patch }));
  };

  const handleExportCsv = () => {
    if (!previewData.length) return;

    const headers = [
      'fecha',
      'ingreso_cheques',
      'ingreso_liquidaciones',
      'ingreso_wip_futuro',
      'ingreso_wip_vencido',
      'ingreso_otros_vencidos',
      'egreso_cheques',
      'egreso_tarjetas',
      'egreso_recurrentes',
      'egreso_compras',
      'total_ingreso_vencido',
      'total_egreso_vencido',
      'total_ingresos',
      'total_egresos',
      'saldo_diario',
      'saldo_acumulado',
    ];

    const rows = previewData.map((row) => [
      row.fecha,
      row.ingreso_cheques,
      row.ingreso_liquidaciones,
      row.ingreso_wip_futuro,
      row.ingreso_wip_vencido,
      row.ingreso_otros_vencidos,
      row.egreso_cheques,
      row.egreso_tarjetas,
      row.egreso_recurrentes,
      row.egreso_compras,
      row.total_ingreso_vencido,
      row.total_egreso_vencido,
      row.total_ingresos,
      row.total_egresos,
      row.saldo_diario,
      row.saldo_acumulado,
    ]);

    const assumptionsRow = [
      ['basis', basis],
      ['delta_wip_overdue_collectable', uiAssumptions.delta_wip_overdue_collectable],
      ['delta_wip_future_completion', uiAssumptions.delta_wip_future_completion],
      ['delta_ingresos', uiAssumptions.delta_ingresos],
      ['delta_egresos', uiAssumptions.delta_egresos],
      ['include_overdue', uiAssumptions.include_overdue],
    ]
      .map(([k, v]) => `# ${k}: ${v}`)
      .join('\n');

    const csv = [headers, ...rows]
      .map((line) => line.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([`${assumptionsRow}\n${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `cashflow_v2_${basis}_${days}d.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportPdf = () => {
    if (!previewData.length) return;
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(12);
    doc.text('Cashflow V2 - Proyeccion', 14, 14);
    doc.setFontSize(9);
    doc.text(
      `Base: ${basis} | Dias: ${days} | ΔWIP vencido: ${uiAssumptions.delta_wip_overdue_collectable}% | ΔWIP futuro: ${uiAssumptions.delta_wip_future_completion}% | ΔIngresos: ${uiAssumptions.delta_ingresos}% | ΔEgresos: ${uiAssumptions.delta_egresos}% | Vencidos: ${uiAssumptions.include_overdue ? 'si' : 'no'}`,
      14,
      20
    );

    autoTable(doc, {
      startY: 26,
      head: [[
        'Fecha',
        'Ingresos',
        'Egresos',
        'Vencido WIP',
        'Vencido Otros',
        'Saldo Diario',
        'Saldo Acumulado',
      ]],
      body: previewData.map((row) => [
        row.fecha,
        formatNumber(row.total_ingresos),
        formatNumber(row.total_egresos),
        formatNumber(row.ingreso_wip_vencido),
        formatNumber(row.ingreso_otros_vencidos),
        formatNumber(row.saldo_diario),
        formatNumber(row.saldo_acumulado),
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [15, 23, 42] },
    });

    doc.save(`cashflow_v2_${basis}_${days}d.pdf`);
  };

  if (loading && !data.length) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-32 animate-pulse rounded-xl border border-slate-200 bg-slate-100" />
        ))}
      </div>
    );
  }

  if (error && !previewData.length) {
    return (
      <Card className="border-rose-200 bg-rose-50 p-6">
        <p className="text-sm text-rose-700">No se pudo cargar Cashflow V2: {error}</p>
        <div className="mt-3">
          <Button variant="outline" size="sm" onClick={refresh}>Reintentar</Button>
        </div>
      </Card>
    );
  }

  if (!stats) {
    return (
      <Card className="border-slate-200 p-6">
        <p className="text-sm text-slate-500">No hay datos para el periodo seleccionado.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-slate-200 bg-[radial-gradient(circle_at_15%_15%,#c7f9ff_0%,#ffffff_38%,#f8fafc_100%)] p-5 shadow-lg"
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-cyan-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-cyan-700">
              <Sparkles className="h-3.5 w-3.5" />
              Cashflow V2
            </div>
            <h2 className="text-2xl font-semibold text-slate-900">Proyección inteligente de flujo de caja</h2>
            <p className="mt-1 text-sm text-slate-600">
              Simulá escenarios con supuestos explícitos y lectura clara de cobrabilidad real.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {[30, 60, 90].map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setDays(value)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  days === value ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-100'
                }`}
              >
                {value} dias
              </button>
            ))}
            <Button variant="outline" size="sm" onClick={refresh}>
              <Wand2 className="h-4 w-4" />
              Recalcular
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportCsv}>
              <Download className="h-4 w-4" />
              CSV
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportPdf}>
              <Download className="h-4 w-4" />
              PDF
            </Button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
          <Badge variant={basis === 'cobrable' ? 'info' : 'primary'}>Base: {basis === 'cobrable' ? 'Cobrables' : 'Totales'}</Badge>
          <Badge variant="default">Δ Ingresos: {uiAssumptions.delta_ingresos > 0 ? '+' : ''}{uiAssumptions.delta_ingresos}%</Badge>
          <Badge variant="default">Δ Egresos: {uiAssumptions.delta_egresos > 0 ? '+' : ''}{uiAssumptions.delta_egresos}%</Badge>
          <Badge variant="default">Ingresos: {formatMoney(stats.totalIngresos)}</Badge>
          <Badge variant="default">Egresos: {formatMoney(stats.totalEgresos)}</Badge>
          <Badge variant="default">Vencidos +: {formatMoney(stats.totalIngresoVencido)}</Badge>
          <Badge variant="default">Vencidos -: {formatMoney(stats.totalEgresoVencido)}</Badge>
          {(syncing || hasPendingSync) && (
            <Badge variant="warning" className="inline-flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              Sincronizando...
            </Badge>
          )}
        </div>

        {error && previewData.length > 0 && (
          <p className="mt-2 text-xs text-rose-600">Advertencia de sincronización: {error}</p>
        )}
      </motion.div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-4">
        <div className="xl:col-span-1">
          <CashflowV2AssumptionsPanel
            basis={basis}
            onBasisChange={setBasis}
            assumptions={uiAssumptions}
            onAssumptionsChange={handleAssumptionsChange}
            onAssumptionsCommit={commitAssumptionsNow}
          />
        </div>

        <div className="space-y-5 xl:col-span-3">
          <CashflowV2KpiStrip
            currentBalance={stats.currentBalance}
            projectedBalance={stats.projectedBalance}
            wipOverdue={stats.totalWipVencido}
            otherOverdue={stats.totalOtrosVencidos}
            overdueOut={stats.totalEgresoVencido}
            criticalDays={stats.criticalDays}
          />

          <Card className="border-slate-200 bg-white p-4 shadow-md">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Tendencia de saldo acumulado</h3>
              <span className="text-xs text-slate-500">Horizonte {days} días</span>
            </div>
            <CashflowV2BalanceAreaChart data={previewData} />
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Card className="border-slate-200 bg-white p-4 shadow-md">
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Contribución neta del período</h3>
          <CashflowV2FlowWaterfallChart
            totalIngresos={stats.totalIngresos}
            totalEgresos={stats.totalEgresos}
            totalIngresoVencido={stats.totalIngresoVencido}
            totalEgresoVencido={stats.totalEgresoVencido}
          />
        </Card>

        <Card className="border-slate-200 bg-white p-4 shadow-md">
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Estrés de caja proyectado</h3>
          <CashflowV2StressHeatmapChart data={previewData} />
        </Card>
      </div>

      <Card className="border-slate-200 bg-white p-4 shadow-md">
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Composición diaria de ingresos</h3>
        <CashflowV2InflowStackedChart data={previewData} />
        <p className="mt-2 text-xs text-slate-500">
          El desglose separa WIP futuro, WIP vencido y otros vencidos para lectura financiera más precisa.
        </p>
      </Card>

      <Card className="border-slate-200 bg-white p-4 shadow-md">
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Composición diaria de egresos</h3>
        <CashflowV2OutflowStackedChart data={previewData} />
        <p className="mt-2 text-xs text-slate-500">
          Visualiza cheques, tarjetas, recurrentes, compras y vencidos por día para detectar presión de salida.
        </p>
      </Card>

      <Card className="border-slate-200 bg-white p-4 shadow-md">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Detalle diario de movimientos</h3>
          <span className="text-xs text-slate-500">{previewData.length} días</span>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-[1600px] w-full text-sm">
            <thead className="sticky top-0 z-10 bg-slate-900 text-xs uppercase tracking-wide text-slate-200">
              <tr>
                <th className="px-3 py-2 text-left">Fecha</th>
                <th className="px-3 py-2 text-right">Ingreso cheques</th>
                <th className="px-3 py-2 text-right">Ingreso liquidaciones</th>
                <th className="px-3 py-2 text-right">Ingreso WIP futuro</th>
                <th className="px-3 py-2 text-right">Ingreso WIP vencido</th>
                <th className="px-3 py-2 text-right">Ingreso otros vencidos</th>
                <th className="px-3 py-2 text-right">Total ingresos</th>
                <th className="px-3 py-2 text-right">Egreso cheques</th>
                <th className="px-3 py-2 text-right">Egreso tarjetas</th>
                <th className="px-3 py-2 text-right">Egreso recurrentes</th>
                <th className="px-3 py-2 text-right">Egreso compras</th>
                <th className="px-3 py-2 text-right">Total egreso vencido</th>
                <th className="px-3 py-2 text-right">Total egresos</th>
                <th className="px-3 py-2 text-right">Saldo diario</th>
                <th className="px-3 py-2 text-right">Saldo acumulado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {previewData.map((row, idx) => (
                <tr key={row.fecha} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/70'}>
                  <td className="px-3 py-2 text-left font-medium text-slate-700">{new Date(row.fecha).toLocaleDateString('es-AR')}</td>
                  <td className="px-3 py-2 text-right text-slate-700">{formatMoney(row.ingreso_cheques)}</td>
                  <td className="px-3 py-2 text-right text-slate-700">{formatMoney(row.ingreso_liquidaciones)}</td>
                  <td className="px-3 py-2 text-right text-slate-700">{formatMoney(row.ingreso_wip_futuro)}</td>
                  <td className="px-3 py-2 text-right text-emerald-700">{formatMoney(row.ingreso_wip_vencido)}</td>
                  <td className="px-3 py-2 text-right text-teal-700">{formatMoney(row.ingreso_otros_vencidos)}</td>
                  <td className="px-3 py-2 text-right font-semibold text-slate-900">{formatMoney(row.total_ingresos)}</td>
                  <td className="px-3 py-2 text-right text-slate-700">{formatMoney(row.egreso_cheques)}</td>
                  <td className="px-3 py-2 text-right text-slate-700">{formatMoney(row.egreso_tarjetas)}</td>
                  <td className="px-3 py-2 text-right text-slate-700">{formatMoney(row.egreso_recurrentes)}</td>
                  <td className="px-3 py-2 text-right text-slate-700">{formatMoney(row.egreso_compras)}</td>
                  <td className="px-3 py-2 text-right text-rose-700">{formatMoney(row.total_egreso_vencido)}</td>
                  <td className="px-3 py-2 text-right font-semibold text-slate-900">{formatMoney(row.total_egresos)}</td>
                  <td className={`px-3 py-2 text-right font-semibold ${row.saldo_diario >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {formatMoney(row.saldo_diario)}
                  </td>
                  <td className={`px-3 py-2 text-right font-semibold ${row.saldo_acumulado >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {formatMoney(row.saldo_acumulado)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="border-slate-200 bg-slate-50/70 p-4">
        <div className="flex items-center gap-2 text-slate-700">
          <TrendingUp className="h-4 w-4" />
          <p className="text-sm font-medium">Lectura rápida</p>
        </div>
        <p className="mt-1 text-sm text-slate-600">
          Si el saldo proyectado es negativo y hay muchos días críticos, conviene subir el porcentaje de cumplimiento WIP futuro o acelerar cobranzas vencidas para medir el impacto real en caja.
        </p>
      </Card>
    </div>
  );
}
