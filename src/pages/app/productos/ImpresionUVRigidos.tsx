import { useState, useMemo } from 'react';
import { Zap, Plus, FileDown } from 'lucide-react';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Tabs } from '../../../components/ui/Tabs';
import { usePageHeader } from '../../../hooks/usePageHeader';
import { ProductosUVTab } from './impresion-uv-rigidos/ProductosUVTab';
import { useAllProductosImpresionUVRigidosPrecios } from '../../../hooks/useAllProductosImpresionUVRigidosPrecios';
import { generateImpresionUVRigidosPDF } from '../../../utils/pdfGenerators/impresionUVRigidosPDF';

type TabType = 'productos';

export function ImpresionUVRigidos() {
  const [activeTab, setActiveTab] = useState<TabType>('productos');
  const [triggerCreate, setTriggerCreate] = useState(0);
  const [isExporting, setIsExporting] = useState(false);

  const { productos, isLoading } = useAllProductosImpresionUVRigidosPrecios();

  const handleOpenCreateModal = () => {
    setTriggerCreate((prev) => prev + 1);
  };

  const handleExportPDF = async () => {
    if (productos.length === 0) {
      alert('No hay productos para exportar');
      return;
    }

    setIsExporting(true);
    try {
      generateImpresionUVRigidosPDF(productos);
    } catch (error) {
      console.error('Error exporting PDF:', error);
      alert('Error al exportar PDF');
    } finally {
      setIsExporting(false);
    }
  };

  const headerAction = useMemo(() => {
    if (activeTab === 'productos') {
      return (
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleExportPDF}
            disabled={isExporting || isLoading || productos.length === 0}
          >
            <FileDown className="w-4 h-4 mr-2" />
            {isExporting ? 'Exportando...' : 'Exportar PDF'}
          </Button>
          <Button onClick={handleOpenCreateModal}>
            <Plus className="w-4 h-4 mr-2" />
            Nuevo Producto
          </Button>
        </div>
      );
    }
    return undefined;
  }, [activeTab, isExporting, isLoading, productos.length]);

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
