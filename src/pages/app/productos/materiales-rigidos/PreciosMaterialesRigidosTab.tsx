import { useEffect, useMemo } from 'react';
import { Package, Loader2 } from 'lucide-react';
import { Card } from '../../../../components/ui/Card';
import { EmptyState } from '../../../../components/ui/EmptyState';
import { ExportPDFButtonGroup } from '../../../../components/ui/ExportPDFButtonGroup';
import { MaterialesRigidosPreciosTable } from '../../../../components/productos/materiales-rigidos/MaterialesRigidosPreciosTable';
import { FloatingPreciosSaveButton } from '../../../../components/productos/impresion-laser/FloatingPreciosSaveButton';
import { useAllProductosMaterialesRigidosPrecios } from '../../../../hooks/useAllProductosMaterialesRigidosPrecios';
import { useMaterialesRigidosExport } from '../../../../hooks/useMaterialesRigidosExport';
import { useAuth } from '../../../../hooks/useAuth';

export function PreciosMaterialesRigidosTab() {
  const { profile } = useAuth();
  const canEditPrecios = useMemo(() => {
    return !['operador_diseno', 'operador_taller'].includes(profile?.role || '');
  }, [profile?.role]);

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

  /* Export Logic */
  const { handleExport, isExporting } = useMaterialesRigidosExport();

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

  return (
    <>
      <div className="space-y-6 pb-24">
        <div className="flex justify-end gap-3">
          <ExportPDFButtonGroup
            onPrint={() => { }} // Direct download preferred
            onDownload={() => handleExport(productosAgrupados)}
            isGenerating={isExporting}
            label="Exportar"
            showPrint={false}
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
              readonly={!canEditPrecios}
            />
          );
        })}

        {canEditPrecios && (
          <FloatingPreciosSaveButton
            hasChanges={hasUnsavedChanges()}
            onSave={saveAllPrecios}
            isSaving={isSaving}
          />
        )}
      </div>


    </>
  );
}
