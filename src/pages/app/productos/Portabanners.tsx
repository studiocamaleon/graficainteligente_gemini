import { useState, useMemo } from 'react';
import { Package, Plus, DollarSign } from 'lucide-react';
import { Card } from '../../../components/ui/card';
import { Button } from '../../../components/ui/Button';
import { Tabs } from '../../../components/ui/Tabs';
import { usePageHeader } from '../../../hooks/usePageHeader';
import { useAuth } from '../../../hooks/useAuth';
import { usePermissions } from '../../../hooks/usePermissions';
import { ProductosPortabannersTab } from './portabanners/ProductosPortabannersTab';
import { PreciosPortabannersTab } from './portabanners/PreciosPortabannersTab';

type TabType = 'productos' | 'precios';

export function Portabanners() {
  const [activeTab, setActiveTab] = useState<TabType>('productos');
  const [triggerCreate, setTriggerCreate] = useState(0);
  const { profile } = useAuth();
  const { canCreate } = usePermissions();

  const canCreateProduct = canCreate('productos-portabanners');

  const handleOpenCreateModal = () => {
    setTriggerCreate((prev) => prev + 1);
  };

  const headerAction = useMemo(() => {
    if (activeTab === 'productos' && canCreateProduct) {
      return (
        <Button onClick={handleOpenCreateModal}>
          <Plus className="w-4 h-4 mr-2" />
          Nuevo Producto
        </Button>
      );
    }
    return undefined;
  }, [activeTab, canCreateProduct]);

  usePageHeader('Gestiona los productos de portabanners disponibles', headerAction);

  const tabs = [
    { id: 'productos', name: 'Productos', icon: Package },
    { id: 'precios', name: 'Precios', icon: DollarSign },
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'productos':
        return <ProductosPortabannersTab triggerCreate={triggerCreate} />;
      case 'precios':
        return <PreciosPortabannersTab />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <Card padding="none">
        <Tabs
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={(tabId) => setActiveTab(tabId as TabType)}
        />
      </Card>

      <div>{renderTabContent()}</div>
    </div>
  );
}
