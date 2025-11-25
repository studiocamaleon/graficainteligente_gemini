import { useState } from 'react';
import { usePageHeader } from '../../../hooks/usePageHeader';
import { Tabs } from '../../../components/ui/Tabs';
import { JobsView } from './JobsView';
import { StationsView } from './StationsView';
import { ProductivityView } from './ProductivityView';
import { ActivityView } from './ActivityView';
import { useProductionJobs } from '../../../hooks/useProductionJobs';
import { useProductionStations } from '../../../hooks/useProductionStations';
import { Layers, Boxes, Activity, TrendingUp } from 'lucide-react';
import { Card } from '../../../components/ui/Card';

type TabId = 'jobs' | 'estaciones' | 'productividad' | 'actividad';

export function ProductionPage() {
  usePageHeader('Control de Producción y Seguimiento');
  const [activeTab, setActiveTab] = useState<TabId>('jobs');
  const { totalJobs } = useProductionJobs();
  const { totalActivePasos } = useProductionStations();

  const tabs = [
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
    {
      id: 'productividad' as TabId,
      label: 'Productividad',
      icon: TrendingUp,
    },
    {
      id: 'actividad' as TabId,
      label: 'Actividad',
      icon: Activity,
    },
  ];

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

          {activeTab === 'productividad' && <ProductivityView />}

          {activeTab === 'actividad' && <ActivityView />}
        </div>
      </Card>
    </div>
  );
}
