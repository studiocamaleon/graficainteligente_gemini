import { useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { usePageHeader } from '../../hooks/usePageHeader';
import { WelcomeIntro } from '../../components/dashboard/WelcomeIntro';
import { DashboardFiltersBar, type DashboardMainTab } from '../../components/dashboard/DashboardFiltersBar';
import { DashboardKpiGrid } from '../../components/dashboard/DashboardKpiGrid';
import { DashboardChartsPanel } from '../../components/dashboard/DashboardChartsPanel';
import { DashboardOperationalPanel } from '../../components/dashboard/DashboardOperationalPanel';
import { useDashboardDataV2 } from '../../hooks/useDashboardDataV2';
import type { DashboardPeriod, DashboardScope } from '../../types/dashboard';
import { PendingDeliveriesEmbedded } from './delivery/PendingDeliveriesPage';

const VALID_SCOPES: DashboardScope[] = ['ot', 'copiado'];
const VALID_PERIODS: DashboardPeriod[] = ['7d', '30d', '90d', 'mes_actual'];
const VALID_TABS: DashboardMainTab[] = ['ot', 'copiado', 'entregas'];

function parseScope(value: string | null): DashboardScope {
  if (value && VALID_SCOPES.includes(value as DashboardScope)) {
    return value as DashboardScope;
  }
  return 'ot';
}

function parsePeriod(value: string | null): DashboardPeriod {
  if (value && VALID_PERIODS.includes(value as DashboardPeriod)) {
    return value as DashboardPeriod;
  }
  return '7d';
}

function parseTab(value: string | null): DashboardMainTab {
  if (value && VALID_TABS.includes(value as DashboardMainTab)) {
    return value as DashboardMainTab;
  }
  return 'ot';
}

export function Dashboard() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  usePageHeader('Resumen');

  const initialScope = useMemo(() => parseScope(searchParams.get('scope')), [searchParams]);
  const initialPeriod = useMemo(() => parsePeriod(searchParams.get('period')), [searchParams]);
  const activeTab = useMemo(() => parseTab(searchParams.get('tab')), [searchParams]);
  const dashboardEnabled = activeTab !== 'entregas';

  const {
    loading,
    error,
    scope,
    period,
    entregasLimit,
    kpis,
    series,
    operativo,
    lastUpdated,
    isRealtimeConnected,
    setScope,
    setPeriod,
    setEntregasLimit,
    refresh,
  } = useDashboardDataV2({
    initialScope,
    initialPeriod,
    enabled: dashboardEnabled,
  });

  useEffect(() => {
    if (!dashboardEnabled) return;
    const nextScope = parseScope(searchParams.get('scope'));
    const nextPeriod = parsePeriod(searchParams.get('period'));
    if (nextScope !== scope) setScope(nextScope);
    if (nextPeriod !== period) setPeriod(nextPeriod);
  }, [dashboardEnabled, period, scope, searchParams, setPeriod, setScope]);

  const handleTabChange = (tab: DashboardMainTab) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', tab);
    if (tab !== 'entregas') {
      next.set('scope', tab);
      next.set('period', period);
    }
    setSearchParams(next, { replace: true });
    if (tab !== 'entregas') {
      setScope(tab);
    }
  };

  const handlePeriodChange = (nextPeriod: DashboardPeriod) => {
    setPeriod(nextPeriod);
    const next = new URLSearchParams(searchParams);
    next.set('scope', scope);
    next.set('period', nextPeriod);
    setSearchParams(next, { replace: true });
  };

  const handleOpenOrder = (orderId: string, tipo: 'ot' | 'copiado') => {
    if (tipo === 'copiado') {
      navigate(`/app/centro-copiado/ordenes/${orderId}`);
      return;
    }
    navigate(`/app/orders/${orderId}`);
  };

  return (
    <div className="space-y-6">
      <WelcomeIntro loading={loading} />

      <DashboardFiltersBar
        activeTab={activeTab}
        period={period}
        loading={loading}
        lastUpdated={lastUpdated}
        isRealtimeConnected={isRealtimeConnected}
        onTabChange={handleTabChange}
        onPeriodChange={handlePeriodChange}
        onRefresh={refresh}
      />

      {dashboardEnabled && error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      {dashboardEnabled ? (
        <>
          <DashboardKpiGrid
            scope={scope}
            kpis={kpis}
            loading={loading}
            onOpenRoute={(path) => navigate(path)}
          />

          <DashboardChartsPanel series={series} loading={loading} />

          <DashboardOperationalPanel
            entregas={operativo.proximasEntregas}
            actividad={operativo.actividadReciente}
            loading={loading}
            onOpenOrder={handleOpenOrder}
            canViewMore={operativo.proximasEntregas.length >= entregasLimit}
            onViewMore={() => setEntregasLimit((prev) => prev + 10)}
          />
        </>
      ) : (
        <PendingDeliveriesEmbedded />
      )}
    </div>
  );
}
