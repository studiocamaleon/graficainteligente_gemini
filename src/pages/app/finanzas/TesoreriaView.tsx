import { useMemo, useState } from 'react';
import { Wallet, TrendingUp, TrendingDown, DollarSign, CreditCard, LineChart, HandCoins, Landmark, AlertTriangle } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Tabs } from '../../../components/ui/Tabs';
import { ResumenCajas } from '../../../components/tesoreria/ResumenCajas';
import { IngresosPanel } from '../../../components/tesoreria/IngresosPanel';
import { EgresosPanel } from '../../../components/tesoreria/EgresosPanel';
import { RecurringExpensesPanel } from '../../../components/tesoreria/RecurringExpensesPanel';
import { ChequesPanel } from '../../../components/tesoreria/ChequesPanel';
import { DineroPorCobrarPanel } from '../../../components/tesoreria/DineroPorCobrarPanel';
import { TarjetasPanel } from '../../../components/tesoreria/TarjetasPanel';
import { CashflowDashboard } from '../../../components/finanzas/CashflowDashboard';
import { CajaMovimientosModal } from '../../../components/tesoreria/CajaMovimientosModal';
import { useCajas } from '../../../hooks/useCajas';

import { useAuth } from '../../../hooks/useAuth';
import { useTesoreriaOverview } from '../../../hooks/useTesoreriaOverview';
import type { CajaConMediosCobro } from '../../../types/medios-cobro';

type TesoreriaPeriodo = '7d' | '30d' | '90d';

function formatCurrency(value: number) {
  return value.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function TesoreriaView() {
  const { profile } = useAuth();
  const { resumenPorTipo, totalSaldo, refetch } = useCajas();

  const isOperadorDiseno = profile?.role === 'operador_diseno';
  const [activeTab, setActiveTab] = useState(isOperadorDiseno ? 'cajas' : 'cashflow');
  const [period, setPeriod] = useState<TesoreriaPeriodo>('30d');
  const [selectedCaja, setSelectedCaja] = useState<CajaConMediosCobro | null>(null);

  const { overview, loading: overviewLoading, error: overviewError, range, refetch: refetchOverview } = useTesoreriaOverview(period);

  const allTabs = [
    { id: 'cashflow', label: 'Proyección (Cashflow)', icon: LineChart },
    { id: 'cajas', label: 'Cajas y Saldos', icon: Wallet },
    { id: 'cheques', label: 'Cartera Cheques', icon: DollarSign },
    { id: 'tarjetas', label: 'Tarjetas Corp.', icon: CreditCard },
    { id: 'ingresos', label: 'Ingresos', icon: TrendingUp },
    { id: 'egresos', label: 'Egresos', icon: TrendingDown },
    { id: 'recurrentes', label: 'Gastos Fijos', icon: RefreshCw },
    { id: 'por-cobrar', label: 'Por Cobrar', icon: DollarSign },
  ];

  const tabs = isOperadorDiseno
    ? allTabs.filter(t => t.id === 'cajas')
    : allTabs;

  const allCajas = useMemo(
    () => resumenPorTipo.flatMap((grupo) => grupo.cajas),
    [resumenPorTipo]
  );

  const handleRefreshAll = async () => {
    await Promise.all([refetch(), refetchOverview()]);
  };

  const kpis = [
    {
      id: 'ingresos',
      label: 'Ingresos',
      value: overview ? `$${formatCurrency(overview.ingresos_total)}` : '-',
      icon: TrendingUp,
      accent: 'text-emerald-700',
    },
    {
      id: 'egresos',
      label: 'Egresos',
      value: overview ? `$${formatCurrency(overview.egresos_total)}` : '-',
      icon: TrendingDown,
      accent: 'text-rose-700',
    },
    {
      id: 'saldo',
      label: 'Saldo neto',
      value: overview ? `$${formatCurrency(overview.saldo_neto)}` : '-',
      icon: Landmark,
      accent: overview && overview.saldo_neto < 0 ? 'text-rose-700' : 'text-slate-800',
    },
    {
      id: 'por-cobrar',
      label: 'Por cobrar',
      value: overview ? `$${formatCurrency(overview.por_cobrar_total)}` : '-',
      icon: HandCoins,
      accent: 'text-blue-700',
    },
    {
      id: 'por-pagar',
      label: 'Por pagar',
      value: overview ? `$${formatCurrency(overview.por_pagar_total)}` : '-',
      icon: AlertTriangle,
      accent: 'text-amber-700',
    },
    {
      id: 'cajas',
      label: 'Cajas activas',
      value: overview ? String(overview.cajas_activas_count) : '-',
      icon: Wallet,
      accent: 'text-slate-700',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header enterprise */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 md:p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Tesorería</h2>
            <p className="text-sm text-slate-500">
              Control operativo de caja, cobranzas y obligaciones.
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Rango: {range.from} a {range.to}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1">
              {(['7d', '30d', '90d'] as TesoreriaPeriodo[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPeriod(p)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                    period === p
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {p === '7d' ? '7 días' : p === '30d' ? '30 días' : '90 días'}
                </button>
              ))}
            </div>
            <Button variant="secondary" onClick={handleRefreshAll}>
              Actualizar datos
            </Button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          {kpis.map((kpi) => {
            const Icon = kpi.icon;
            return (
              <div key={kpi.id} className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{kpi.label}</p>
                  <Icon className={`h-4 w-4 ${kpi.accent}`} />
                </div>
                <p className={`mt-2 text-lg font-semibold ${kpi.accent}`}>{kpi.value}</p>
              </div>
            );
          })}
        </div>

        {(overviewLoading || overviewError) && (
          <div className="mt-3 text-xs text-slate-500">
            {overviewLoading ? 'Actualizando métricas...' : `No se pudo cargar resumen: ${overviewError}`}
          </div>
        )}
      </div>

      {/* Tabs */}
      <Tabs
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {/* Content */}
      <div className="mt-6">
        {activeTab === 'cashflow' && <CashflowDashboard />}

        {activeTab === 'cajas' && (
          <ResumenCajas
            resumenPorTipo={resumenPorTipo}
            totalSaldo={totalSaldo}
            onCajaClick={(cajaId) => {
              const caja = allCajas.find((item) => item.id === cajaId) || null;
              setSelectedCaja(caja);
            }}
            onRefresh={refetch}
          />
        )}

        {activeTab === 'cheques' && <ChequesPanel />}

        {activeTab === 'tarjetas' && <TarjetasPanel />}

        {activeTab === 'ingresos' && <IngresosPanel onIngresoRegistrado={refetch} />}

        {activeTab === 'egresos' && <EgresosPanel onEgresoRegistrado={refetch} />}

        {activeTab === 'recurrentes' && <RecurringExpensesPanel />}

        {activeTab === 'por-cobrar' && <DineroPorCobrarPanel />}
      </div>

      <CajaMovimientosModal
        isOpen={!!selectedCaja}
        onClose={() => setSelectedCaja(null)}
        caja={selectedCaja}
      />
    </div>
  );
}
