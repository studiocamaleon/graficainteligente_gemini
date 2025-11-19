import { useState } from 'react';
import { DollarSign, Palette } from 'lucide-react';
import { Card } from '../../../components/ui/Card';
import { Tabs } from '../../../components/ui/Tabs';
import { usePageHeader } from '../../../hooks/usePageHeader';
import { EmptyState } from '../../../components/ui/EmptyState';

type TabType = 'cmyk' | 'bn';

export function Precios() {
  const [activeTab, setActiveTab] = useState<TabType>('cmyk');

  usePageHeader('Gestiona los precios de impresión por tipo de tinta, tamaño y papel');

  const tabs = [
    { id: 'cmyk', name: 'Impresión CMYK', icon: Palette },
    { id: 'bn', name: 'Blanco y Negro', icon: DollarSign },
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'cmyk':
        return (
          <Card>
            <div className="p-12">
              <EmptyState
                icon={Palette}
                title="Precios de Impresión CMYK"
                description="Aquí podrás configurar los precios de impresión a color para cada tamaño de papel, tipo de papel y rango de cantidad. Funcionalidad en desarrollo."
              />
            </div>
          </Card>
        );
      case 'bn':
        return (
          <Card>
            <div className="p-12">
              <EmptyState
                icon={DollarSign}
                title="Precios de Impresión Blanco y Negro"
                description="Aquí podrás configurar los precios de impresión en blanco y negro para cada tamaño de papel, tipo de papel y rango de cantidad. Funcionalidad en desarrollo."
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
