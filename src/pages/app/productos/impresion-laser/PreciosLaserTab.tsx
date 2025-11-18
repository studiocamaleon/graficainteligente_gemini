import { useEffect } from 'react';
import { Package, Loader2 } from 'lucide-react';
import { Card } from '../../../../components/ui/Card';
import { EmptyState } from '../../../../components/ui/EmptyState';
import { ExportPDFButtonGroup } from '../../../../components/ui/ExportPDFButtonGroup';
import { ProductoLaserPreciosCard } from '../../../../components/productos/impresion-laser/ProductoLaserPreciosCard';
import { FloatingPreciosSaveButton } from '../../../../components/productos/impresion-laser/FloatingPreciosSaveButton';
import { useAllProductosLaserPrecios } from '../../../../hooks/useAllProductosLaserPrecios';
import { usePDFExport } from '../../../../hooks/usePDFExport';
import { ImpresionLaserPDFTemplate } from '../../../../components/pdf/templates/ImpresionLaserPDFTemplate';

export function PreciosLaserTab() {
  const {
    productos,
    isLoading,
    isSaving,
    error,
    updatePreciosForProducto,
    saveAllPrecios,
    getPreciosModificadosCount,
    hasUnsavedChanges,
  } = useAllProductosLaserPrecios();

  const { componentRef, isGenerating, handlePrint, handleDownloadPDF } = usePDFExport({
    filename: `Lista_Precios_Impresion_Laser_${new Date().toISOString().split('T')[0]}.pdf`,
  });

  // Warn user before leaving with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges()) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  if (isLoading) {
    return (
      <Card>
        <div className="p-12 flex flex-col items-center justify-center">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-4" />
          <p className="text-sm text-gray-500">Cargando productos...</p>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <div className="p-12">
          <EmptyState
            icon={Package}
            title="Error al cargar productos"
            description={error}
          />
        </div>
      </Card>
    );
  }

  if (productos.length === 0) {
    return (
      <Card>
        <div className="p-12">
          <EmptyState
            icon={Package}
            title="No hay productos de impresión láser"
            description="Crea productos de impresión láser en la pestaña Productos para comenzar a configurar sus precios."
          />
        </div>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-6 pb-24">
        <div className="flex justify-end">
          <ExportPDFButtonGroup
            onPrint={handlePrint}
            onDownload={handleDownloadPDF}
            isGenerating={isGenerating}
            label="Exportar Lista de Precios"
          />
        </div>

        {productos.map((producto) => (
          <ProductoLaserPreciosCard
            key={producto.id}
            producto={producto}
            onPreciosChange={updatePreciosForProducto}
          />
        ))}

        <FloatingPreciosSaveButton
          hasChanges={hasUnsavedChanges()}
          onSave={saveAllPrecios}
          isSaving={isSaving}
        />
      </div>

      <div className="hidden">
        <ImpresionLaserPDFTemplate
          ref={componentRef}
          productos={productos}
        />
      </div>
    </>
  );
}
