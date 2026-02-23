import { Clock3, Wifi, WifiOff } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '../ui/Button';
import { Select } from '../ui/Select';
import { Tabs } from '../ui/Tabs';
import type { DashboardPeriod, DashboardScope } from '../../types/dashboard';

export type DashboardMainTab = DashboardScope | 'entregas';

interface DashboardFiltersBarProps {
  activeTab: DashboardMainTab;
  period: DashboardPeriod;
  loading?: boolean;
  lastUpdated: Date | null;
  isRealtimeConnected: boolean;
  onTabChange: (tab: DashboardMainTab) => void;
  onPeriodChange: (period: DashboardPeriod) => void;
  onRefresh: () => void;
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
  activeTab,
  period,
  loading,
  lastUpdated,
  isRealtimeConnected,
  onTabChange,
  onPeriodChange,
  onRefresh,
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
      { id: 'entregas', label: 'Listas para entrega' },
    ],
    []
  );

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 flex-1">
          <Tabs
            tabs={tabs}
            activeTab={activeTab}
            onTabChange={(tab) => onTabChange(tab as DashboardMainTab)}
          />
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          {activeTab !== 'entregas' ? (
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
          ) : null}

          <Button variant="outline" size="sm" onClick={onRefresh} disabled={loading}>
            <Clock3 className="mr-2 h-4 w-4" />
            Actualizar
          </Button>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
        <span>{formatLastUpdated(lastUpdated)}</span>
        {activeTab !== 'entregas' ? (
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
        ) : (
          <span className="inline-flex items-center gap-1.5">
            <Clock3 className="h-3.5 w-3.5 text-slate-400" />
            Vista operativa de entregas
          </span>
        )}
      </div>
    </div>
  );
}
