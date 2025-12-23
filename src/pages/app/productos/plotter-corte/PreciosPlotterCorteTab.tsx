import { useState, useEffect, useCallback, useMemo } from 'react';
import { Package, Loader2 } from 'lucide-react';
import { Card } from '../../../../components/ui/card';
import { EmptyState } from '../../../../components/ui/EmptyState';
import { ExportPDFButtonGroup } from '../../../../components/ui/ExportPDFButtonGroup';
import { PlotterCorteMatrizPrecios } from '../../../../components/productos/plotter-corte/PlotterCorteMatrizPrecios';
import { FloatingPreciosSaveButton } from '../../../../components/productos/impresion-laser/FloatingPreciosSaveButton';
import { useAllProductosPlotterCortePrecios } from '../../../../hooks/useAllProductosPlotterCortePrecios';
import type { PrecioPCInput } from '../../../../hooks/useAllProductosPlotterCortePrecios';
import { usePlotterCorteExport } from '../../../../hooks/usePlotterCorteExport';
import { useAuth } from '../../../../hooks/useAuth';

interface PreciosSnapshot {
  [key: string]: number;
}

const createPrecioKey = (precio: PrecioPCInput): string => {
  return `${precio.producto_id}-${precio.ancho}-${precio.cantidad_desde}-${precio.cantidad_hasta}`;
};

export function PreciosPlotterCorteTab() {
  const { profile } = useAuth();
  const canEditPrecios = useMemo(() => {
    return !['operador_diseno', 'operador_taller'].includes(profile?.role || '');
  }, [profile?.role]);

  const { productosPorAncho, isLoading, isSaving, error, saveAllPrecios } =
    useAllProductosPlotterCortePrecios();

  const [preciosActuales, setPreciosActuales] = useState<PrecioPCInput[]>([]);
  const [preciosSnapshot, setPreciosSnapshot] = useState<PreciosSnapshot>({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  /* Export Logic */
  const { handleExport, isExporting } = usePlotterCorteExport();

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
            onPrint={() => { }} // Direct download preferred
            onDownload={() => handleExport(productosPorAncho)}
            isGenerating={isExporting}
            label="Exportar"
            showPrint={false}
          />
        </div>

        <Card>
          <div className="p-6">
            <PlotterCorteMatrizPrecios
              productosPorAncho={productosPorAncho}
              onPreciosChange={handlePreciosChange}
              readonly={!canEditPrecios}
            />
          </div>
        </Card>

        {canEditPrecios && (
          <FloatingPreciosSaveButton
            hasChanges={hasUnsavedChanges}
            onSave={handleSave}
            isSaving={isSaving}
          />
        )}
      </div>

    </>
  );
}
