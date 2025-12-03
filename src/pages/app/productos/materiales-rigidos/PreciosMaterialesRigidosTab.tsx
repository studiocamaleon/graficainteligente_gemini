import { useEffect, useMemo, useState, useCallback } from 'react';
import { Package, Loader2, Percent } from 'lucide-react';
import { Card } from '../../../../components/ui/Card';
import { Button } from '../../../../components/ui/Button';
import { EmptyState } from '../../../../components/ui/EmptyState';
import { ExportPDFButtonGroup } from '../../../../components/ui/ExportPDFButtonGroup';
import { MaterialesRigidosPreciosTable } from '../../../../components/productos/materiales-rigidos/MaterialesRigidosPreciosTable';
import { FloatingPreciosSaveButton } from '../../../../components/productos/impresion-laser/FloatingPreciosSaveButton';
import { AumentoMasivoPreciosModal } from '../../../../components/productos/shared/AumentoMasivoPreciosModal';
import { useAllProductosMaterialesRigidosPrecios } from '../../../../hooks/useAllProductosMaterialesRigidosPrecios';
import { usePDFExport } from '../../../../hooks/usePDFExport';
import { MaterialesRigidosPDFTemplate } from '../../../../components/pdf/templates/MaterialesRigidosPDFTemplate';
import { useAuth } from '../../../../hooks/useAuth';
import { useToast } from '../../../../contexts/ToastContext';

export function PreciosMaterialesRigidosTab() {
  const { profile } = useAuth();
  const { showToast } = useToast();
  const [isAumentoModalOpen, setIsAumentoModalOpen] = useState(false);
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

  const { componentRef, isGenerating, handlePrint, handleDownloadPDF } = usePDFExport({
    filename: `Lista_Precios_Materiales_Rigidos_${new Date().toISOString().split('T')[0]}.pdf`,
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
    const productosConPrecios = Object.values(productosAgrupados)
      .flat()
      .filter(p => p.precio_actual && p.precio_actual.precio_placa > 0);

    // Agrupar por producto único
    const productosMap = new Map<string, { nombre: string; precioSum: number; count: number }>();

    productosConPrecios.forEach(p => {
      const key = p.producto_materiales_rigidos_id;
      if (!productosMap.has(key)) {
        productosMap.set(key, { nombre: p.nombre, precioSum: 0, count: 0 });
      }
      const prod = productosMap.get(key)!;
      prod.precioSum += p.precio_actual!.precio_placa;
      prod.count += 1;
    });

    return Array.from(productosMap.entries()).map(([id, data]) => ({
      id,
      nombre: data.nombre,
      precio: Math.round((data.precioSum / data.count) * 100) / 100,
      isActive: true,
    }));
  }, [productosAgrupados]);

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
          {canEditPrecios && productosParaAumento.length > 0 && (
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

      <div
        style={{
          position: 'absolute',
          left: '-9999px',
          top: '0',
          width: '210mm',
          minHeight: '297mm'
        }}
      >
        <MaterialesRigidosPDFTemplate
          ref={componentRef}
          productosAgrupados={productosAgrupados}
        />
      </div>

      {isAumentoModalOpen && (
        <AumentoMasivoPreciosModal
          isOpen={isAumentoModalOpen}
          onClose={() => setIsAumentoModalOpen(false)}
          categoria="materiales_rigidos"
          productos={productosParaAumento}
          onSuccess={handleAumentoSuccess}
          showToast={showToast}
          tituloCategoria="Materiales Rígidos"
        />
      )}
    </>
  );
}
