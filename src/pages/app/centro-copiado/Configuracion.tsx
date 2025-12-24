import { useState, useMemo, useCallback } from 'react';
import { Settings2, FileText, Plus, Edit2, Trash2, ArrowUp, ArrowDown, GitBranch, Printer } from 'lucide-react';
import { Card } from '../../../components/ui/card';
import { Tabs } from '../../../components/ui/Tabs';
import { Button } from '../../../components/ui/Button';
import { Table } from '../../../components/ui/Table';
import { Modal } from '../../../components/ui/Modal';
import { SearchInput } from '../../../components/ui/SearchInput';
import { Badge } from '../../../components/ui/Badge';
import { EmptyState } from '../../../components/ui/EmptyState';
import { usePageHeader } from '../../../hooks/usePageHeader';
import { useConfirmDialog } from '../../../hooks/useConfirmDialog';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { useCentroCopiadoTamanios } from '../../../hooks/useCentroCopiadoTamanios';
import { useCentroCopiadoPapeles } from '../../../hooks/useCentroCopiadoPapeles';
import { TamanioPapelForm } from '../../../components/centro-copiado/TamanioPapelForm';
import { PapelForm } from '../../../components/centro-copiado/PapelForm';
import { RutasConfigTab } from '../../../components/centro-copiado/RutasConfigTab';
import { PloteoCADConfigTab } from '../../../components/centro-copiado/PloteoCADConfigTab';
import type { CentroCopiadoTamanioPapel, CentroCopiadoPapel } from '../../../types/database';

interface PapelWithMaterial extends CentroCopiadoPapel {
  material?: {
    id: string;
    nombre: string;
  };
}

type TabType = 'tamanios' | 'papeles' | 'rutas' | 'ploteo_cad';

export function Configuracion() {
  const [activeTab, setActiveTab] = useState<TabType>('tamanios');
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTamanio, setSelectedTamanio] = useState<CentroCopiadoTamanioPapel | null>(null);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');

  const {
    tamanios,
    loading: loadingTamanios,
    createTamanio,
    updateTamanio,
    deleteTamanio,
    fetchTamanios,
  } = useCentroCopiadoTamanios();

  const {
    papeles,
    loading: loadingPapeles,
    createPapel,
    deletePapel,
    fetchPapeles,
    reorderPapeles,
  } = useCentroCopiadoPapeles();

  const {
    dialogState,
    isLoading: isConfirmLoading,
    closeDialog,
    handleConfirm,
    confirmDelete,
  } = useConfirmDialog();

  const handleOpenCreateModal = useCallback(() => {
    setSelectedTamanio(null);
    setModalMode('create');
    setIsModalOpen(true);
  }, []);

  const headerAction = useMemo(() => {
    if (activeTab === 'tamanios') {
      return (
        <Button variant="primary" onClick={handleOpenCreateModal}>
          <Plus className="w-5 h-5" />
          Nuevo Tamaño
        </Button>
      );
    } else if (activeTab === 'papeles') {
      return (
        <Button variant="primary" onClick={() => setIsModalOpen(true)}>
          <Plus className="w-5 h-5" />
          Agregar Papel
        </Button>
      );
    }
    return undefined;
  }, [activeTab, handleOpenCreateModal]);

  usePageHeader('Configura los tamaños de papel y tipos de papel disponibles para el centro de copiado', headerAction);

  const tabs = [
    { id: 'tamanios', name: 'Tamaños de Papel', icon: FileText },
    { id: 'papeles', name: 'Tipos de Papel', icon: Settings2 },
    { id: 'ploteo_cad', name: 'Ploteo CAD', icon: Printer },
    { id: 'rutas', name: 'Rutas de Producción', icon: GitBranch },
  ];

  const filteredTamanios = useMemo(() => {
    if (!searchTerm) return tamanios;
    const search = searchTerm.toLowerCase();
    return tamanios.filter((t) => t.nombre.toLowerCase().includes(search));
  }, [tamanios, searchTerm]);

  const filteredPapeles = useMemo(() => {
    if (!searchTerm) return papeles;
    const search = searchTerm.toLowerCase();
    return papeles.filter(
      (p) =>
        p.variante_nombre.toLowerCase().includes(search) ||
        p.material?.nombre.toLowerCase().includes(search)
    );
  }, [papeles, searchTerm]);

  const handleEditTamanio = (tamanio: CentroCopiadoTamanioPapel) => {
    setSelectedTamanio(tamanio);
    setModalMode('edit');
    setIsModalOpen(true);
  };

  const handleDeleteTamanio = async (tamanio: CentroCopiadoTamanioPapel) => {
    confirmDelete(tamanio.nombre, async () => {
      const success = await deleteTamanio(tamanio.id);
      if (success) {
        await fetchTamanios();
      }
    });
  };

  const handleDeletePapel = async (papelId: string, nombre: string) => {
    confirmDelete(nombre, async () => {
      const success = await deletePapel(papelId);
      if (success) {
        await fetchPapeles();
      }
    });
  };

  const handleSubmitTamanio = async (data: any) => {
    if (modalMode === 'create') {
      const result = await createTamanio(data);
      if (result) {
        setIsModalOpen(false);
        await fetchTamanios();
      }
    } else if (selectedTamanio) {
      const result = await updateTamanio(selectedTamanio.id, data);
      if (result) {
        setIsModalOpen(false);
        await fetchTamanios();
      }
    }
  };

  const handleSubmitPapel = async (data: any) => {
    const result = await createPapel(data);
    if (result) {
      setIsModalOpen(false);
      await fetchPapeles();
    }
  };

  const handleMovePapelUp = async (index: number) => {
    if (index === 0) return;

    const newPapeles = [...papeles];
    [newPapeles[index - 1], newPapeles[index]] = [newPapeles[index], newPapeles[index - 1]];

    await reorderPapeles(newPapeles);
  };

  const handleMovePapelDown = async (index: number) => {
    if (index === papeles.length - 1) return;

    const newPapeles = [...papeles];
    [newPapeles[index], newPapeles[index + 1]] = [newPapeles[index + 1], newPapeles[index]];

    await reorderPapeles(newPapeles);
  };

  const renderTamaniosTab = () => {
    if (loadingTamanios) {
      return (
        <Card>
          <div className="p-12 text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
            <p className="text-gray-600">Cargando tamaños...</p>
          </div>
        </Card>
      );
    }

    if (tamanios.length === 0) {
      return (
        <Card>
          <div className="p-12">
            <EmptyState
              icon={FileText}
              title="No hay tamaños de papel configurados"
              description="Comienza agregando tamaños de papel como A4, SRA3, Carta, Oficio, etc."
            />
          </div>
        </Card>
      );
    }

    return (
      <Card>
        <div className="p-6">
          <SearchInput
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Buscar tamaño..."
            className="mb-4"
          />

          <Table
            columns={[
              {
                key: 'nombre',
                header: 'Nombre',
                render: (tamanio: CentroCopiadoTamanioPapel) => (
                  <span className="font-medium">{tamanio.nombre}</span>
                )
              },
              {
                key: 'dimensiones',
                header: 'Dimensiones (mm)',
                render: (tamanio: CentroCopiadoTamanioPapel) => (
                  <Badge variant="default">
                    {tamanio.ancho_mm} × {tamanio.alto_mm} mm
                  </Badge>
                )
              },
              {
                key: 'actions',
                header: 'Acciones',
                render: (tamanio: CentroCopiadoTamanioPapel) => (
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => handleEditTamanio(tamanio)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Editar"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteTamanio(tamanio)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Eliminar"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )
              },
            ]}
            data={filteredTamanios}
            keyExtractor={(tamanio) => tamanio.id}
          />
        </div>
      </Card>
    );
  };

  const renderPapelesTab = () => {
    if (loadingPapeles) {
      return (
        <Card>
          <div className="p-12 text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
            <p className="text-gray-600">Cargando papeles...</p>
          </div>
        </Card>
      );
    }

    if (papeles.length === 0) {
      return (
        <Card>
          <div className="p-12">
            <EmptyState
              icon={Settings2}
              title="No hay tipos de papel configurados"
              description="Agrega tipos de papel desde tus materiales existentes para usarlos en el centro de copiado."
            />
          </div>
        </Card>
      );
    }

    return (
      <Card>
        <div className="p-6">
          <SearchInput
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Buscar papel..."
            className="mb-4"
          />

          {searchTerm && (
            <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                El ordenamiento está deshabilitado durante la búsqueda. Limpia el filtro para reordenar los papeles.
              </p>
            </div>
          )}

          <Table
            columns={[
              {
                key: 'orden',
                header: 'Orden',
                render: (papel: PapelWithMaterial, index: number) => (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500 font-medium w-8">#{index! + 1}</span>
                    <div className="flex flex-col gap-1">
                      <button
                        onClick={() => handleMovePapelUp(index!)}
                        disabled={index === 0 || searchTerm !== ''}
                        className={`p-1 rounded transition-colors ${index === 0 || searchTerm !== ''
                          ? 'text-gray-300 cursor-not-allowed'
                          : 'text-blue-600 hover:bg-blue-50'
                          }`}
                        title="Mover arriba"
                      >
                        <ArrowUp className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => handleMovePapelDown(index!)}
                        disabled={index === papeles.length - 1 || searchTerm !== ''}
                        className={`p-1 rounded transition-colors ${index === papeles.length - 1 || searchTerm !== ''
                          ? 'text-gray-300 cursor-not-allowed'
                          : 'text-blue-600 hover:bg-blue-50'
                          }`}
                        title="Mover abajo"
                      >
                        <ArrowDown className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                )
              },
              {
                key: 'material',
                header: 'Material',
                render: (papel: PapelWithMaterial) => (
                  <span className="font-medium">{papel.material?.nombre || 'N/A'}</span>
                )
              },
              {
                key: 'variante',
                header: 'Variante',
                render: (papel: PapelWithMaterial) => papel.variante_nombre
              },
              {
                key: 'espesor',
                header: 'Espesor',
                render: (papel: PapelWithMaterial) => papel.espesor ? (
                  <Badge variant="default">
                    {papel.espesor} {papel.unidad_espesor}
                  </Badge>
                ) : (
                  <span className="text-gray-400">N/A</span>
                )
              },
              {
                key: 'actions',
                header: 'Acciones',
                render: (papel: PapelWithMaterial) => (
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() =>
                        handleDeletePapel(
                          papel.id,
                          `${papel.material?.nombre} - ${papel.variante_nombre}`
                        )
                      }
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Eliminar"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )
              },
            ]}
            data={filteredPapeles}
            keyExtractor={(papel) => papel.id}
          />
        </div>
      </Card>
    );
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'tamanios':
        return renderTamaniosTab();
      case 'papeles':
        return renderPapelesTab();
      case 'rutas':
        return <RutasConfigTab />;
      case 'ploteo_cad':
        return <PloteoCADConfigTab />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <Card className="p-0">
        <Tabs tabs={tabs} activeTab={activeTab} onTabChange={(tabId) => setActiveTab(tabId as TabType)} />
      </Card>

      <div>{renderTabContent()}</div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={
          activeTab === 'tamanios'
            ? modalMode === 'create'
              ? 'Nuevo Tamaño de Papel'
              : 'Editar Tamaño de Papel'
            : 'Agregar Tipo de Papel'
        }
      >
        {activeTab === 'tamanios' ? (
          <TamanioPapelForm
            tamanio={modalMode === 'edit' ? selectedTamanio || undefined : undefined}
            onSubmit={handleSubmitTamanio}
            onCancel={() => setIsModalOpen(false)}
          />
        ) : (
          <PapelForm onSubmit={handleSubmitPapel} onCancel={() => setIsModalOpen(false)} />
        )}
      </Modal>

      <ConfirmDialog
        isOpen={dialogState.isOpen}
        title={dialogState.title}
        message={dialogState.message}
        onConfirm={handleConfirm}
        onClose={closeDialog}
        isLoading={isConfirmLoading}
      />
    </div>
  );
}
