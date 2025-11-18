import { useState, useMemo, useCallback } from 'react';
import { Factory, Plus, Edit2, Power, Eye } from 'lucide-react';
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
import { EstacionForm, EstacionFormData } from '../../../components/abm-core/EstacionForm';
import { useEstaciones, useEstacion } from '../../../hooks/useEstaciones';
import { useAuth } from '../../../hooks/useAuth';
import { useDebounce } from '../../../hooks/useDebounce';
import { useConfirmDialog } from '../../../hooks/useConfirmDialog';
import type { EstacionTrabajo } from '../../../types/database';

export function Estaciones() {
  const { profile } = useAuth();
  const canEdit = profile?.role && ['super_admin', 'admin', 'manager'].includes(profile.role);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedEstacion, setSelectedEstacion] = useState<EstacionTrabajo | null>(null);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');

  const handleOpenCreateModal = useCallback(() => {
    setSelectedEstacion(null);
    setModalMode('create');
    setIsModalOpen(true);
  }, []);

  const headerAction = useMemo(
    () =>
      canEdit ? (
        <Button variant="primary" onClick={handleOpenCreateModal}>
          <Plus className="w-5 h-5" />
          Nueva Estación
        </Button>
      ) : undefined,
    [canEdit, handleOpenCreateModal]
  );

  usePageHeader('Gestiona las estaciones de trabajo de tu empresa', headerAction);

  const debouncedSearch = useDebounce(searchTerm, 300);
  const isActiveFilter = statusFilter === 'all' ? null : statusFilter === 'active';

  const activeFiltersCount = [searchTerm, statusFilter !== 'all'].filter(Boolean).length;

  const { estaciones, totalCount, loading, refetch } = useEstaciones({
    searchTerm: debouncedSearch,
    isActive: isActiveFilter,
    page: currentPage,
    itemsPerPage,
  });

  const { createEstacion, updateEstacion, toggleEstacionStatus, loading: mutationLoading } = useEstacion();
  const {
    dialogState,
    isLoading: isConfirmLoading,
    closeDialog,
    handleConfirm,
    confirmAction,
  } = useConfirmDialog();

  const totalPages = Math.ceil(totalCount / itemsPerPage);

  const handleEdit = (estacion: EstacionTrabajo) => {
    setSelectedEstacion(estacion);
    setModalMode('edit');
    setIsModalOpen(true);
  };

  const handleViewDetails = (estacion: EstacionTrabajo) => {
    setSelectedEstacion(estacion);
    setIsDetailModalOpen(true);
  };

  const handleToggleStatus = async (estacion: EstacionTrabajo) => {
    if (!canEdit) return;

    const action = estacion.is_active ? 'desactivar' : 'activar';
    confirmAction({
      title: `Confirmar ${action.charAt(0).toUpperCase() + action.slice(1)}`,
      message: `¿Está seguro que desea ${action} la estación "${estacion.nombre}"?`,
      confirmText: action.charAt(0).toUpperCase() + action.slice(1),
      variant: estacion.is_active ? 'warning' : 'info',
      onConfirm: async () => {
        const success = await toggleEstacionStatus(estacion.id, estacion.is_active);
        if (success) {
          refetch();
        }
      },
    });
  };

  const handleSubmit = async (data: EstacionFormData) => {
    try {
      if (modalMode === 'create') {
        const newEstacion = await createEstacion(data);
        if (newEstacion) {
          setIsModalOpen(false);
          refetch();
        }
      } else if (selectedEstacion) {
        const updated = await updateEstacion(selectedEstacion.id, data);
        if (updated) {
          setIsModalOpen(false);
          refetch();
        }
      }
    } catch (error) {
      console.error('Error submitting estacion:', error);
    }
  };

  const columns = [
    {
      key: 'nombre',
      header: 'Nombre',
      render: (estacion: EstacionTrabajo) => (
        <div className="font-medium text-gray-900">{estacion.nombre}</div>
      ),
    },
    {
      key: 'descripcion',
      header: 'Descripción',
      render: (estacion: EstacionTrabajo) => (
        <div className="text-sm text-gray-600">
          {estacion.descripcion || '-'}
        </div>
      ),
    },
    {
      key: 'created_at',
      header: 'Fecha de Creación',
      render: (estacion: EstacionTrabajo) => (
        <div className="text-sm text-gray-600">
          {new Date(estacion.created_at).toLocaleDateString('es-AR')}
        </div>
      ),
      width: '150px',
    },
    {
      key: 'estado',
      header: 'Estado',
      render: (estacion: EstacionTrabajo) => (
        <Badge variant={estacion.is_active ? 'primary' : 'secondary'} size="sm">
          {estacion.is_active ? 'Activa' : 'Inactiva'}
        </Badge>
      ),
      width: '100px',
    },
    {
      key: 'acciones',
      header: 'Acciones',
      render: (estacion: EstacionTrabajo) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleViewDetails(estacion)}
            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Ver detalles"
          >
            <Eye className="w-4 h-4" />
          </button>

          {canEdit && (
            <>
              <button
                onClick={() => handleEdit(estacion)}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                title="Editar"
              >
                <Edit2 className="w-4 h-4" />
              </button>

              <button
                onClick={() => handleToggleStatus(estacion)}
                className={`p-2 rounded-lg transition-colors ${
                  estacion.is_active
                    ? 'text-red-600 hover:bg-red-50'
                    : 'text-green-600 hover:bg-green-50'
                }`}
                title={estacion.is_active ? 'Desactivar' : 'Activar'}
                disabled={mutationLoading}
              >
                <Power className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      ),
      width: '150px',
    },
  ];

  return (
    <div>
      <Card padding="none">
        <div className="p-6 border-b border-gray-200 space-y-4">
          <CollapsibleFilters storageKey="estaciones-filters" activeFiltersCount={activeFiltersCount}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <SearchInput
                  onChange={setSearchTerm}
                  placeholder="Buscar por nombre..."
                />
              </div>

              <Select
                value={statusFilter}
                onChange={setStatusFilter}
                options={[
                  { value: 'all', label: 'Todos los estados' },
                  { value: 'active', label: 'Solo activas' },
                  { value: 'inactive', label: 'Solo inactivas' },
                ]}
              />
            </div>
          </CollapsibleFilters>

          <div className="text-sm text-gray-600">
            Total: <span className="font-semibold">{totalCount}</span> estaciones
          </div>
        </div>

        <Table
          columns={columns}
          data={estaciones}
          keyExtractor={(estacion) => estacion.id}
          emptyMessage="No se encontraron estaciones"
          isLoading={loading}
          dense
        />

        {totalCount > 0 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={totalCount}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
            onItemsPerPageChange={(value) => {
              setItemsPerPage(value);
              setCurrentPage(1);
            }}
          />
        )}
      </Card>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={modalMode === 'create' ? 'Nueva Estación de Trabajo' : 'Editar Estación de Trabajo'}
        size="md"
      >
        <EstacionForm
          estacion={selectedEstacion || undefined}
          onSubmit={handleSubmit}
          onCancel={() => setIsModalOpen(false)}
        />
      </Modal>

      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        title="Detalles de la Estación"
        size="md"
      >
        {selectedEstacion && (
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Información General</h3>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-gray-500">Nombre</p>
                  <p className="font-medium text-lg">{selectedEstacion.nombre}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Descripción</p>
                  <p className="text-gray-900">{selectedEstacion.descripcion || 'Sin descripción'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Estado</p>
                  <Badge variant={selectedEstacion.is_active ? 'primary' : 'secondary'}>
                    {selectedEstacion.is_active ? 'Activa' : 'Inactiva'}
                  </Badge>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Fechas</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Creada el</p>
                  <p className="font-medium">
                    {new Date(selectedEstacion.created_at).toLocaleDateString('es-AR', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Última actualización</p>
                  <p className="font-medium">
                    {new Date(selectedEstacion.updated_at).toLocaleDateString('es-AR', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={dialogState.isOpen}
        onClose={closeDialog}
        onConfirm={handleConfirm}
        title={dialogState.title}
        message={dialogState.message}
        confirmText={dialogState.confirmText}
        cancelText={dialogState.cancelText}
        variant={dialogState.variant}
        isLoading={isConfirmLoading}
      />
    </div>
  );
}
