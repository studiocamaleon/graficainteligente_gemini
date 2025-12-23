import { useEffect, useCallback, useMemo } from 'react';
import { Package, Loader2 } from 'lucide-react';
import { Card } from '../../../../components/ui/card';
import { EmptyState } from '../../../../components/ui/EmptyState';
import { ExportPDFButtonGroup } from '../../../../components/ui/ExportPDFButtonGroup';
import { FloatingPreciosSaveButton } from '../../../../components/productos/impresion-laser/FloatingPreciosSaveButton';
import { PortabannersMatrizPrecios } from '../../../../components/productos/portabanners/PortabannersMatrizPrecios';
import { useAllProductosPortabannersPrecios } from '../../../../hooks/useAllProductosPortabannersPrecios';
import { usePortabannersExport } from '../../../../hooks/usePortabannersExport';
import type { PrecioPortabannerInput } from '../../../../hooks/useAllProductosPortabannersPrecios';
import { useAuth } from '../../../../hooks/useAuth';

export function PreciosPortabannersTab() {
  const { profile } = useAuth();
  const canEditPrecios = useMemo(() => {
    return !['operador_diseno', 'operador_taller'].includes(profile?.role || '');
  }, [profile?.role]);

  const {
    productos,
    tecnologias,
    isLoading,
    isSaving,
    error,
    updatePrecios,
    saveAllPrecios,
    hasUnsavedChanges,
  } = useAllProductosPortabannersPrecios();

  /* Export Logic */
  const { handleExport, isExporting } = usePortabannersExport();

  const handlePreciosChange = useCallback((precios: PrecioPortabannerInput[]) => {
    updatePrecios(precios);
  }, [updatePrecios]);

  const handleSave = useCallback(async () => {
    try {
      await saveAllPrecios();
    } catch (error) {
      console.error('Error saving precios:', error);
    }
  }, [saveAllPrecios]);

  // Group products by rango_precio_id
  const productosPorRango = useMemo(() => {
    const grupos = new Map<string, typeof productos>();

    productos.forEach((producto) => {
      const rangoId = producto.rango_precio_id;
      if (!grupos.has(rangoId)) {
        grupos.set(rangoId, []);
      }
      grupos.get(rangoId)!.push(producto);
    });

    return Array.from(grupos.values());
  }, [productos]);

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
            title="No hay productos portabanners"
            description="Crea productos portabanners en la pestaña Productos y asígnales rangos de precio para comenzar a configurar sus precios."
          />
        </div>
      </Card>
    );
  }

  if (tecnologias.length === 0) {
    return (
      <Card>
        <div className="p-12">
          <EmptyState
            icon={Package}
            title="No hay tecnologías configuradas"
            description="Los productos no tienen tecnologías configuradas. Edita los productos para asignarles tecnologías de impresión."
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
            onDownload={() => handleExport(productosPorRango, tecnologias)}
            isGenerating={isExporting}
            label="Exportar"
            showPrint={false}
          />
        </div>

        {productosPorRango.map((grupoProductos, index) => {
          if (grupoProductos.length === 0) return null;

          const primerProducto = grupoProductos[0];
          const rangos = primerProducto.rangos;
          const unidadMedida = primerProducto.unidad_medida;
          const rangoNombre = primerProducto.rango_nombre;

          return (
            <Card key={index}>
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-gray-200 pb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {rangoNombre}
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">
                      {grupoProductos.length} {grupoProductos.length === 1 ? 'producto' : 'productos'}
                    </p>
                  </div>
                </div>

                <PortabannersMatrizPrecios
                  productos={grupoProductos}
                  tecnologias={tecnologias}
                  rangos={rangos}
                  unidadMedida={unidadMedida}
                  onPreciosChange={handlePreciosChange}
                  readonly={!canEditPrecios}
                />
              </div>
            </Card>
          );
        })}

        {canEditPrecios && (
          <FloatingPreciosSaveButton
            hasChanges={hasUnsavedChanges()}
            onSave={handleSave}
            isSaving={isSaving}
          />
        )}
      </div>
    </>
  );
}
