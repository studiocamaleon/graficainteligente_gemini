import { useState, useMemo, useCallback } from 'react';
import { Route, Plus, Edit2, Power, Trash2, Copy, Eye, Settings } from 'lucide-react';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { usePageHeader } from '../../../hooks/usePageHeader';
import { SearchInput } from '../../../components/ui/SearchInput';
import { Select } from '../../../components/ui/Select';
import { Table } from '../../../components/ui/Table';
import { Pagination } from '../../../components/ui/Pagination';
import { Modal } from '../../../components/ui/Modal';
import { Badge } from '../../../components/ui/Badge';
import { CollapsibleFilters } from '../../../components/ui/CollapsibleFilters';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { RutaForm } from '../../../components/rutas/RutaForm';
import { RutaPasosEditor } from '../../../components/rutas/RutaPasosEditor';
import { useRutasProduccion } from '../../../hooks/useRutasProduccion';
import { useRutaProduccion } from '../../../hooks/useRutaProduccion';
import { useAuth } from '../../../hooks/useAuth';
import { useDebounce } from '../../../hooks/useDebounce';
import { useConfirmDialog } from '../../../hooks/useConfirmDialog';
import type { RutaProduccion, RutaProduccionFormData } from '../../../types/database';

export function RutasProduccionNew() {
  const { profile } = useAuth();
  const canEdit = profile?.role && ['super_admin', 'admin', 'manager'].includes(profile.role);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [orderBy, setOrderBy] = useState<'nombre' | 'created_at'>('nombre');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRuta, setSelectedRuta] = useState<RutaProduccion | null>(null);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [isPasosEditorOpen, setIsPasosEditorOpen] = useState(false);
  const [rutaEditandoPasos, setRutaEditandoPasos] = useState<RutaProduccion | null>(null);

  const handleOpenCreateModal = useCallback(() => {
    setSelectedRuta(null);
    setModalMode('create');
    setIsModalOpen(true);
  }, []);

  const headerAction = useMemo(
    () =>
      canEdit ? (
        <Button variant="primary" onClick={handleOpenCreateModal}>
          <Plus className="w-5 h-5" />
          Nueva Ruta
        </Button>
      ) : undefined,
    [canEdit, handleOpenCreateModal]
  );

  usePageHeader('Gestiona las rutas de producción de tu empresa', headerAction);

  const debouncedSearch = useDebounce(searchTerm, 300);
  const isActiveFilter = statusFilter === 'all' ? null : statusFilter === 'active';

  const activeFiltersCount = [searchTerm, statusFilter !== 'all'].filter(Boolean).length;

  const { rutas, totalCount, loading, refetch } = useRutasProduccion({
    searchTerm: debouncedSearch,
    isActive: isActiveFilter,
    page: currentPage,
    itemsPerPage,
    orderBy,
  });

  const {
    createRuta,
    updateRuta,
    toggleRutaStatus,
    deleteRuta,
    duplicateRuta,
    loading: mutationLoading,
  } = useRutaProduccion();

  const {
    dialogState,
    isLoading: isConfirmLoading,
    closeDialog,
    handleConfirm,
    confirmDelete,
    confirmAction,
  } = useConfirmDialog();

  const totalPages = Math.ceil(totalCount / itemsPerPage);

  const handleEdit = (ruta: RutaProduccion) => {
    setSelectedRuta(ruta);
    setModalMode('edit');
    setIsModalOpen(true);
  };

  const handleEditPasos = (ruta: RutaProduccion) => {
    setRutaEditandoPasos(ruta);
    setIsPasosEditorOpen(true);
  };

  const handleFormSubmit = async (data: RutaProduccionFormData) => {
    let success = false;

    if (modalMode === 'create') {
      const result = await createRuta(data);
      success = result !== null;
    } else if (selectedRuta) {
      success = await updateRuta(selectedRuta.id, data);
    }

    if (success) {
      setIsModalOpen(false);
      setSelectedRuta(null);
      await refetch();
    }
  };

  const handleToggleStatus = async (ruta: RutaProduccion) => {
    confirmAction({
      title: ruta.is_active ? 'Desactivar Ruta' : 'Activar Ruta',
      message: ruta.is_active
        ? `¿Estás seguro de que deseas desactivar la ruta "${ruta.nombre}"? Los productos que la usan continuarán funcionando, pero no podrá asignarse a nuevos productos.`
        : `¿Deseas activar la ruta "${ruta.nombre}"?`,
      confirmText: ruta.is_active ? 'Desactivar' : 'Activar',
      type: ruta.is_active ? 'warning' : 'info',
      onConfirm: async () => {
        const success = await toggleRutaStatus(ruta.id, ruta.is_active);
        if (success) {
          await refetch();
        }
      },
    });
  };

  const handleDelete = (ruta: RutaProduccion) => {
    confirmDelete({
      itemName: ruta.nombre,
      warningMessage:
        'Esta acción eliminará la ruta y todos sus pasos configurados. Los productos que usan esta ruta quedarán sin ruta asignada.',
      onConfirm: async () => {
        const success = await deleteRuta(ruta.id);
        if (success) {
          await refetch();
        }
      },
    });
  };

  const handleDuplicate = async (ruta: RutaProduccion) => {
    confirmAction({
      title: 'Duplicar Ruta',
      message: `¿Deseas crear una copia de la ruta "${ruta.nombre}"? La copia incluirá todos los pasos y configuraciones, pero estará desactivada por defecto.`,
      confirmText: 'Duplicar',
      type: 'info',
      onConfirm: async () => {
        const result = await duplicateRuta(ruta.id);
        if (result) {
          await refetch();
        }
      },
    });
  };

  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
  };

  return (
    <div className="space-y-6">
      <CollapsibleFilters activeCount={activeFiltersCount} onClear={clearFilters}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <SearchInput
              value={searchTerm}
              onChange={setSearchTerm}
              placeholder="Buscar por nombre..."
            />
          </div>

          <Select value={statusFilter} onChange={(value) => setStatusFilter(value)}>
            <option value="all">Todos los estados</option>
            <option value="active">Activos</option>
            <option value="inactive">Inactivos</option>
          </Select>
        </div>
      </CollapsibleFilters>

      <Card>
        <div className="overflow-x-auto">
          <Table
            columns={[
              {
                key: 'nombre',
                header: 'Nombre de la Ruta',
                render: (ruta: RutaProduccion) => (
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <Route className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">{ruta.nombre}</div>
                      <div className="text-xs text-gray-500">ID: {ruta.id.slice(0, 8)}</div>
                    </div>
                  </div>
                ),
              },
              {
                key: 'descripcion',
                header: 'Descripción',
                render: (ruta: RutaProduccion) => (
                  <p className="text-sm text-gray-600 line-clamp-2">
                    {ruta.descripcion || 'Sin descripción'}
                  </p>
                ),
              },
              {
                key: 'pasos_count',
                header: 'Pasos',
                render: (ruta: RutaProduccion) => {
                  const count = ruta.pasos_count || 0;
                  return (
                    <div className="flex items-center gap-2">
                      <Badge variant={count === 0 ? 'warning' : 'info'}>
                        {count} {count === 1 ? 'paso' : 'pasos'}
                      </Badge>
                    </div>
                  );
                },
                width: '140px',
              },
              {
                key: 'estado',
                header: 'Estado',
                render: (ruta: RutaProduccion) =>
                  ruta.is_active ? (
                    <Badge variant="success">Activo</Badge>
                  ) : (
                    <Badge variant="neutral">Inactivo</Badge>
                  ),
                width: '120px',
              },
              {
                key: 'acciones',
                header: 'Acciones',
                render: (ruta: RutaProduccion) => (
                  <div className="flex items-center justify-end gap-2">
                    {canEdit && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditPasos(ruta)}
                          title="Configurar Pasos"
                        >
                          <Settings className="w-4 h-4 text-blue-600" />
                        </Button>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(ruta)}
                          title="Editar"
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleStatus(ruta)}
                          title={ruta.is_active ? 'Desactivar' : 'Activar'}
                        >
                          <Power
                            className={`w-4 h-4 ${
                              ruta.is_active ? 'text-yellow-600' : 'text-gray-400'
                            }`}
                          />
                        </Button>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDuplicate(ruta)}
                          title="Duplicar"
                        >
                          <Copy className="w-4 h-4" />
                        </Button>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(ruta)}
                          title="Eliminar"
                        >
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </Button>
                      </>
                    )}
                  </div>
                ),
                width: '200px',
              },
            ]}
            data={rutas}
            keyExtractor={(ruta) => ruta.id}
            isLoading={loading}
            emptyMessage="No se encontraron rutas de producción"
          />
        </div>

        {totalPages > 1 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            itemsPerPage={itemsPerPage}
            onItemsPerPageChange={(value) => {
              setItemsPerPage(value);
              setCurrentPage(1);
            }}
          />
        )}
      </Card>

      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedRuta(null);
        }}
        title={modalMode === 'create' ? 'Nueva Ruta de Producción' : 'Editar Ruta de Producción'}
      >
        <RutaForm
          ruta={selectedRuta}
          onSubmit={handleFormSubmit}
          onCancel={() => {
            setIsModalOpen(false);
            setSelectedRuta(null);
          }}
          isSubmitting={mutationLoading}
        />
      </Modal>

      <ConfirmDialog
        isOpen={dialogState.isOpen}
        title={dialogState.title}
        message={dialogState.message}
        confirmText={dialogState.confirmText}
        cancelText={dialogState.cancelText}
        variant={dialogState.variant}
        onConfirm={handleConfirm}
        onClose={closeDialog}
        isLoading={isConfirmLoading}
      />

      {isPasosEditorOpen && rutaEditandoPasos && (
        <Modal
          isOpen={isPasosEditorOpen}
          onClose={() => {
            setIsPasosEditorOpen(false);
            setRutaEditandoPasos(null);
            refetch();
          }}
          title=""
          size="full"
        >
          <div className="p-6">
            <RutaPasosEditor
              rutaId={rutaEditandoPasos.id}
              rutaNombre={rutaEditandoPasos.nombre}
              onClose={() => {
                setIsPasosEditorOpen(false);
                setRutaEditandoPasos(null);
                refetch();
              }}
            />
          </div>
        </Modal>
      )}
    </div>
  );
}
