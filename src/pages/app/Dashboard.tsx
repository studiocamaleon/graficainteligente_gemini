import { useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { usePageHeader } from '../../hooks/usePageHeader';
import { WelcomeIntro } from '../../components/dashboard/WelcomeIntro';
import { DashboardFiltersBar } from '../../components/dashboard/DashboardFiltersBar';
import { DashboardKpiGrid } from '../../components/dashboard/DashboardKpiGrid';
import { DashboardChartsPanel } from '../../components/dashboard/DashboardChartsPanel';
import { DashboardOperationalPanel } from '../../components/dashboard/DashboardOperationalPanel';
import { useDashboardDataV2 } from '../../hooks/useDashboardDataV2';
import type { DashboardPeriod, DashboardScope } from '../../types/dashboard';

const VALID_SCOPES: DashboardScope[] = ['ot', 'copiado'];
const VALID_PERIODS: DashboardPeriod[] = ['7d', '30d', '90d', 'mes_actual'];

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

export function Dashboard() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  usePageHeader('Resumen');

  const initialScope = useMemo(() => parseScope(searchParams.get('scope')), [searchParams]);
  const initialPeriod = useMemo(() => parsePeriod(searchParams.get('period')), [searchParams]);

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
  });

  useEffect(() => {
    const nextScope = parseScope(searchParams.get('scope'));
    const nextPeriod = parsePeriod(searchParams.get('period'));
    if (nextScope !== scope) setScope(nextScope);
    if (nextPeriod !== period) setPeriod(nextPeriod);
  }, [period, scope, searchParams, setPeriod, setScope]);

  const handleScopeChange = (nextScope: DashboardScope) => {
    setScope(nextScope);
    const next = new URLSearchParams(searchParams);
    next.set('scope', nextScope);
    next.set('period', period);
    setSearchParams(next, { replace: true });
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
        scope={scope}
        period={period}
        loading={loading}
        lastUpdated={lastUpdated}
        isRealtimeConnected={isRealtimeConnected}
        onScopeChange={handleScopeChange}
        onPeriodChange={handlePeriodChange}
        onRefresh={refresh}
        onOpenPendingDeliveries={() => navigate('/app/pending-deliveries')}
      />

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

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
    </div>
  );
}
