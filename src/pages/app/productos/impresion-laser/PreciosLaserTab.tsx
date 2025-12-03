import { useEffect, useMemo, useState, useCallback } from 'react';
import { Package, Loader2, Percent } from 'lucide-react';
import { Card } from '../../../../components/ui/Card';
import { Button } from '../../../../components/ui/Button';
import { EmptyState } from '../../../../components/ui/EmptyState';
import { ExportPDFButtonGroup } from '../../../../components/ui/ExportPDFButtonGroup';
import { ProductoLaserPreciosCard } from '../../../../components/productos/impresion-laser/ProductoLaserPreciosCard';
import { FloatingPreciosSaveButton } from '../../../../components/productos/impresion-laser/FloatingPreciosSaveButton';
import { AumentoMasivoPreciosModal } from '../../../../components/productos/shared/AumentoMasivoPreciosModal';
import { useAllProductosLaserPrecios } from '../../../../hooks/useAllProductosLaserPrecios';
import { usePDFExport } from '../../../../hooks/usePDFExport';
import { ImpresionLaserPDFTemplate } from '../../../../components/pdf/templates/ImpresionLaserPDFTemplate';
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

  // Preparar datos para el modal de aumento masivo
  const productosParaAumento = useMemo(() => {
    return productos.map(producto => {
      // Calcular precio promedio de todas las configuraciones (incluidos precios en 0)
      let precioPromedio = 0;
      if (producto.preciosExistentes && producto.preciosExistentes.length > 0) {
        precioPromedio = producto.preciosExistentes.reduce((sum, p) => sum + (p.precio || 0), 0) / producto.preciosExistentes.length;
      }
      return {
        id: producto.id,
        nombre: producto.nombre,
        precio: Math.round(precioPromedio * 100) / 100,
        isActive: true,
      };
    });
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
            onPrint={handlePrint}
            onDownload={handleDownloadPDF}
            isGenerating={isGenerating}
            label="Exportar"
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

      <div
        style={{
          position: 'absolute',
          left: '-9999px',
          top: '0',
          width: '210mm',
          minHeight: '297mm'
        }}
      >
        <ImpresionLaserPDFTemplate
          ref={componentRef}
          productos={productos}
        />
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
