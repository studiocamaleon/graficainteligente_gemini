import { useState, useCallback, useMemo, useEffect } from 'react';
import { DollarSign, Palette, AlertCircle } from 'lucide-react';
import { Card } from '../../../components/ui/Card';
import { Tabs } from '../../../components/ui/Tabs';
import { EmptyState } from '../../../components/ui/EmptyState';
import { usePageHeader } from '../../../hooks/usePageHeader';
import { useCentroCopiadoPreciosImpresion, PrecioImpresionInput } from '../../../hooks/useCentroCopiadoPreciosImpresion';
import { CentroCopiadoTintaSection } from '../../../components/centro-copiado/CentroCopiadoTintaSection';
import { FloatingPreciosSaveButton } from '../../../components/productos/impresion-laser/FloatingPreciosSaveButton';
import { CentroCopiadoPDFTemplate } from '../../../components/pdf/templates/CentroCopiadoPDFTemplate';
import { usePDFExport } from '../../../hooks/usePDFExport';
import { ExportPDFButtonGroup } from '../../../components/ui/ExportPDFButtonGroup';
import type { TipoTintaCopiado } from '../../../types/database';

type TabType = 'cmyk' | 'bn';

interface PreciosSnapshot {
  [key: string]: number;
}

const createPrecioKey = (precio: PrecioImpresionInput): string => {
  return `${precio.tamanio_papel_id}-${precio.papel_id}-${precio.tipo_tinta}-${precio.rango_precio_id}-${precio.cara_impresa}`;
};

export function Precios() {
  const [activeTab, setActiveTab] = useState<TabType>('cmyk');
  const [preciosPorTinta, setPreciosPorTinta] = useState<Map<TipoTintaCopiado, PrecioImpresionInput[]>>(new Map());
  const [preciosSnapshot, setPreciosSnapshot] = useState<PreciosSnapshot>({});
  const [isSaving, setIsSaving] = useState(false);
  const [resetKey, setResetKey] = useState(0);

  const {
    tamanios,
    papeles,
    rangos,
    tintasData,
    isLoading,
    error,
    loadPreciosExistentes,
    savePrecios,
    refetch,
  } = useCentroCopiadoPreciosImpresion();

  usePageHeader('Gestiona los precios de impresión por tipo de tinta, tamaño y papel');

  useEffect(() => {
    async function loadInitialSnapshot() {
      if (tintasData.length === 0) return;

      try {
        const allPrecios: PreciosSnapshot = {};

        for (const tintaData of tintasData) {
          const preciosMap = await loadPreciosExistentes(tintaData.tipo_tinta);

          preciosMap.forEach((precios, combKey) => {
            precios.forEach(precio => {
              const [tamanioId, papelId] = combKey.split('-');
              const key = createPrecioKey({
                tamanio_papel_id: tamanioId,
                papel_id: papelId,
                tipo_tinta: tintaData.tipo_tinta,
                rango_precio_id: precio.rango_precio_id,
                cara_impresa: precio.cara_impresa,
                precio: precio.precio,
              });
              allPrecios[key] = precio.precio;
            });
          });
        }

        setPreciosSnapshot(allPrecios);
      } catch (error) {
        console.error('Error loading initial snapshot:', error);
      }
    }

    loadInitialSnapshot();
  }, [tintasData]);

  const currentTintaData = useMemo(() => {
    return tintasData.find(t =>
      (activeTab === 'cmyk' && t.tipo_tinta === 'CMYK') ||
      (activeTab === 'bn' && t.tipo_tinta === 'K')
    );
  }, [tintasData, activeTab]);

  const handleTintaChange = useCallback((tipoTinta: TipoTintaCopiado, precios: PrecioImpresionInput[]) => {
    setPreciosPorTinta(prev => {
      const newMap = new Map(prev);
      newMap.set(tipoTinta, precios);
      return newMap;
    });
  }, []);

  const handleCurrentTintaChange = useCallback((precios: PrecioImpresionInput[]) => {
    if (currentTintaData) {
      handleTintaChange(currentTintaData.tipo_tinta, precios);
    }
  }, [currentTintaData, handleTintaChange]);

  const loadCurrentPreciosExistentes = useCallback(() => {
    if (currentTintaData) {
      return loadPreciosExistentes(currentTintaData.tipo_tinta);
    }
    return Promise.resolve(new Map());
  }, [currentTintaData, loadPreciosExistentes]);

  const tabs = [
    { id: 'cmyk', name: 'Impresión CMYK', icon: Palette },
    { id: 'bn', name: 'Blanco y Negro', icon: DollarSign },
  ];

  const hasUnsavedChanges = useMemo(() => {
    // Si no hay precios por tinta, no hay cambios
    if (preciosPorTinta.size === 0) return false;

    const allPrecios = Array.from(preciosPorTinta.values()).flat();

    // Si no hay precios en el array, no hay cambios
    if (allPrecios.length === 0) return false;

    // Verificar si algún precio difiere del snapshot
    for (const precio of allPrecios) {
      const key = createPrecioKey(precio);
      const snapshotPrecio = preciosSnapshot[key];

      // Si el precio es diferente al snapshot, hay cambios
      if (snapshotPrecio === undefined || snapshotPrecio !== precio.precio) {
        return true;
      }
    }

    return false;
  }, [preciosPorTinta, preciosSnapshot]);

  const handleSaveAll = useCallback(async () => {
    if (preciosPorTinta.size === 0) return;

    setIsSaving(true);
    try {
      const allPrecios = Array.from(preciosPorTinta.values()).flat();

      if (allPrecios.length === 0) return;

      const success = await savePrecios(allPrecios);

      if (success) {
        // Primero refetch para obtener los datos actualizados
        await refetch();

        // Actualizar el snapshot con todos los precios guardados
        const newSnapshot: PreciosSnapshot = { ...preciosSnapshot };
        allPrecios.forEach(precio => {
          const key = createPrecioKey(precio);
          newSnapshot[key] = precio.precio;
        });
        setPreciosSnapshot(newSnapshot);

        // Limpiar el mapa de precios pendientes
        setPreciosPorTinta(new Map());

        // Forzar remount de los componentes para resetear hasLocalChanges
        setResetKey(prev => prev + 1);
      }
    } catch (error) {
      console.error('Error saving precios:', error);
      throw error;
    } finally {
      setIsSaving(false);
    }
  }, [preciosPorTinta, preciosSnapshot, savePrecios, refetch]);

  const renderContent = () => {
    if (isLoading) {
      return (
        <Card>
          <div className="p-12 text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
            <p className="text-gray-600">Cargando configuración...</p>
          </div>
        </Card>
      );
    }

    if (error) {
      return (
        <Card>
          <div className="p-12">
            <EmptyState
              icon={AlertCircle}
              title="Error al cargar datos"
              description={error}
            />
          </div>
        </Card>
      );
    }

    if (tamanios.length === 0 || papeles.length === 0 || rangos.length === 0) {
      return (
        <Card>
          <div className="p-12">
            <EmptyState
              icon={AlertCircle}
              title="Configuración incompleta"
              description="Antes de configurar precios, debes tener al menos un tamaño de papel, un tipo de papel y un rango de precio configurados. Ve a la pestaña de Configuración y Rangos de Precio para completar la configuración."
            />
          </div>
        </Card>
      );
    }

    if (!currentTintaData) {
      return null;
    }

    return (
      <div className="space-y-6">
        <CentroCopiadoTintaSection
          key={`${currentTintaData.tipo_tinta}-${resetKey}`}
          tintaData={currentTintaData}
          rangos={rangos}
          onPreciosChange={handleCurrentTintaChange}
          loadPreciosExistentes={loadCurrentPreciosExistentes}
        />
      </div>
    );
  };

  // ... inside Precios component
  const { componentRef, isGenerating: isPDFGenerating, handlePrint, handleDownloadPDF } = usePDFExport({
    filename: `Lista_Precios_Centro_Copiado_${new Date().toISOString().split('T')[0]}.pdf`,
  });

  const [pdfData, setPdfData] = useState<{
    cmyk: Map<string, any[]>;
    bn: Map<string, any[]>;
  }>({ cmyk: new Map(), bn: new Map() });

  const [isPreparingPDF, setIsPreparingPDF] = useState(false);

  const prepareAndExport = async (action: 'print' | 'download') => {
    setIsPreparingPDF(true);
    try {
      // Fetch prices for both ink types
      const cmyk = await loadPreciosExistentes('CMYK');
      const bn = await loadPreciosExistentes('K');
      setPdfData({ cmyk, bn });

      // Give React a moment to render the template with new data
      await new Promise(resolve => setTimeout(resolve, 500));

      if (action === 'print') {
        handlePrint();
      } else {
        handleDownloadPDF();
      }
    } catch (err) {
      console.error('Error preparing PDF:', err);
    } finally {
      setIsPreparingPDF(false);
    }
  };

  // ... (existing renderContent function)

  return (
    <>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <Card padding="none" className="w-fit">
            <Tabs tabs={tabs} activeTab={activeTab} onTabChange={(tabId) => setActiveTab(tabId as TabType)} />
          </Card>
          <ExportPDFButtonGroup
            onPrint={() => prepareAndExport('print')}
            onDownload={() => prepareAndExport('download')}
            isGenerating={isPDFGenerating || isPreparingPDF}
            label="Exportar Lista"
          />
        </div>

        <div>{renderContent()}</div>
      </div>

      <FloatingPreciosSaveButton
        hasChanges={hasUnsavedChanges}
        onSave={handleSaveAll}
        isSaving={isSaving}
      />

      {/* Hidden PDF Template */}
      <div
        style={{
          position: 'absolute',
          left: '-9999px',
          top: '0',
          width: '210mm',
          minHeight: '297mm'
        }}
      >
        <CentroCopiadoPDFTemplate
          ref={componentRef}
          tamanios={tamanios}
          papeles={papeles}
          rangos={rangos}
          preciosCMYK={pdfData.cmyk}
          preciosBN={pdfData.bn}
        />
      </div>
    </>
  );
}
