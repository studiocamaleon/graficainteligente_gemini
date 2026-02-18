import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { PerformanceFiltersBar } from '../../../components/production/performance/PerformanceFiltersBar';
import { PerformanceKpiRow } from '../../../components/production/performance/PerformanceKpiRow';
import { CompletedByUserChart } from '../../../components/production/performance/CompletedByUserChart';
import { CompletedByStationChart } from '../../../components/production/performance/CompletedByStationChart';
import { CycleTrendChart } from '../../../components/production/performance/CycleTrendChart';
import { WorktablesGlobalKanban } from '../../../components/production/performance/WorktablesGlobalKanban';
import { useProductionPerformance } from '../../../hooks/useProductionPerformance';

export function PerformanceView() {
  const {
    loading,
    error,
    filters,
    estaciones,
    usuarios,
    kpis,
    seriesByUser,
    seriesByStation,
    cycleTrend,
    worktablesByUser,
    setPeriod,
    setEstacionId,
    setUserId,
    refresh,
    isRealtimeConnected,
    lastUpdated,
  } = useProductionPerformance();

  return (
    <div className="space-y-4">
      <PerformanceFiltersBar
        period={filters.period}
        estacionId={filters.estacionId}
        userId={filters.userId}
        estaciones={estaciones}
        usuarios={usuarios}
        loading={loading}
        isRealtimeConnected={isRealtimeConnected}
        onPeriodChange={setPeriod}
        onEstacionChange={setEstacionId}
        onUserChange={setUserId}
        onRefresh={refresh}
      />

      {lastUpdated && (
        <p className="text-xs text-slate-500">
          Actualizado: {lastUpdated.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </p>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <PerformanceKpiRow kpis={kpis} loading={loading} />

      <div className="grid gap-4 xl:grid-cols-2">
        <CompletedByUserChart data={seriesByUser} loading={loading} />
        <CompletedByStationChart data={seriesByStation} loading={loading} />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="border-slate-200 shadow-sm xl:col-span-1">
          <CardHeader>
            <CardTitle>Ranking de usuarios</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, idx) => (
                  <div key={idx} className="h-8 animate-pulse rounded bg-slate-100" />
                ))}
              </div>
            ) : seriesByUser.length === 0 ? (
              <p className="text-sm text-slate-500">Sin actividad registrada.</p>
            ) : (
              <div className="space-y-2">
                {seriesByUser.slice(0, 10).map((row, index) => (
                  <div key={`${row.responsableId || 'none'}-${index}`} className="flex items-center justify-between rounded border border-slate-200 px-3 py-2">
                    <p className="text-sm font-medium text-slate-700">
                      {index + 1}. {row.responsableNombre}
                    </p>
                    <p className="text-sm font-semibold text-slate-900">{row.tareasTerminadas.toLocaleString('es-AR')}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="xl:col-span-2">
          <CycleTrendChart data={cycleTrend} loading={loading} />
        </div>
      </div>

      <WorktablesGlobalKanban users={usuarios} groups={worktablesByUser} loading={loading} />
    </div>
  );
}
