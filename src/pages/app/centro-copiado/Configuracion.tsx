import { useState, useMemo } from 'react';
import { Settings2, FileText } from 'lucide-react';
import { Card } from '../../../components/ui/Card';
import { Tabs } from '../../../components/ui/Tabs';
import { usePageHeader } from '../../../hooks/usePageHeader';
import { EmptyState } from '../../../components/ui/EmptyState';

type TabType = 'tamanios' | 'papeles';

export function Configuracion() {
  const [activeTab, setActiveTab] = useState<TabType>('tamanios');

  usePageHeader('Configura los tamaños de papel y tipos de papel disponibles para el centro de copiado');

  const tabs = [
    { id: 'tamanios', name: 'Tamaños de Papel', icon: FileText },
    { id: 'papeles', name: 'Tipos de Papel', icon: Settings2 },
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'tamanios':
        return (
          <Card>
            <div className="p-12">
              <EmptyState
                icon={FileText}
                title="Gestión de Tamaños de Papel"
                description="Aquí podrás configurar los tamaños de papel disponibles (A4, SRA3, etc.). Funcionalidad en desarrollo."
              />
            </div>
          </Card>
        );
      case 'papeles':
        return (
          <Card>
            <div className="p-12">
              <EmptyState
                icon={Settings2}
                title="Gestión de Tipos de Papel"
                description="Aquí podrás seleccionar los tipos de papel disponibles desde tus materiales. Funcionalidad en desarrollo."
              />
            </div>
          </Card>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <Card padding="none">
        <Tabs tabs={tabs} activeTab={activeTab} onTabChange={(tabId) => setActiveTab(tabId as TabType)} />
      </Card>

      <div>{renderTabContent()}</div>
    </div>
  );
}
