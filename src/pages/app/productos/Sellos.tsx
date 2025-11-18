import { useState, useMemo } from 'react';
import { Package, Plus, DollarSign } from 'lucide-react';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Tabs } from '../../../components/ui/Tabs';
import { usePageHeader } from '../../../hooks/usePageHeader';
import { ProductosSellosTab } from './sellos/ProductosSellosTab';
import { PreciosSellosTab } from './sellos/PreciosSellosTab';

type TabType = 'productos' | 'precios';

export function Sellos() {
  const [activeTab, setActiveTab] = useState<TabType>('productos');
  const [triggerCreate, setTriggerCreate] = useState(0);

  const handleOpenCreateModal = () => {
    setTriggerCreate((prev) => prev + 1);
  };

  const headerAction = useMemo(() => {
    if (activeTab === 'productos') {
      return (
        <Button onClick={handleOpenCreateModal}>
          <Plus className="w-4 h-4 mr-2" />
          Nuevo Producto
        </Button>
      );
    }
    return undefined;
  }, [activeTab]);

  usePageHeader('Gestiona los productos de sellos y accesorios disponibles', headerAction);

  const tabs = [
    { id: 'productos', name: 'Productos', icon: Package },
    { id: 'precios', name: 'Precios', icon: DollarSign },
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'productos':
        return <ProductosSellosTab triggerCreate={triggerCreate} />;
      case 'precios':
        return <PreciosSellosTab />;
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
