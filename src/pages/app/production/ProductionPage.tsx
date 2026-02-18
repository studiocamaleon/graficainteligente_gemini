import { useState } from 'react';
import { usePageHeader } from '../../../hooks/usePageHeader';
import { Tabs } from '../../../components/ui/Tabs';
import { JobsView } from './JobsView';
import { StationsView } from './StationsView';
import { useProductionJobs } from '../../../hooks/useProductionJobs';
import { useProductionStations } from '../../../hooks/useProductionStations';
import { Layers, Boxes } from 'lucide-react';
import { Card } from '../../../components/ui/card';

type TabId = 'jobs' | 'estaciones';

export function ProductionPage() {
  usePageHeader('Control de Producción y Seguimiento');
  const [activeTab, setActiveTab] = useState<TabId>('jobs');
  const { totalJobs } = useProductionJobs();
  const { totalActivePasos } = useProductionStations();

  const allTabs = [
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

  const tabs = allTabs;

  return (
    <div className="space-y-6">
      <Card padding="none">
        <Tabs
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={(tabId) => setActiveTab(tabId as TabId)}
        />

        <div className="p-6">
          {activeTab === 'jobs' && <JobsView />}

          {activeTab === 'estaciones' && <StationsView />}
        </div>
      </Card>
    </div>
  );
}
