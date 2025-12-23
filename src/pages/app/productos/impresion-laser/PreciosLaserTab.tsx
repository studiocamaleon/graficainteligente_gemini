import { useEffect, useMemo, useState, useCallback } from 'react';
import { Package, Loader2, Percent } from 'lucide-react';
import { Card } from '../../../../components/ui/card';
import { Button } from '../../../../components/ui/Button';
import { EmptyState } from '../../../../components/ui/EmptyState';
import { ExportPDFButtonGroup } from '../../../../components/ui/ExportPDFButtonGroup';
import { ProductoLaserPreciosCard } from '../../../../components/productos/impresion-laser/ProductoLaserPreciosCard';
import { FloatingPreciosSaveButton } from '../../../../components/productos/impresion-laser/FloatingPreciosSaveButton';
import { AumentoMasivoPreciosModal } from '../../../../components/productos/shared/AumentoMasivoPreciosModal';
import { useAllProductosLaserPrecios } from '../../../../hooks/useAllProductosLaserPrecios';
import { useLaserExport } from '../../../../hooks/useLaserExport';
import { useAuth } from '../../../../hooks/useAuth';
import { useToast } from '../../../../contexts/ToastContext';

export function PreciosLaserTab() {
  const { profile } = useAuth();
  const { showToast } = useToast();
  const canEditPrecios = useMemo(() => {
    return !['operador_diseno', 'operador_taller'].includes(profile?.role || '');
  }, [profile?.role]);

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

  const [isAumentoModalOpen, setIsAumentoModalOpen] = useState(false);

  /* Export Logic */
  const { handleExport, isExporting } = useLaserExport();

  const handlePrecioChange = useCallback(
    (productoId: string, precios: PrecioInput[]) => {
      updatePreciosForProducto(productoId, precios);
    },
    [updatePreciosForProducto]
  );

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

  // Preparar datos para el modal de aumento masivo
  const productosParaAumento = useMemo(() => {
    return productos
      .map(producto => {
        // Calcular precio promedio SOLO de configuraciones con precio > 0
        let precioPromedio = 0;
        if (producto.precios_existentes && producto.precios_existentes.length > 0) {
          const preciosValidos = producto.precios_existentes.filter(p => (p.precio || 0) > 0);
          if (preciosValidos.length > 0) {
            precioPromedio = preciosValidos.reduce((sum, p) => sum + (p.precio || 0), 0) / preciosValidos.length;
          }
        }
        return {
          id: producto.id,
          nombre: producto.nombre,
          precio: Math.round(precioPromedio * 100) / 100,
          isActive: true,
        };
      })
      .filter(p => p.precio > 0); // Retornar solo productos con precios configurados
  }, [productos]);

  const handleAumentoSuccess = useCallback(async () => {
    window.location.reload();
  }, []);

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
        <div className="flex justify-end gap-3">
          {canEditPrecios && productos.length > 0 && (
            <Button
              variant="secondary"
              onClick={() => setIsAumentoModalOpen(true)}
            >
              <Percent className="w-4 h-4 mr-2" />
              Aumento Masivo
            </Button>
          )}
          <ExportPDFButtonGroup
            onPrint={() => { }} // Direct download preferred
            onDownload={() => handleExport(productos)}
            isGenerating={isExporting}
            label="Exportar"
            showPrint={false}
          />
        </div>

        {productos.map((producto) => (
          <ProductoLaserPreciosCard
            key={producto.id}
            producto={producto}
            onPreciosChange={updatePreciosForProducto}
            readonly={!canEditPrecios}
          />
        ))}

        {canEditPrecios && (
          <FloatingPreciosSaveButton
            hasChanges={hasUnsavedChanges()}
            onSave={saveAllPrecios}
            isSaving={isSaving}
          />
        )}
      </div>

      {isAumentoModalOpen && (
        <AumentoMasivoPreciosModal
          isOpen={isAumentoModalOpen}
          onClose={() => setIsAumentoModalOpen(false)}
          categoria="impresion_laser"
          productos={productosParaAumento}
          onSuccess={handleAumentoSuccess}
          showToast={showToast}
          tituloCategoria="Impresión Láser"
        />
      )}
    </>
  );
}
