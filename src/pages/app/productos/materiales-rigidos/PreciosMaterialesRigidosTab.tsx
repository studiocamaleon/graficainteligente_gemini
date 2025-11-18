import { useEffect } from 'react';
import { Package, Loader2 } from 'lucide-react';
import { Card } from '../../../../components/ui/Card';
import { EmptyState } from '../../../../components/ui/EmptyState';
import { ExportPDFButton } from '../../../../components/ui/ExportPDFButton';
import { MaterialesRigidosPreciosTable } from '../../../../components/productos/materiales-rigidos/MaterialesRigidosPreciosTable';
import { FloatingPreciosSaveButton } from '../../../../components/productos/impresion-laser/FloatingPreciosSaveButton';
import { useAllProductosMaterialesRigidosPrecios } from '../../../../hooks/useAllProductosMaterialesRigidosPrecios';
import { generateMaterialesRigidosReactPDF } from '../../../../utils/pdfGenerators/materialesRigidosReactPDF';

export function PreciosMaterialesRigidosTab() {
  const {
    productosAgrupados,
    preciosModificados,
    isLoading,
    isSaving,
    error,
    updatePrecioForProducto,
    saveAllPrecios,
    getPreciosModificadosCount,
    hasUnsavedChanges,
    calcularM2Placa,
    calcularPrecioM2,
  } = useAllProductosMaterialesRigidosPrecios();

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

  const materialesIds = Object.keys(productosAgrupados);

  if (materialesIds.length === 0) {
    return (
      <Card>
        <div className="p-12">
          <EmptyState
            icon={Package}
            title="No hay productos de materiales rígidos"
            description="Crea productos de materiales rígidos en la pestaña Productos para comenzar a configurar sus precios."
          />
        </div>
      </Card>
    );
  }

  const productosModificadosSet = new Set(Object.keys(preciosModificados));

  const handleExportPDF = async () => {
    await generateMaterialesRigidosReactPDF(productosAgrupados);
  };

  return (
    <div className="space-y-6 pb-24">
      <div className="flex justify-end">
        <ExportPDFButton
          onExport={handleExportPDF}
          label="Exportar Lista de Precios"
        />
      </div>

      {materialesIds.map((materialId) => {
        const grupo = productosAgrupados[materialId];
        return (
          <MaterialesRigidosPreciosTable
            key={materialId}
            materialId={materialId}
            materialNombre={grupo.material_nombre}
            productos={grupo.productos}
            calcularM2Placa={calcularM2Placa}
            calcularPrecioM2={calcularPrecioM2}
            onPrecioChange={updatePrecioForProducto}
            productosModificados={productosModificadosSet}
          />
        );
      })}

      <FloatingPreciosSaveButton
        hasChanges={hasUnsavedChanges()}
        onSave={saveAllPrecios}
        isSaving={isSaving}
      />
    </div>
  );
}
