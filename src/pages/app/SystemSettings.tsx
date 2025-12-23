import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Wrench, Pause, Building } from 'lucide-react';
import { Card } from '../../components/ui/card';
import { Tabs } from '../../components/ui/Tabs';
import { EmptyState } from '../../components/ui/EmptyState';
import { usePageHeader } from '../../hooks/usePageHeader';
import { MotivosPausaList } from '../../components/pausas/MotivosPausaList';

type TabId = 'general' | 'pausas';

export function SystemSettings() {
  usePageHeader('Configuración del Sistema');
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<TabId>('general');

  useEffect(() => {
    if (location.pathname.includes('/pausas')) {
      setActiveTab('pausas');
    } else {
      setActiveTab('general');
    }
  }, [location.pathname]);

  const tabs = [
    {
      id: 'general' as TabId,
      label: 'General',
      icon: Building,
    },
    {
      id: 'pausas' as TabId,
      label: 'Motivos de Pausa',
      icon: Pause,
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
          {activeTab === 'general' && (
            <EmptyState
              icon={Wrench}
              title="Configuración General"
              description="Aquí podrás personalizar la configuración general de tu cuenta"
            />
          )}

          {activeTab === 'pausas' && <MotivosPausaList />}
        </div>
      </Card>
    </div>
  );
}
