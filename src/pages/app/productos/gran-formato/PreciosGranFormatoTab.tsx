import { useEffect, useCallback, useState, useMemo } from 'react';
import { Package, Loader2 } from 'lucide-react';
import { Card } from '../../../../components/ui/Card';
import { EmptyState } from '../../../../components/ui/EmptyState';
import { ExportPDFButton } from '../../../../components/ui/ExportPDFButton';
import { GranFormatoTecnologiaSection } from '../../../../components/productos/gran-formato/GranFormatoTecnologiaSection';
import { FloatingPreciosSaveButton } from '../../../../components/productos/impresion-laser/FloatingPreciosSaveButton';
import { useAllProductosGranFormatoPrecios } from '../../../../hooks/useAllProductosGranFormatoPrecios';
import { supabase } from '../../../../lib/supabase';
import type { PrecioGFInput } from '../../../../hooks/useAllProductosGranFormatoPrecios';
import { usePrintDocument } from '../../../../hooks/usePrintDocument';
import { ListaPreciosGranFormatoLayout } from '../../../../components/print/lista-precios/ListaPreciosGranFormatoLayout';

interface PreciosSnapshot {
  [key: string]: number;
}

const createPrecioKey = (precio: PrecioGFInput): string => {
  return `${precio.producto_gran_formato_id}-${precio.tecnologia_id}-${precio.tinta}-${precio.rango_precio_min}-${precio.rango_precio_max}`;
};

const getChangedPrecios = (
  currentPrecios: PrecioGFInput[],
  snapshot: PreciosSnapshot
): PrecioGFInput[] => {
  const changedPrecios: PrecioGFInput[] = [];
  const currentMap = new Map<string, number>();

  currentPrecios.forEach((p) => {
    currentMap.set(createPrecioKey(p), p.precio);
  });

  currentPrecios.forEach((currentPrecio) => {
    const key = createPrecioKey(currentPrecio);
    const snapshotPrecio = snapshot[key];

    if (snapshotPrecio === undefined || snapshotPrecio !== currentPrecio.precio) {
      changedPrecios.push(currentPrecio);
    }
  });

  Object.keys(snapshot).forEach((key) => {
    if (!currentMap.has(key)) {
      const [productoId, tecnologiaId, tinta, rangoMin, rangoMax] = key.split('-');
      changedPrecios.push({
        producto_gran_formato_id: productoId,
        tecnologia_id: tecnologiaId,
        tinta: tinta,
        rango_precio_min: parseFloat(rangoMin),
        rango_precio_max: parseFloat(rangoMax),
        precio: 0,
      });
    }
  });

  return changedPrecios;
};

export function PreciosGranFormatoTab() {
  const {
    productos,
    tecnologiasAgrupadas,
    isLoading,
    isSaving,
    error,
    saveAllPrecios,
    hasUnsavedChanges,
  } = useAllProductosGranFormatoPrecios();

  const [preciosPorTecnologia, setPreciosPorTecnologia] = useState<
    Map<string, PrecioGFInput[]>
  >(new Map());
  const [preciosSnapshot, setPreciosSnapshot] = useState<PreciosSnapshot>({});
  const [isLoadingSnapshot, setIsLoadingSnapshot] = useState(true);

  useEffect(() => {
    async function loadSnapshot() {
      if (productos.length === 0) {
        setIsLoadingSnapshot(false);
        return;
      }

      try {
        const { user } = await (async () => {
          const { data: { user } } = await supabase.auth.getUser();
          return { user };
        })();

        if (!user) {
          setIsLoadingSnapshot(false);
          return;
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('company_id')
          .eq('id', user.id)
          .maybeSingle();

        if (!profile) {
          setIsLoadingSnapshot(false);
          return;
        }

        const productosIds = productos.map((p) => p.id);

        const { data: preciosExistentes } = await supabase
          .from('productos_gran_formato_precios')
          .select('producto_gran_formato_id, tecnologia_id, tinta, rango_precio_min, rango_precio_max, precio')
          .in('producto_gran_formato_id', productosIds)
          .eq('company_id', profile.company_id);

        if (preciosExistentes) {
          const snapshot: PreciosSnapshot = {};
          preciosExistentes.forEach((precio) => {
            const key = createPrecioKey({
              producto_gran_formato_id: precio.producto_gran_formato_id,
              tecnologia_id: precio.tecnologia_id,
              tinta: precio.tinta,
              rango_precio_min: precio.rango_precio_min,
              rango_precio_max: precio.rango_precio_max,
              precio: precio.precio,
            });
            snapshot[key] = precio.precio;
          });
          setPreciosSnapshot(snapshot);
        }
      } catch (error) {
        console.error('Error loading snapshot:', error);
      } finally {
        setIsLoadingSnapshot(false);
      }
    }

    loadSnapshot();
  }, [productos]);

  const handleTecnologiaChange = useCallback((tecnologiaId: string, precios: PrecioGFInput[]) => {
    setPreciosPorTecnologia((prev) => {
      const newMap = new Map(prev);
      newMap.set(tecnologiaId, precios);
      return newMap;
    });
  }, []);

  const saveAllPreciosWithTecnologias = useCallback(async () => {
    if (preciosPorTecnologia.size === 0) return;

    try {
      const allPrecios = Array.from(preciosPorTecnologia.values()).flat();

      if (allPrecios.length === 0) return;

      const { user } = await (async () => {
        const { data: { user } } = await supabase.auth.getUser();
        return { user };
      })();

      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .maybeSingle();

      if (!profile) return;

      // CORRECCIÓN CRÍTICA: Identificar combinaciones únicas de (producto_id, tecnologia_id, tinta)
      // que se van a modificar, para borrar SOLO esas combinaciones específicas
      const combinacionesUnicas = new Map<string, { producto_id: string; tecnologia_id: string; tinta: string }>();

      allPrecios.forEach((precio) => {
        const key = `${precio.producto_gran_formato_id}-${precio.tecnologia_id}-${precio.tinta}`;
        if (!combinacionesUnicas.has(key)) {
          combinacionesUnicas.set(key, {
            producto_id: precio.producto_gran_formato_id,
            tecnologia_id: precio.tecnologia_id,
            tinta: precio.tinta,
          });
        }
      });

      console.log('[Gran Formato] Guardando precios para combinaciones:', Array.from(combinacionesUnicas.values()));

      // BORRADO SELECTIVO: Borrar solo las combinaciones específicas (producto + tecnología + tinta)
      // Esto asegura que NO se borren precios de otras tecnologías del mismo producto
      for (const combinacion of combinacionesUnicas.values()) {
        const { error: deleteError } = await supabase
          .from('productos_gran_formato_precios')
          .delete()
          .eq('producto_gran_formato_id', combinacion.producto_id)
          .eq('tecnologia_id', combinacion.tecnologia_id)
          .eq('tinta', combinacion.tinta)
          .eq('company_id', profile.company_id);

        if (deleteError) {
          console.error(`[Gran Formato] Error borrando precios para ${combinacion.producto_id}-${combinacion.tecnologia_id}-${combinacion.tinta}:`, deleteError);
          throw deleteError;
        }

        console.log(`[Gran Formato] Borrados precios existentes para: Producto ${combinacion.producto_id}, Tecnología ${combinacion.tecnologia_id}, Tinta ${combinacion.tinta}`);
      }

      // Insertar los nuevos precios
      const preciosToInsert = allPrecios.map((precio) => ({
        ...precio,
        company_id: profile.company_id,
      }));

      console.log(`[Gran Formato] Insertando ${preciosToInsert.length} nuevos precios`);

      const { error: insertError } = await supabase
        .from('productos_gran_formato_precios')
        .insert(preciosToInsert);

      if (insertError) {
        console.error('[Gran Formato] Error insertando precios:', insertError);
        throw insertError;
      }

      console.log('[Gran Formato] Precios guardados exitosamente');

      // Actualizar snapshot con los nuevos precios
      const newSnapshot: PreciosSnapshot = { ...preciosSnapshot };
      allPrecios.forEach((precio) => {
        const key = createPrecioKey(precio);
        newSnapshot[key] = precio.precio;
      });
      setPreciosSnapshot(newSnapshot);

      // Limpiar el estado de cambios pendientes
      setPreciosPorTecnologia(new Map());
    } catch (error) {
      console.error('[Gran Formato] Error saving precios:', error);
      throw error;
    }
  }, [preciosPorTecnologia, preciosSnapshot]);

  const hasUnsavedChangesLocal = useCallback(() => {
    return preciosPorTecnologia.size > 0 || hasUnsavedChanges();
  }, [preciosPorTecnologia, hasUnsavedChanges]);

  const tecnologiasConCallbacks = useMemo(() => {
    return tecnologiasAgrupadas.map((tecnologia) => ({
      ...tecnologia,
      handleChange: (precios: PrecioGFInput[]) => handleTecnologiaChange(tecnologia.id, precios),
    }));
  }, [tecnologiasAgrupadas, handleTecnologiaChange]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChangesLocal()) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChangesLocal]);

  if (isLoading || isLoadingSnapshot) {
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
            title="No hay productos de gran formato"
            description="Crea productos de gran formato en la pestaña Productos y asígnales rangos de precio para comenzar a configurar sus precios."
          />
        </div>
      </Card>
    );
  }

  if (tecnologiasAgrupadas.length === 0) {
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

  const { contentRef, print } = usePrintDocument({
    documentTitle: `Lista_Precios_Gran_Formato_${new Date().toISOString().split('T')[0]}`,
  });

  const handleExportPDF = async () => {
    await print();
  };

  return (
    <div className="space-y-6 pb-24">
      <div className="hidden">
        <ListaPreciosGranFormatoLayout
          ref={contentRef}
          tecnologiasAgrupadas={tecnologiasAgrupadas}
        />
      </div>

      <div className="flex justify-end">
        <ExportPDFButton
          onExport={handleExportPDF}
          label="Descargar Lista de Precios"
        />
      </div>

      {tecnologiasConCallbacks.map((tecnologia) => (
        <GranFormatoTecnologiaSection
          key={tecnologia.id}
          tecnologia={tecnologia}
          onPreciosChange={tecnologia.handleChange}
        />
      ))}

      <FloatingPreciosSaveButton
        hasChanges={hasUnsavedChangesLocal()}
        onSave={saveAllPreciosWithTecnologias}
        isSaving={isSaving}
      />
    </div>
  );
}
