import { Clock3, Wifi, WifiOff } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '../ui/Button';
import { Select } from '../ui/Select';
import { Tabs } from '../ui/Tabs';
import type { DashboardPeriod, DashboardScope } from '../../types/dashboard';

interface DashboardFiltersBarProps {
  scope: DashboardScope;
  period: DashboardPeriod;
  loading?: boolean;
  lastUpdated: Date | null;
  isRealtimeConnected: boolean;
  onScopeChange: (scope: DashboardScope) => void;
  onPeriodChange: (period: DashboardPeriod) => void;
  onRefresh: () => void;
  onOpenPendingDeliveries?: () => void;
}

function formatLastUpdated(date: Date | null): string {
  if (!date) return 'Sin actualizar';
  const diffSec = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (diffSec < 5) return 'Actualizado recién';
  if (diffSec < 60) return `Actualizado hace ${diffSec}s`;
  const mins = Math.floor(diffSec / 60);
  return `Actualizado hace ${mins}m`;
}

export function DashboardFiltersBar({
  scope,
  period,
  loading,
  lastUpdated,
  isRealtimeConnected,
  onScopeChange,
  onPeriodChange,
  onRefresh,
  onOpenPendingDeliveries,
}: DashboardFiltersBarProps) {
  const [, setTicker] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTicker((x) => x + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const tabs = useMemo(
    () => [
      { id: 'ot', label: 'Órdenes de Trabajo' },
      { id: 'copiado', label: 'Centro de Copiado' },
    ],
    []
  );

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 flex-1">
          <Tabs
            tabs={tabs}
            activeTab={scope}
            onTabChange={(tab) => onScopeChange(tab as DashboardScope)}
          />
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="min-w-[170px]">
            <Select
              value={period}
              onChange={(value) => onPeriodChange(value as DashboardPeriod)}
              options={[
                { value: '7d', label: 'Últimos 7 días' },
                { value: '30d', label: 'Últimos 30 días' },
                { value: '90d', label: 'Últimos 90 días' },
                { value: 'mes_actual', label: 'Mes actual' },
              ]}
            />
          </div>

          {onOpenPendingDeliveries ? (
            <Button variant="outline" size="sm" onClick={onOpenPendingDeliveries}>
              Gestionar entregas
            </Button>
          ) : null}

          <Button variant="outline" size="sm" onClick={onRefresh} disabled={loading}>
            <Clock3 className="mr-2 h-4 w-4" />
            Actualizar
          </Button>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
        <span>{formatLastUpdated(lastUpdated)}</span>
        <span className="inline-flex items-center gap-1.5">
          {isRealtimeConnected ? (
            <>
              <Wifi className="h-3.5 w-3.5 text-emerald-600" />
              Tiempo real conectado
            </>
          ) : (
            <>
              <WifiOff className="h-3.5 w-3.5 text-amber-600" />
              Tiempo real reconectando
            </>
          )}
        </span>
      </div>
    </div>
  );
}
