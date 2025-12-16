
import { useState, useMemo, useCallback } from 'react';
import { Scissors, Plus, Edit2, Trash2 } from 'lucide-react';
import { Card } from '../../../components/ui/Card';
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
import { useCentroCopiadoRangosAnillado } from '../../../hooks/useCentroCopiadoRangosAnillado';
import { useCentroCopiadoRangosGuillotinado } from '../../../hooks/useCentroCopiadoRangosGuillotinado';
import { useCentroCopiadoPlastificados } from '../../../hooks/useCentroCopiadoPlastificados';
import { RangoAnilladoForm } from '../../../components/centro-copiado/RangoAnilladoForm';
import { RangoGuillotinadoForm } from '../../../components/centro-copiado/RangoGuillotinadoForm';
import { PlastificadoForm } from '../../../components/centro-copiado/PlastificadoForm';
import type { CentroCopiadoRangoAnillado, CentroCopiadoRangoGuillotinado, CentroCopiadoPlastificado } from '../../../types/database';

type TabType = 'anillados' | 'guillotinado' | 'plastificados';

export function Terminaciones() {
  const [activeTab, setActiveTab] = useState<TabType>('anillados');
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedAnillado, setSelectedAnillado] = useState<CentroCopiadoRangoAnillado | null>(null);
  const [selectedGuillotinado, setSelectedGuillotinado] = useState<CentroCopiadoRangoGuillotinado | null>(null);
  const [selectedPlastificado, setSelectedPlastificado] = useState<CentroCopiadoPlastificado | null>(null);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');

  const {
    rangos: anillados,
    loading: loadingAnillados,
    createRango: createAnillado,
    updateRango: updateAnillado,
    deleteRango: deleteAnillado,
    fetchRangos: fetchAnillados,
  } = useCentroCopiadoRangosAnillado();

  const {
    rangos: guillotinados,
    loading: loadingGuillotinados,
    createRango: createGuillotinado,
    updateRango: updateGuillotinado,
    deleteRango: deleteGuillotinado,
    fetchRangos: fetchGuillotinados,
  } = useCentroCopiadoRangosGuillotinado();

  const {
    plastificados,
    loading: loadingPlastificados,
    createPlastificado,
    updatePlastificado,
    deletePlastificado,
    fetchPlastificados,
  } = useCentroCopiadoPlastificados();

  const {
    dialogState,
    isLoading: isConfirmLoading,
    closeDialog,
    handleConfirm,
    confirmDelete,
  } = useConfirmDialog();

  const handleOpenCreateModal = useCallback(() => {
    setSelectedAnillado(null);
    setSelectedGuillotinado(null);
    setSelectedPlastificado(null);
    setModalMode('create');
    setIsModalOpen(true);
  }, []);

  const headerAction = useMemo(() => {
    if (activeTab === 'anillados') {
      return (
        <Button variant="primary" onClick={handleOpenCreateModal}>
          <Plus className="w-5 h-5" />
          Nuevo Rango de Anillado
        </Button>
      );
    } else if (activeTab === 'guillotinado') {
      return (
        <Button variant="primary" onClick={handleOpenCreateModal}>
          <Plus className="w-5 h-5" />
          Nuevo Rango de Guillotinado
        </Button>
      );
    } else if (activeTab === 'plastificados') {
      return (
        <Button variant="primary" onClick={handleOpenCreateModal}>
          <Plus className="w-5 h-5" />
          Agregar Plastificado
        </Button>
      );
    }
    return undefined;
  }, [activeTab, handleOpenCreateModal]);

  usePageHeader('Gestiona los servicios de terminación: anillados, guillotinado y plastificados', headerAction);

  const tabs = [
    { id: 'anillados', name: 'Anillados', icon: Scissors },
    { id: 'guillotinado', name: 'Guillotinado', icon: Scissors },
    { id: 'plastificados', name: 'Plastificados', icon: Scissors },
  ];

  const filteredAnillados = useMemo(() => {
    if (!searchTerm) return anillados;
    const search = searchTerm.toLowerCase();
    return anillados.filter(
      (a) =>
        a.hojas_desde.toString().includes(search) ||
        (a.hojas_hasta?.toString().includes(search) ?? false)
    );
  }, [anillados, searchTerm]);

  const filteredGuillotinados = useMemo(() => {
    if (!searchTerm) return guillotinados;
    const search = searchTerm.toLowerCase();
    return guillotinados.filter(
      (g) =>
        g.hojas_desde.toString().includes(search) ||
        (g.hojas_hasta?.toString().includes(search) ?? false)
    );
  }, [guillotinados, searchTerm]);

  const filteredPlastificados = useMemo(() => {
    if (!searchTerm) return plastificados;
    const search = searchTerm.toLowerCase();
    return plastificados.filter((p) => p.tipo.toLowerCase().includes(search));
  }, [plastificados, searchTerm]);

  const handleEditAnillado = (anillado: CentroCopiadoRangoAnillado) => {
    setSelectedAnillado(anillado);
    setModalMode('edit');
    setIsModalOpen(true);
  };

  const handleEditGuillotinado = (guillotinado: CentroCopiadoRangoGuillotinado) => {
    setSelectedGuillotinado(guillotinado);
    setModalMode('edit');
    setIsModalOpen(true);
  };

  const handleEditPlastificado = (plastificado: CentroCopiadoPlastificado) => {
    setSelectedPlastificado(plastificado);
    setModalMode('edit');
    setIsModalOpen(true);
  };

  const handleDeleteAnillado = async (anillado: CentroCopiadoRangoAnillado) => {
    confirmDelete(
      `Rango ${anillado.hojas_desde} - ${anillado.hojas_hasta || '∞'} hojas`,
      async () => {
        const success = await deleteAnillado(anillado.id);
        if (success) {
          await fetchAnillados();
        }
      }
    );
  };

  const handleDeleteGuillotinado = async (guillotinado: CentroCopiadoRangoGuillotinado) => {
    confirmDelete(
      `Rango ${guillotinado.hojas_desde} - ${guillotinado.hojas_hasta || '∞'} hojas`,
      async () => {
        const success = await deleteGuillotinado(guillotinado.id);
        if (success) {
          await fetchGuillotinados();
        }
      }
    );
  };

  const handleDeletePlastificado = async (plastificado: CentroCopiadoPlastificado) => {
    confirmDelete(
      `Rango ${plastificado.tipo}: ${plastificado.unidades_desde} - ${plastificado.unidades_hasta || '∞'} unidades`,
      async () => {
        const success = await deletePlastificado(plastificado.id);
        if (success) {
          await fetchPlastificados();
        }
      }
    );
  };

  const handleSubmitAnillado = async (data: any) => {
    if (modalMode === 'create') {
      const result = await createAnillado(data);
      if (result) {
        setIsModalOpen(false);
        await fetchAnillados();
      }
    } else if (selectedAnillado) {
      const result = await updateAnillado(selectedAnillado.id, data);
      if (result) {
        setIsModalOpen(false);
        await fetchAnillados();
      }
    }
  };

  const handleSubmitGuillotinado = async (data: any) => {
    if (modalMode === 'create') {
      const result = await createGuillotinado(data);
      if (result) {
        setIsModalOpen(false);
        await fetchGuillotinados();
      }
    } else if (selectedGuillotinado) {
      const result = await updateGuillotinado(selectedGuillotinado.id, data);
      if (result) {
        setIsModalOpen(false);
        await fetchGuillotinados();
      }
    }
  };

  const handleSubmitPlastificado = async (data: any) => {
    if (modalMode === 'create') {
      const result = await createPlastificado(data);
      if (result) {
        setIsModalOpen(false);
        await fetchPlastificados();
      }
    } else if (selectedPlastificado) {
      const result = await updatePlastificado(selectedPlastificado.id, data);
      if (result) {
        setIsModalOpen(false);
        await fetchPlastificados();
      }
    }
  };

  const renderAnilladosTab = () => {
    if (loadingAnillados) {
      return (
        <Card>
          <div className="p-12 text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
            <p className="text-gray-600">Cargando rangos de anillado...</p>
          </div>
        </Card>
      );
    }

    if (anillados.length === 0) {
      return (
        <Card>
          <div className="p-12">
            <EmptyState
              icon={Scissors}
              title="No hay rangos de anillado configurados"
              description="Comienza agregando rangos de cantidad de hojas con precios para anillado Ring Wire y Plástico."
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
            placeholder="Buscar rango..."
            className="mb-4"
          />

          <Table
            columns={[
              {
                key: 'rango',
                header: 'Rango de Hojas',
                render: (anillado: CentroCopiadoRangoAnillado) => (
                  <div className="flex items-center gap-2">
                    <Badge variant="primary">
                      {anillado.hojas_desde} - {anillado.hojas_hasta || '∞'}
                    </Badge>
                  </div>
                )
              },
              {
                key: 'precio_ring_wire',
                header: 'Precio Ring Wire',
                render: (anillado: CentroCopiadoRangoAnillado) => (
                  <span className="font-medium text-green-600">
                    ${anillado.precio_ring_wire.toFixed(2)}
                  </span>
                )
              },
              {
                key: 'precio_plastico',
                header: 'Precio Plástico',
                render: (anillado: CentroCopiadoRangoAnillado) => (
                  <span className="font-medium text-blue-600">
                    ${anillado.precio_plastico.toFixed(2)}
                  </span>
                )
              },
              {
                key: 'actions',
                header: 'Acciones',
                render: (anillado: CentroCopiadoRangoAnillado) => (
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => handleEditAnillado(anillado)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Editar"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteAnillado(anillado)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Eliminar"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )
              },
            ]}
            data={filteredAnillados}
            keyExtractor={(anillado) => anillado.id}
          />
        </div>
      </Card>
    );
  };

  const renderGuillotinadosTab = () => {
    if (loadingGuillotinados) {
      return (
        <Card>
          <div className="p-12 text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
            <p className="text-gray-600">Cargando rangos de guillotinado...</p>
          </div>
        </Card>
      );
    }

    if (guillotinados.length === 0) {
      return (
        <Card>
          <div className="p-12">
            <EmptyState
              icon={Scissors}
              title="No hay rangos de guillotinado configurados"
              description="Comienza agregando rangos de cantidad de hojas con precios para guillotinado."
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
            placeholder="Buscar rango..."
            className="mb-4"
          />

          <Table
            columns={[
              {
                key: 'rango',
                header: 'Rango de Hojas',
                render: (guillotinado: CentroCopiadoRangoGuillotinado) => (
                  <div className="flex items-center gap-2">
                    <Badge variant="primary">
                      {guillotinado.hojas_desde} - {guillotinado.hojas_hasta || '∞'}
                    </Badge>
                  </div>
                )
              },
              {
                key: 'precio',
                header: 'Precio',
                render: (guillotinado: CentroCopiadoRangoGuillotinado) => (
                  <span className="font-medium text-green-600">
                    ${guillotinado.precio.toFixed(2)}
                  </span>
                )
              },
              {
                key: 'actions',
                header: 'Acciones',
                render: (guillotinado: CentroCopiadoRangoGuillotinado) => (
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => handleEditGuillotinado(guillotinado)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Editar"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteGuillotinado(guillotinado)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Eliminar"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )
              },
            ]}
            data={filteredGuillotinados}
            keyExtractor={(guillotinado) => guillotinado.id}
          />
        </div>
      </Card>
    );
  };

  const renderPlastificadosTab = () => {
    if (loadingPlastificados) {
      return (
        <Card>
          <div className="p-12 text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
            <p className="text-gray-600">Cargando plastificados...</p>
          </div>
        </Card>
      );
    }

    if (plastificados.length === 0) {
      return (
        <Card>
          <div className="p-12">
            <EmptyState
              icon={Scissors}
              title="No hay rangos de plastificado configurados"
              description="Comienza agregando rangos de cantidad de unidades con precios para plastificados A4, SRA3 y Carnet."
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
            placeholder="Buscar tipo..."
            className="mb-4"
          />

          <Table
            columns={[
              {
                key: 'tipo',
                header: 'Tipo de Plastificado',
                render: (plastificado: CentroCopiadoPlastificado) => (
                  <Badge variant="secondary">{plastificado.tipo}</Badge>
                )
              },
              {
                key: 'rango',
                header: 'Rango de Unidades',
                render: (plastificado: CentroCopiadoPlastificado) => (
                  <div className="flex items-center gap-2">
                    <Badge variant="primary">
                      {plastificado.unidades_desde} - {plastificado.unidades_hasta || '∞'}
                    </Badge>
                  </div>
                )
              },
              {
                key: 'precio',
                header: 'Precio',
                render: (plastificado: CentroCopiadoPlastificado) => (
                  <span className="font-medium text-green-600">
                    ${plastificado.precio.toFixed(2)}
                  </span>
                )
              },
              {
                key: 'actions',
                header: 'Acciones',
                render: (plastificado: CentroCopiadoPlastificado) => (
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => handleEditPlastificado(plastificado)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Editar"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeletePlastificado(plastificado)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Eliminar"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )
              },
            ]}
            data={filteredPlastificados}
            keyExtractor={(plastificado) => plastificado.id}
          />
        </div>
      </Card>
    );
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'anillados':
        return renderAnilladosTab();
      case 'guillotinado':
        return renderGuillotinadosTab();
      case 'plastificados':
        return renderPlastificadosTab();
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <Card padding="none">
        <Tabs tabs={tabs} activeTab={activeTab} onTabChange={(tabId) => setActiveTab(tabId as TabType)} />
      </Card>

      <div>{renderTabContent()}</div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={
          activeTab === 'anillados'
            ? modalMode === 'create'
              ? 'Nuevo Rango de Anillado'
              : 'Editar Rango de Anillado'
            : activeTab === 'guillotinado'
              ? modalMode === 'create'
                ? 'Nuevo Rango de Guillotinado'
                : 'Editar Rango de Guillotinado'
              : modalMode === 'create'
                ? 'Agregar Precio de Plastificado'
                : 'Editar Precio de Plastificado'
        }
      >
        {activeTab === 'anillados' ? (
          <RangoAnilladoForm
            rango={modalMode === 'edit' ? selectedAnillado || undefined : undefined}
            onSubmit={handleSubmitAnillado}
            onCancel={() => setIsModalOpen(false)}
          />
        ) : activeTab === 'guillotinado' ? (
          <RangoGuillotinadoForm
            rango={modalMode === 'edit' ? selectedGuillotinado || undefined : undefined}
            onSubmit={handleSubmitGuillotinado}
            onCancel={() => setIsModalOpen(false)}
          />
        ) : (
          <PlastificadoForm
            plastificado={modalMode === 'edit' ? selectedPlastificado || undefined : undefined}
            onSubmit={handleSubmitPlastificado}
            onCancel={() => setIsModalOpen(false)}
          />
        )}
      </Modal>

      <ConfirmDialog
        isOpen={dialogState.isOpen}
        title={dialogState.title}
        message={dialogState.message}
        onConfirm={handleConfirm}
        onCancel={closeDialog}
        isLoading={isConfirmLoading}
      />
    </div>
  );
}
