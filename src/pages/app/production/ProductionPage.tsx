import { useEffect, useMemo, useState } from 'react';
import { usePageHeader } from '../../../hooks/usePageHeader';
import { Tabs } from '../../../components/ui/Tabs';
import { JobsView } from './JobsView';
import { StationsView } from './StationsView';
import { PerformanceView } from './PerformanceView';
import { useProductionJobs } from '../../../hooks/useProductionJobs';
import { useProductionStations } from '../../../hooks/useProductionStations';
import { useAuth } from '../../../hooks/useAuth';
import { Layers, Boxes, BarChart3 } from 'lucide-react';
import { Card } from '../../../components/ui/card';
import { useSearchParams } from 'react-router-dom';

type TabId = 'jobs' | 'estaciones' | 'rendimiento';

export function ProductionPage() {
  usePageHeader('Control de Producción y Seguimiento');
  const [searchParams, setSearchParams] = useSearchParams();
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin' || profile?.role === 'super_admin';

  const initialTab = (searchParams.get('tab') as TabId | null) || 'jobs';
  const [activeTab, setActiveTab] = useState<TabId>(initialTab);
  const { totalJobs } = useProductionJobs();
  const { totalActivePasos } = useProductionStations();

  useEffect(() => {
    if (!isAdmin && activeTab === 'rendimiento') {
      setActiveTab('jobs');
      const nextParams = new URLSearchParams(searchParams);
      nextParams.set('tab', 'jobs');
      setSearchParams(nextParams);
      return;
    }

    const validTabs: TabId[] = isAdmin ? ['jobs', 'estaciones', 'rendimiento'] : ['jobs', 'estaciones'];
    if (!validTabs.includes(activeTab)) {
      setActiveTab('jobs');
      const nextParams = new URLSearchParams(searchParams);
      nextParams.set('tab', 'jobs');
      setSearchParams(nextParams);
    }
  }, [activeTab, isAdmin, searchParams, setSearchParams]);

  const tabs = useMemo(() => {
    const baseTabs = [
      {
        id: 'jobs' as TabId,
        label: 'Jobs',
        icon: Layers,
        count: totalJobs,
      },
      {
        id: 'estaciones' as TabId,
        label: 'Estaciones',
        icon: Boxes,
        count: totalActivePasos,
      },
    ];

    if (isAdmin) {
      baseTabs.push({
        id: 'rendimiento' as TabId,
        label: 'Rendimiento',
        icon: BarChart3,
      });
    }

    return baseTabs;
  }, [isAdmin, totalActivePasos, totalJobs]);

  const handleTabChange = (tabId: string) => {
    const next = tabId as TabId;
    if (!isAdmin && next === 'rendimiento') {
      setActiveTab('jobs');
      const nextParams = new URLSearchParams(searchParams);
      nextParams.set('tab', 'jobs');
      setSearchParams(nextParams);
      return;
    }

    setActiveTab(next);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('tab', next);
    setSearchParams(nextParams);
  };

  return (
    <div className="space-y-6">
      <Card>
        <Tabs
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={handleTabChange}
        />

        <div className="p-6">
          {activeTab === 'jobs' && <JobsView />}

          {activeTab === 'estaciones' && <StationsView />}

          {activeTab === 'rendimiento' && isAdmin && <PerformanceView />}
        </div>
      </Card>
    </div>
  );
}
