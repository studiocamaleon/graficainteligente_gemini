import { useState, useMemo } from 'react';
import { usePageHeader } from '../../../hooks/usePageHeader';
import { Tabs } from '../../../components/ui/Tabs';
import { JobsView } from './JobsView';
import { StationsView } from './StationsView';
import { ProductivityView } from './ProductivityView';
import { ActivityView } from './ActivityView';
import { PausasView } from './PausasView';
import { useProductionJobs } from '../../../hooks/useProductionJobs';
import { useProductionStations } from '../../../hooks/useProductionStations';
import { Layers, Boxes, Activity, TrendingUp, Pause } from 'lucide-react';
import { Card } from '../../../components/ui/card';
import { useAuth } from '../../../hooks/useAuth';

type TabId = 'jobs' | 'estaciones' | 'productividad' | 'actividad' | 'pausas';

export function ProductionPage() {
  usePageHeader('Control de Producción y Seguimiento');
  const [activeTab, setActiveTab] = useState<TabId>('jobs');
  const { profile } = useAuth();
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
    {
      id: 'pausas' as TabId,
      label: 'Pausas',
      icon: Pause,
    },
  ];

  const tabs = useMemo(() => {
    const allowedRoles = ['super_admin', 'admin', 'manager'];
    if (profile?.role && allowedRoles.includes(profile.role)) {
      return allTabs;
    }
    // operador_diseno y operador_taller solo ven jobs y estaciones
    return allTabs.filter(tab => ['jobs', 'estaciones'].includes(tab.id));
  }, [profile?.role, totalJobs, totalActivePasos]);

  const canAccessTab = (tabId: TabId): boolean => {
    const allowedRoles = ['super_admin', 'admin', 'manager'];
    return profile?.role ? allowedRoles.includes(profile.role) : false;
  };

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

          {activeTab === 'productividad' && canAccessTab('productividad') && <ProductivityView />}

          {activeTab === 'actividad' && canAccessTab('actividad') && <ActivityView />}

          {activeTab === 'pausas' && canAccessTab('pausas') && <PausasView />}
        </div>
      </Card>
    </div>
  );
}
