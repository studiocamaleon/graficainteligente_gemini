import { useState, useMemo, useCallback } from 'react';
import { GitBranch, Plus, Edit2, Power, Eye, Trash2 } from 'lucide-react';
import { Card } from '../../../components/ui/card';
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
import { PasoForm, PasoFormData } from '../../../components/abm-core/PasoForm';
import { usePasos, usePaso } from '../../../hooks/usePasos';
import { useAuth } from '../../../hooks/useAuth';
import { useDebounce } from '../../../hooks/useDebounce';
import { useConfirmDialog } from '../../../hooks/useConfirmDialog';
import type { Paso, EtapaPaso } from '../../../types/database';

const ETAPA_COLORS: Record<EtapaPaso, { bg: string; text: string }> = {
  'Pre-prensa': { bg: 'bg-blue-100', text: 'text-blue-700' },
  'Produccion': { bg: 'bg-green-100', text: 'text-green-700' },
  'Terminacion': { bg: 'bg-yellow-100', text: 'text-yellow-700' },
  'Instalacion': { bg: 'bg-orange-100', text: 'text-orange-700' },
  'Entrega': { bg: 'bg-purple-100', text: 'text-purple-700' },
};

export function Pasos() {
  const { profile } = useAuth();
  const canEdit = profile?.role && ['super_admin', 'admin', 'manager'].includes(profile.role);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [etapaFilter, setEtapaFilter] = useState<string>('all');
  const [orderBy, setOrderBy] = useState<'nombre' | 'etapa'>('nombre');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedPaso, setSelectedPaso] = useState<Paso | null>(null);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');

  const handleOpenCreateModal = useCallback(() => {
    setSelectedPaso(null);
    setModalMode('create');
    setIsModalOpen(true);
  }, []);

  const headerAction = useMemo(
    () =>
      canEdit ? (
        <Button variant="primary" onClick={handleOpenCreateModal}>
          <Plus className="w-5 h-5" />
          Nuevo Paso
        </Button>
      ) : undefined,
    [canEdit, handleOpenCreateModal]
  );

  usePageHeader('Gestiona los pasos del proceso de producción', headerAction);

  const debouncedSearch = useDebounce(searchTerm, 300);
  const isActiveFilter = statusFilter === 'all' ? null : statusFilter === 'active';
  const etapaFilterValue = etapaFilter === 'all' ? null : (etapaFilter as EtapaPaso);

  const activeFiltersCount = [searchTerm, etapaFilter !== 'all', statusFilter !== 'all'].filter(Boolean).length;

  const { pasos, totalCount, loading, refetch } = usePasos({
    searchTerm: debouncedSearch,
    isActive: isActiveFilter,
    etapaFilter: etapaFilterValue,
    page: currentPage,
    itemsPerPage,
    orderBy,
  });

  const { createPaso, updatePaso, togglePasoStatus, deletePaso, loading: mutationLoading } = usePaso();
  const {
    dialogState,
    isLoading: isConfirmLoading,
    closeDialog,
    handleConfirm,
    confirmDelete,
    confirmAction,
  } = useConfirmDialog();

  const totalPages = Math.ceil(totalCount / itemsPerPage);

  const handleEdit = (paso: Paso) => {
    setSelectedPaso(paso);
    setModalMode('edit');
    setIsModalOpen(true);
  };

  const handleViewDetails = (paso: Paso) => {
    setSelectedPaso(paso);
    setIsDetailModalOpen(true);
  };

  const handleToggleStatus = async (paso: Paso) => {
    if (!canEdit) return;

    const action = paso.is_active ? 'desactivar' : 'activar';
    confirmAction({
      title: `Confirmar ${action.charAt(0).toUpperCase() + action.slice(1)}`,
      message: `¿Está seguro que desea ${action} el paso "${paso.nombre}"?`,
      confirmText: action.charAt(0).toUpperCase() + action.slice(1),
      variant: paso.is_active ? 'warning' : 'info',
      onConfirm: async () => {
        const success = await togglePasoStatus(paso.is_active);
        if (success) {
          refetch();
        }
      },
    });
  };

  const handleDelete = async (paso: Paso) => {
    if (!canEdit) return;

    confirmDelete(paso.nombre, async () => {
      const success = await deletePaso(paso.id);
      if (success) {
        refetch();
      }
    });
  };

  const handleSubmit = async (data: PasoFormData) => {
    try {
      if (modalMode === 'create') {
        const newPaso = await createPaso(data);
        if (newPaso) {
          setIsModalOpen(false);
          refetch();
        }
      } else if (selectedPaso) {
        const updated = await updatePaso(selectedPaso.id, data);
        if (updated) {
          setIsModalOpen(false);
          refetch();
        }
      }
    } catch (error) {
      console.error('Error submitting paso:', error);
    }
  };

  const columns = [
    {
      key: 'nombre',
      header: 'Nombre',
      render: (paso: Paso) => (
        <div className="font-medium text-gray-900">{paso.nombre}</div>
      ),
    },
    {
      key: 'etapa',
      header: 'Etapa',
      render: (paso: Paso) => {
        const colors = ETAPA_COLORS[paso.etapa];
        return (
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors.bg} ${colors.text}`}>
            {paso.etapa}
          </span>
        );
      },
      width: '150px',
    },
    {
      key: 'estacion',
      header: 'Estación',
      render: (paso: any) => (
        <span className="text-sm text-gray-600">
          {paso.estaciones_trabajo?.nombre || '-'}
        </span>
      ),
    },
    {
      key: 'estado',
      header: 'Estado',
      render: (paso: Paso) => (
        <Badge variant={paso.is_active ? 'primary' : 'secondary'} size="sm">
          {paso.is_active ? 'Activo' : 'Inactivo'}
        </Badge>
      ),
      width: '100px',
    },
    {
      key: 'acciones',
      header: 'Acciones',
      render: (paso: Paso) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleViewDetails(paso)}
            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Ver detalles"
          >
            <Eye className="w-4 h-4" />
          </button>

          {canEdit && (
            <>
              <button
                onClick={() => handleEdit(paso)}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                title="Editar"
              >
                <Edit2 className="w-4 h-4" />
              </button>

              <button
                onClick={() => handleToggleStatus(paso)}
                className={`p-2 rounded-lg transition-colors ${
                  paso.is_active
                    ? 'text-red-600 hover:bg-red-50'
                    : 'text-green-600 hover:bg-green-50'
                }`}
                title={paso.is_active ? 'Desactivar' : 'Activar'}
                disabled={mutationLoading}
              >
                <Power className="w-4 h-4" />
              </button>

              {(profile?.role === 'super_admin' || profile?.role === 'admin') && (
                <button
                  onClick={() => handleDelete(paso)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Eliminar"
                  disabled={mutationLoading}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </>
          )}
        </div>
      ),
      width: '180px',
    },
  ];

  return (
    <div>
      <Card padding="none">
        <div className="p-6 border-b border-gray-200 space-y-4">
          <CollapsibleFilters storageKey="pasos-filters" activeFiltersCount={activeFiltersCount}>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="md:col-span-2">
                <SearchInput
                  onChange={setSearchTerm}
                  placeholder="Buscar por nombre..."
                />
              </div>

              <Select
                value={orderBy}
                onChange={(value) => setOrderBy(value as 'nombre' | 'etapa')}
                options={[
                  { value: 'nombre', label: 'Ordenar por Nombre' },
                  { value: 'etapa', label: 'Ordenar por Etapa' },
                ]}
              />

              <Select
                value={etapaFilter}
                onChange={setEtapaFilter}
                options={[
                  { value: 'all', label: 'Todas las etapas' },
                  { value: 'Pre-prensa', label: 'Pre-prensa' },
                  { value: 'Produccion', label: 'Producción' },
                  { value: 'Terminacion', label: 'Terminación' },
                  { value: 'Instalacion', label: 'Instalación' },
                  { value: 'Entrega', label: 'Entrega' },
                ]}
              />

              <Select
                value={statusFilter}
                onChange={setStatusFilter}
                options={[
                  { value: 'all', label: 'Todos los estados' },
                  { value: 'active', label: 'Solo activos' },
                  { value: 'inactive', label: 'Solo inactivos' },
                ]}
              />
            </div>
          </CollapsibleFilters>

          <div className="text-sm text-gray-600">
            Total: <span className="font-semibold">{totalCount}</span> pasos
          </div>
        </div>

        <Table
          columns={columns}
          data={pasos}
          keyExtractor={(paso) => paso.id}
          emptyMessage="No se encontraron pasos"
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
        title={modalMode === 'create' ? 'Nuevo Paso' : 'Editar Paso'}
        size="md"
      >
        <PasoForm
          paso={selectedPaso || undefined}
          onSubmit={handleSubmit}
          onCancel={() => setIsModalOpen(false)}
        />
      </Modal>

      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        title="Detalles del Paso"
        size="md"
      >
        {selectedPaso && (
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Información General</h3>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-gray-500">Nombre</p>
                  <p className="font-medium text-lg">{selectedPaso.nombre}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500 mb-2">Etapa</p>
                    {(() => {
                      const colors = ETAPA_COLORS[selectedPaso.etapa];
                      return (
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${colors.bg} ${colors.text}`}>
                          {selectedPaso.etapa}
                        </span>
                      );
                    })()}
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Estado</p>
                    <Badge variant={selectedPaso.is_active ? 'primary' : 'secondary'}>
                      {selectedPaso.is_active ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Estación de Trabajo</p>
                  <p className="font-medium">{(selectedPaso as any).estaciones_trabajo?.nombre || '-'}</p>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Fechas</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Creado el</p>
                  <p className="font-medium">
                    {new Date(selectedPaso.created_at).toLocaleDateString('es-AR', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Última actualización</p>
                  <p className="font-medium">
                    {new Date(selectedPaso.updated_at).toLocaleDateString('es-AR', {
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
