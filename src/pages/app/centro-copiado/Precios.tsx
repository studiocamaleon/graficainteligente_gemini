import { useState, useCallback, useMemo, useEffect } from 'react';
import { DollarSign, Palette, AlertCircle } from 'lucide-react';
import { Card } from '../../../components/ui/card';
import { Tabs } from '../../../components/ui/Tabs';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Modal } from '../../../components/ui/Modal';
import { InfoDialog } from '../../../components/ui/InfoDialog';
import { usePageHeader } from '../../../hooks/usePageHeader';
import { useCentroCopiadoPreciosImpresion, PrecioImpresionInput } from '../../../hooks/useCentroCopiadoPreciosImpresion';
import { CentroCopiadoTintaSection } from '../../../components/centro-copiado/CentroCopiadoTintaSection';
import { FloatingPreciosSaveButton } from '../../../components/productos/impresion-laser/FloatingPreciosSaveButton';
import { useCentroCopiadoExport } from '../../../hooks/useCentroCopiadoExport';
import { ExportPDFButtonGroup } from '../../../components/ui/ExportPDFButtonGroup';
import { useInfoDialog } from '../../../hooks/useInfoDialog';
import type { TipoTintaCopiado } from '../../../types/database';

type TabType = 'cmyk' | 'color' | 'bn';

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
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [copyDiscount, setCopyDiscount] = useState('10');
  const [isCopying, setIsCopying] = useState(false);
  const { dialogState, openDialog, closeDialog } = useInfoDialog();

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
              const [tamanioId, papelId] = combKey.split('|');
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
      (activeTab === 'color' && t.tipo_tinta === 'COLOR') ||
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

  const handleCopyFromFullColor = useCallback(async (discountPercent: number) => {
    if (Number.isNaN(discountPercent) || discountPercent < 0 || discountPercent > 100) {
      openDialog('Descuento inválido', 'El descuento debe ser un número entre 0 y 100.');
      return;
    }

    setIsCopying(true);
    try {
      const preciosMapCMYK = await loadPreciosExistentes('CMYK');
      const source: PrecioImpresionInput[] = [];

      preciosMapCMYK.forEach((precios, combKey) => {
        const [tamanioId, papelId] = combKey.split('|');
        precios.forEach((precio) => {
          const discountedRaw = Number(precio.precio) * (1 - discountPercent / 100);
          const discounted = Math.max(0, Math.round(discountedRaw * 100) / 100);
          source.push({
            tamanio_papel_id: tamanioId,
            papel_id: papelId,
            tipo_tinta: 'COLOR',
            rango_precio_id: precio.rango_precio_id,
            cara_impresa: precio.cara_impresa,
            precio: discounted,
          });
        });
      });

      if (source.length === 0) {
        openDialog('Sin precios fuente', 'No hay precios en Full Color para copiar.');
        return;
      }

      setPreciosPorTinta((prev) => {
        const next = new Map(prev);
        next.set('COLOR', source);
        return next;
      });
      setResetKey((prev) => prev + 1);
      setShowCopyModal(false);
      openDialog(
        'Copia aplicada',
        `Se copiaron ${source.length} precios de Full Color a Color con ${discountPercent}% de descuento. Podés editar manualmente antes de guardar.`,
        undefined
      );
    } catch (err) {
      console.error('Error copiando precios masivamente:', err);
      openDialog('Error', 'No se pudo copiar los precios desde Full Color.');
    } finally {
      setIsCopying(false);
    }
  }, [loadPreciosExistentes, openDialog]);

  const tabs = [
    { id: 'cmyk', name: 'Impresión Full Color', icon: Palette },
    { id: 'color', name: 'Impresión Color', icon: Palette },
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
          overridePrecios={preciosPorTinta.get(currentTintaData.tipo_tinta) || null}
        />
      </div>
    );
  };

  // ... inside Precios component
  const { handleExport, isExporting: isPDFGenerating } = useCentroCopiadoExport();

  // ... (existing renderContent function)

  return (
    <>
      <div className="space-y-6">
        <div className="flex justify-between items-center gap-3">
          <Card padding="none" className="w-fit">
            <Tabs tabs={tabs} activeTab={activeTab} onTabChange={(tabId) => setActiveTab(tabId as TabType)} />
          </Card>
          <div className="flex items-center gap-2">
            {activeTab === 'color' && (
              <Button
                variant="secondary"
                onClick={() => setShowCopyModal(true)}
                disabled={isLoading || isSaving || isCopying || tamanios.length === 0 || papeles.length === 0 || rangos.length === 0}
              >
                Copiar desde Full Color
              </Button>
            )}
            <ExportPDFButtonGroup
              onPrint={() => { }} // Direct download preferred
              onDownload={() => handleExport(tamanios, papeles, rangos, loadPreciosExistentes)}
              isGenerating={isPDFGenerating}
              label="Exportar Lista"
            />
          </div>
        </div>

        <div>{renderContent()}</div>
      </div>

      <FloatingPreciosSaveButton
        hasChanges={hasUnsavedChanges}
        onSave={handleSaveAll}
        isSaving={isSaving}
      />

      <Modal
        isOpen={showCopyModal}
        onClose={() => !isCopying && setShowCopyModal(false)}
        title="Copiar precios desde Full Color"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Se sobrescribirán todos los precios del tab Color usando la base de Full Color.
          </p>
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">Descuento (%)</label>
            <Input
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={copyDiscount}
              onChange={(e) => setCopyDiscount(e.target.value)}
              placeholder="Ej: 10"
            />
            <p className="mt-1 text-xs text-gray-500">0 = copia exacta, 100 = todos en 0.</p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowCopyModal(false)} disabled={isCopying}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              onClick={() => void handleCopyFromFullColor(Number(copyDiscount))}
              isLoading={isCopying}
              disabled={isCopying}
            >
              Aplicar copia
            </Button>
          </div>
        </div>
      </Modal>

      <InfoDialog
        isOpen={dialogState.isOpen}
        title={dialogState.title}
        message={dialogState.message}
        variant={dialogState.variant}
        buttonText={dialogState.buttonText}
        onClose={closeDialog}
      />
    </>
  );
}
