import { useEffect, useMemo, useState, useCallback } from 'react';
import { Package, Loader2, Percent } from 'lucide-react';
import { Card } from '../../../../components/ui/Card';
import { Button } from '../../../../components/ui/Button';
import { EmptyState } from '../../../../components/ui/EmptyState';
import { ExportPDFButtonGroup } from '../../../../components/ui/ExportPDFButtonGroup';
import { ProductoTalonarioPreciosCard } from '../../../../components/productos/talonarios/ProductoTalonarioPreciosCard';
import { FloatingPreciosSaveButton } from '../../../../components/productos/talonarios/FloatingPreciosSaveButton';
import { AumentoMasivoPreciosModal } from '../../../../components/productos/shared/AumentoMasivoPreciosModal';
import { useAllProductosTalonariosPrecios } from '../../../../hooks/useAllProductosTalonariosPrecios';
import { usePDFExport } from '../../../../hooks/usePDFExport';
import { TalonariosPDFTemplate } from '../../../../components/pdf/templates/TalonariosPDFTemplate';
import { useAuth } from '../../../../hooks/useAuth';
import { useToast } from '../../../../contexts/ToastContext';

export function PreciosTalonariosTab() {
  const { profile } = useAuth();
  const { showToast } = useToast();
  const [isAumentoModalOpen, setIsAumentoModalOpen] = useState(false);

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
  } = useAllProductosTalonariosPrecios();

  const { componentRef, isGenerating, handlePrint, handleDownloadPDF } = usePDFExport({
    filename: `Lista_Precios_Impresion_Talonario_${new Date().toISOString().split('T')[0]}.pdf`,
  });

  // Preparar datos para el modal de aumento masivo
  const productosParaAumento = useMemo(() => {
    return productos
      .filter(p => {
        // Verificar que tenga al menos un precio configurado
        return p.precios && p.precios.some(precio => precio.precio > 0);
      })
      .map(p => {
        // Calcular precio promedio
        const preciosValidos = p.precios.filter(precio => precio.precio > 0);
        const precioPromedio = preciosValidos.length > 0
          ? preciosValidos.reduce((sum, precio) => sum + precio.precio, 0) / preciosValidos.length
          : 0;

        return {
          id: p.id,
          nombre: p.nombre,
          precio: Math.round(precioPromedio * 100) / 100,
          descripcion: p.descripcion || '',
        };
      });
  }, [productos]);

  const handleAumentoSuccess = useCallback(() => {
    // Refrescar datos después de aplicar aumento
    window.location.reload();
  }, []);

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
          <ProductoTalonarioPreciosCard
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
        <TalonariosPDFTemplate
          ref={componentRef}
          productos={productos}
        />
      </div>

      {isAumentoModalOpen && (
        <AumentoMasivoPreciosModal
          isOpen={isAumentoModalOpen}
          onClose={() => setIsAumentoModalOpen(false)}
          categoria="talonarios"
          productos={productosParaAumento}
          onSuccess={handleAumentoSuccess}
          showToast={showToast}
          tituloCategoria="Talonarios"
        />
      )}
    </>
  );
}
