import { useState } from 'react';
import { usePageHeader } from '../../../hooks/usePageHeader';
import { Tabs } from '../../../components/ui/Tabs';
import { JobsView } from './JobsView';
import { useProductionJobs } from '../../../hooks/useProductionJobs';
import { Layers, Calendar, Boxes, BarChart3 } from 'lucide-react';
import { Card } from '../../../components/ui/Card';
import { EmptyState } from '../../../components/ui/EmptyState';

type TabId = 'jobs' | 'planificacion' | 'estaciones' | 'reportes';

export function ProductionPage() {
  usePageHeader('Control de Producción y Seguimiento');
  const [activeTab, setActiveTab] = useState<TabId>('jobs');
  const { totalJobs } = useProductionJobs();

  const tabs = [
    {
      id: 'jobs' as TabId,
      label: 'Jobs',
      icon: Layers,
      count: totalJobs,
    },
    {
      id: 'planificacion' as TabId,
      label: 'Planificación',
      icon: Calendar,
      disabled: true,
    },
    {
      id: 'estaciones' as TabId,
      label: 'Estaciones',
      icon: Boxes,
      disabled: true,
    },
    {
      id: 'reportes' as TabId,
      label: 'Reportes',
      icon: BarChart3,
      disabled: true,
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

          {activeTab === 'planificacion' && (
            <EmptyState
              icon={Calendar}
              title="Planificación"
              description="Vista de planificación en desarrollo"
            />
          )}

          {activeTab === 'estaciones' && (
            <EmptyState
              icon={Boxes}
              title="Estaciones"
              description="Control de estaciones de trabajo en desarrollo"
            />
          )}

          {activeTab === 'reportes' && (
            <EmptyState
              icon={BarChart3}
              title="Reportes"
              description="Reportes de producción en desarrollo"
            />
          )}
        </div>
      </Card>
    </div>
  );
}
