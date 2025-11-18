import { useState } from 'react';
import { Package, Plus, DollarSign } from 'lucide-react';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Tabs } from '../../../components/ui/Tabs';
import { usePageHeader } from '../../../hooks/usePageHeader';
import { ProductosMaterialesRigidosTab } from './materiales-rigidos/ProductosMaterialesRigidosTab';
import { PreciosMaterialesRigidosTab } from './materiales-rigidos/PreciosMaterialesRigidosTab';

type TabType = 'productos' | 'precios';

export function MaterialesRigidos() {
  const [activeTab, setActiveTab] = useState<TabType>('productos');
  const [triggerCreate, setTriggerCreate] = useState(0);

  const handleOpenCreateModal = () => {
    setTriggerCreate((prev) => prev + 1);
  };

  usePageHeader(
    'Gestiona los productos de materiales rígidos disponibles',
    activeTab === 'productos' ? (
      <Button onClick={handleOpenCreateModal}>
        <Plus className="w-4 h-4 mr-2" />
        Nuevo Producto
      </Button>
    ) : undefined
  );

  const tabs = [
    { id: 'productos', name: 'Productos', icon: Package },
    { id: 'precios', name: 'Precios', icon: DollarSign },
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'productos':
        return <ProductosMaterialesRigidosTab triggerCreate={triggerCreate} />;
      case 'precios':
        return <PreciosMaterialesRigidosTab />;
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
