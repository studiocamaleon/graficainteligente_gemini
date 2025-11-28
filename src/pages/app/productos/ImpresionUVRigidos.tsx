import { useState, useMemo } from 'react';
import { Zap, Plus } from 'lucide-react';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Tabs } from '../../../components/ui/Tabs';
import { usePageHeader } from '../../../hooks/usePageHeader';
import { ProductosUVTab } from './impresion-uv-rigidos/ProductosUVTab';

type TabType = 'productos';

export function ImpresionUVRigidos() {
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

  usePageHeader('Gestiona productos de Impresión UV sobre materiales rígidos', headerAction);

  const tabs = [
    { id: 'productos', name: 'Productos', icon: Zap },
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'productos':
        return <ProductosUVTab triggerCreate={triggerCreate} />;
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
