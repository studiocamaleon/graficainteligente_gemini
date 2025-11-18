import { useState, useEffect, useCallback } from 'react';
import { Package, Loader2 } from 'lucide-react';
import { Card } from '../../../../components/ui/Card';
import { EmptyState } from '../../../../components/ui/EmptyState';
import { ExportPDFButtonGroup } from '../../../../components/ui/ExportPDFButtonGroup';
import { PlotterCorteMatrizPrecios } from '../../../../components/productos/plotter-corte/PlotterCorteMatrizPrecios';
import { FloatingPreciosSaveButton } from '../../../../components/productos/impresion-laser/FloatingPreciosSaveButton';
import { useAllProductosPlotterCortePrecios } from '../../../../hooks/useAllProductosPlotterCortePrecios';
import type { PrecioPCInput } from '../../../../hooks/useAllProductosPlotterCortePrecios';
import { usePDFExport } from '../../../../hooks/usePDFExport';
import { PlotterCortePDFTemplate } from '../../../../components/pdf/templates/PlotterCortePDFTemplate';

interface PreciosSnapshot {
  [key: string]: number;
}

const createPrecioKey = (precio: PrecioPCInput): string => {
  return `${precio.producto_id}-${precio.ancho}-${precio.cantidad_desde}-${precio.cantidad_hasta}`;
};

export function PreciosPlotterCorteTab() {
  const { productosPorAncho, isLoading, isSaving, error, saveAllPrecios } =
    useAllProductosPlotterCortePrecios();

  const [preciosActuales, setPreciosActuales] = useState<PrecioPCInput[]>([]);
  const [preciosSnapshot, setPreciosSnapshot] = useState<PreciosSnapshot>({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const { componentRef, isGenerating, handlePrint, handleDownloadPDF } = usePDFExport({
    filename: `Lista_Precios_Plotter_Corte_${new Date().toISOString().split('T')[0]}.pdf`,
  });

  useEffect(() => {
    if (productosPorAncho.length > 0) {
      const snapshot: PreciosSnapshot = {};
      productosPorAncho.forEach(item => {
        if (item.precios) {
          item.precios.forEach((precio, rangoKey) => {
            const [min, max] = rangoKey.split('-').map(Number);
            const key = createPrecioKey({
              producto_id: item.producto_id,
              ancho: item.ancho,
              cantidad_desde: min,
              cantidad_hasta: max,
              precio,
            });
            snapshot[key] = precio;
          });
        }
      });
      setPreciosSnapshot(snapshot);
    }
  }, [productosPorAncho]);

  const handlePreciosChange = useCallback((precios: PrecioPCInput[]) => {
    setPreciosActuales(precios);

    const hasChanges = precios.some(precio => {
      const key = createPrecioKey(precio);
      const snapshotPrecio = preciosSnapshot[key];
      return snapshotPrecio === undefined || snapshotPrecio !== precio.precio;
    });

    setHasUnsavedChanges(hasChanges);
  }, [preciosSnapshot]);

  const handleSave = useCallback(async () => {
    try {
      await saveAllPrecios(preciosActuales);

      const newSnapshot: PreciosSnapshot = {};
      preciosActuales.forEach(precio => {
        const key = createPrecioKey(precio);
        newSnapshot[key] = precio.precio;
      });
      setPreciosSnapshot(newSnapshot);
      setHasUnsavedChanges(false);
      setPreciosActuales([]);
    } catch (err) {
      console.error('Error guardando precios:', err);
    }
  }, [preciosActuales, saveAllPrecios]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
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
          <Loader2 className="w-8 h-8 text-pink-600 animate-spin mb-4" />
          <p className="text-sm text-gray-500">Cargando productos...</p>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <div className="p-12">
          <EmptyState icon={Package} title="Error al cargar productos" description={error} />
        </div>
      </Card>
    );
  }

  if (productosPorAncho.length === 0) {
    return (
      <Card>
        <div className="p-12">
          <EmptyState
            icon={Package}
            title="No hay productos de plotter de corte"
            description="Crea productos de plotter de corte en la pestaña Productos y asígnales rangos de precio para comenzar a configurar sus precios."
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

        <Card>
          <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Configuración de Precios por Ancho y Rango
            </h3>
            <p className="text-sm text-gray-600 mb-6">
              Configure los precios para cada combinación de producto y ancho según los rangos de
              cantidad en metros lineales.
            </p>
            <PlotterCorteMatrizPrecios
              productosPorAncho={productosPorAncho}
              onPreciosChange={handlePreciosChange}
            />
          </div>
        </Card>

        <FloatingPreciosSaveButton
          hasChanges={hasUnsavedChanges}
          onSave={handleSave}
          isSaving={isSaving}
        />
      </div>

      <div
        style={{
          position: 'absolute',
          left: '-9999px',
          top: '0',
          width: '210mm',
          minHeight: '297mm',
        }}
      >
        <PlotterCortePDFTemplate ref={componentRef} productosPorAncho={productosPorAncho} />
      </div>
    </>
  );
}
