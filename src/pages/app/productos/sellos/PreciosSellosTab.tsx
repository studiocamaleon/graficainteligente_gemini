import { useState, useEffect, useCallback, useMemo } from 'react';
import { Package, Loader2 } from 'lucide-react';
import { Card } from '../../../../components/ui/card';
import { EmptyState } from '../../../../components/ui/EmptyState';
import { ExportPDFButtonGroup } from '../../../../components/ui/ExportPDFButtonGroup';
import { SellosPreciosTable } from '../../../../components/productos/sellos/SellosPreciosTable';
import { FloatingPreciosSaveButton } from '../../../../components/productos/impresion-laser/FloatingPreciosSaveButton';
import { useProductosSellosPrecios } from '../../../../hooks/useProductosSellosPrecios';
import type { PrecioSelloInput } from '../../../../hooks/useProductosSellosPrecios';
import { useSellosExport } from '../../../../hooks/useSellosExport';
import { useAuth } from '../../../../hooks/useAuth';

export function PreciosSellosTab() {
  const { profile } = useAuth();
  const canEditPrecios = useMemo(() => {
    return !['operador_diseno', 'operador_taller'].includes(profile?.role || '');
  }, [profile?.role]);

  const { productos, isLoading, isSaving, error, saveAllPrecios, refetch } =
    useProductosSellosPrecios();

  const [preciosActuales, setPreciosActuales] = useState<PrecioSelloInput[]>([]);
  const [preciosSnapshot, setPreciosSnapshot] = useState<Record<string, number>>({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  /* Export Logic */
  const { handleExport, isExporting } = useSellosExport();

  useEffect(() => {
    if (productos.length > 0) {
      const snapshot: Record<string, number> = {};
      productos.forEach((producto) => {
        snapshot[producto.id] = producto.precio_unitario;
      });
      setPreciosSnapshot(snapshot);
    }
  }, [productos]);

  const handlePreciosChange = useCallback(
    (precios: PrecioSelloInput[]) => {
      setPreciosActuales(precios);

      const hasChanges = precios.some((precio) => {
        const snapshotPrecio = preciosSnapshot[precio.producto_id];
        return snapshotPrecio === undefined || snapshotPrecio !== precio.precio_unitario;
      });

      setHasUnsavedChanges(hasChanges);
    },
    [preciosSnapshot]
  );

  const handleSave = useCallback(async () => {
    try {
      const success = await saveAllPrecios(preciosActuales);

      if (success) {
        const newSnapshot: Record<string, number> = {};
        preciosActuales.forEach((precio) => {
          newSnapshot[precio.producto_id] = precio.precio_unitario;
        });
        setPreciosSnapshot(newSnapshot);
        setHasUnsavedChanges(false);
        setPreciosActuales([]);
        refetch();
      }
    } catch (err) {
      console.error('Error guardando precios:', err);
    }
  }, [preciosActuales, saveAllPrecios, refetch]);

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
          <Loader2 className="w-8 h-8 text-violet-600 animate-spin mb-4" />
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

  if (productos.length === 0) {
    return (
      <Card>
        <div className="p-12">
          <EmptyState
            icon={Package}
            title="No hay productos de sellos"
            description="Crea productos de sellos en la pestaña Productos para comenzar a configurar sus precios."
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
            onDownload={() => handleExport(productos)}
            isGenerating={isExporting}
            label="Exportar"
            showPrint={false}
          />
        </div>

        <Card>
          <div className="p-6">
            <SellosPreciosTable productos={productos} onPreciosChange={handlePreciosChange} readonly={!canEditPrecios} />
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
