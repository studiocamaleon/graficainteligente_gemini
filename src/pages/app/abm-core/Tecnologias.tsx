import { useState, useMemo, useCallback, useEffect } from 'react';
import { Cpu, Plus, Edit2, Power, Eye, CheckCircle, AlertCircle } from 'lucide-react';
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
import { TecnologiaForm, TecnologiaFormData } from '../../../components/abm-core/TecnologiaForm';
import { useTecnologias, useTecnologia } from '../../../hooks/useTecnologias';
import { useAuth } from '../../../hooks/useAuth';
import { useDebounce } from '../../../hooks/useDebounce';
import { useConfirmDialog } from '../../../hooks/useConfirmDialog';
import type { Tecnologia, TintaType } from '../../../types/database';

const TINTA_COLORS: Record<TintaType, string> = {
  'K': 'bg-gray-100 text-gray-700',
  'CMYK': 'bg-blue-100 text-blue-700',
  'CMYK+W': 'bg-green-100 text-green-700',
  'CMYK+V': 'bg-purple-100 text-purple-700',
  'CMYK+W+V': 'bg-pink-100 text-pink-700',
};

export function Tecnologias() {
  const { profile } = useAuth();
  const canEdit = profile?.role && ['super_admin', 'admin', 'manager'].includes(profile.role);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [tintaFilter, setTintaFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedTecnologia, setSelectedTecnologia] = useState<Tecnologia | null>(null);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [tintasPasosConfig, setTintasPasosConfig] = useState<any[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const handleOpenCreateModal = useCallback(() => {
    setSelectedTecnologia(null);
    setModalMode('create');
    setIsModalOpen(true);
  }, []);

  const headerAction = useMemo(
    () =>
      canEdit ? (
        <Button variant="primary" onClick={handleOpenCreateModal}>
          <Plus className="w-5 h-5" />
          Nueva Tecnología
        </Button>
      ) : undefined,
    [canEdit, handleOpenCreateModal]
  );

  usePageHeader('Gestiona las tecnologías de impresión disponibles', headerAction);

  const debouncedSearch = useDebounce(searchTerm, 300);
  const isActiveFilter = statusFilter === 'all' ? null : statusFilter === 'active';
  const tintaFilterValue = tintaFilter === 'all' ? null : (tintaFilter as TintaType);

  const activeFiltersCount = [searchTerm, tintaFilter !== 'all', statusFilter !== 'all'].filter(Boolean).length;

  const { tecnologias, totalCount, loading, refetch } = useTecnologias({
    searchTerm: debouncedSearch,
    isActive: isActiveFilter,
    tintaFilter: tintaFilterValue,
    page: currentPage,
    itemsPerPage,
  });

  const {
    createTecnologiaWithTintasPasos,
    updateTecnologiaWithTintasPasos,
    getTintasPasos,
    toggleTecnologiaStatus,
    loading: mutationLoading
  } = useTecnologia();
  const {
    dialogState,
    isLoading: isConfirmLoading,
    closeDialog,
    handleConfirm,
    confirmAction,
  } = useConfirmDialog();

  const totalPages = Math.ceil(totalCount / itemsPerPage);

  const handleEdit = (tecnologia: Tecnologia) => {
    setSelectedTecnologia(tecnologia);
    setModalMode('edit');
    setIsModalOpen(true);
  };

  const handleViewDetails = async (tecnologia: Tecnologia) => {
    setSelectedTecnologia(tecnologia);
    setIsDetailModalOpen(true);
    setLoadingDetails(true);
    try {
      const configs = await getTintasPasos(tecnologia.id);
      setTintasPasosConfig(configs);
    } catch (error) {
      console.error('Error loading tintas pasos config:', error);
      setTintasPasosConfig([]);
    } finally {
      setLoadingDetails(false);
    }
  };

  useEffect(() => {
    if (!isDetailModalOpen) {
      setTintasPasosConfig([]);
    }
  }, [isDetailModalOpen]);

  const handleToggleStatus = async (tecnologia: Tecnologia) => {
    if (!canEdit) return;

    const action = tecnologia.is_active ? 'desactivar' : 'activar';
    confirmAction({
      title: `Confirmar ${action.charAt(0).toUpperCase() + action.slice(1)}`,
      message: `¿Está seguro que desea ${action} la tecnología "${tecnologia.nombre}"?`,
      confirmText: action.charAt(0).toUpperCase() + action.slice(1),
      variant: tecnologia.is_active ? 'warning' : 'info',
      onConfirm: async () => {
        const success = await toggleTecnologiaStatus(tecnologia.id, tecnologia.is_active);
        if (success) {
          refetch();
        }
      },
    });
  };

  const handleSubmit = async (data: TecnologiaFormData) => {
    try {
      if (modalMode === 'create') {
        const newTecnologia = await createTecnologiaWithTintasPasos(
          { nombre: data.nombre, tintas: data.tintas },
          data.configuraciones
        );
        if (newTecnologia) {
          setIsModalOpen(false);
          refetch();
        }
      } else if (selectedTecnologia) {
        const updated = await updateTecnologiaWithTintasPasos(
          selectedTecnologia.id,
          { nombre: data.nombre, tintas: data.tintas },
          data.configuraciones
        );
        if (updated) {
          setIsModalOpen(false);
          refetch();
        }
      }
    } catch (error) {
      console.error('Error submitting tecnologia:', error);
    }
  };

  const columns = [
    {
      key: 'nombre',
      header: 'Nombre',
      render: (tecnologia: Tecnologia) => (
        <div className="font-medium text-gray-900">{tecnologia.nombre}</div>
      ),
    },
    {
      key: 'tintas',
      header: 'Tintas',
      render: (tecnologia: Tecnologia) => (
        <div className="flex flex-wrap gap-1">
          {tecnologia.tintas.map((tinta) => (
            <span
              key={tinta}
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${TINTA_COLORS[tinta]}`}
            >
              {tinta}
            </span>
          ))}
        </div>
      ),
    },
    {
      key: 'estado',
      header: 'Estado',
      render: (tecnologia: Tecnologia) => (
        <Badge variant={tecnologia.is_active ? 'primary' : 'secondary'} size="sm">
          {tecnologia.is_active ? 'Activa' : 'Inactiva'}
        </Badge>
      ),
      width: '100px',
    },
    {
      key: 'acciones',
      header: 'Acciones',
      render: (tecnologia: Tecnologia) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleViewDetails(tecnologia)}
            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Ver detalles"
          >
            <Eye className="w-4 h-4" />
          </button>

          {canEdit && (
            <>
              <button
                onClick={() => handleEdit(tecnologia)}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                title="Editar"
              >
                <Edit2 className="w-4 h-4" />
              </button>

              <button
                onClick={() => handleToggleStatus(tecnologia)}
                className={`p-2 rounded-lg transition-colors ${
                  tecnologia.is_active
                    ? 'text-red-600 hover:bg-red-50'
                    : 'text-green-600 hover:bg-green-50'
                }`}
                title={tecnologia.is_active ? 'Desactivar' : 'Activar'}
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
          <CollapsibleFilters storageKey="tecnologias-filters" activeFiltersCount={activeFiltersCount}>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-2">
                <SearchInput
                  onChange={setSearchTerm}
                  placeholder="Buscar por nombre..."
                />
              </div>

              <Select
                value={tintaFilter}
                onChange={setTintaFilter}
                options={[
                  { value: 'all', label: 'Todas las tintas' },
                  { value: 'K', label: 'K' },
                  { value: 'CMYK', label: 'CMYK' },
                  { value: 'CMYK+W', label: 'CMYK+W' },
                  { value: 'CMYK+V', label: 'CMYK+V' },
                  { value: 'CMYK+W+V', label: 'CMYK+W+V' },
                ]}
              />

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
            Total: <span className="font-semibold">{totalCount}</span> tecnologías
          </div>
        </div>

        <Table
          columns={columns}
          data={tecnologias}
          keyExtractor={(tecnologia) => tecnologia.id}
          emptyMessage="No se encontraron tecnologías"
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
        title={modalMode === 'create' ? 'Nueva Tecnología' : 'Editar Tecnología'}
        size="md"
      >
        <TecnologiaForm
          tecnologia={selectedTecnologia || undefined}
          onSubmit={handleSubmit}
          onCancel={() => setIsModalOpen(false)}
        />
      </Modal>

      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        title="Detalles de la Tecnología"
        size="lg"
      >
        {selectedTecnologia && (
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Información General</h3>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-gray-500">Nombre</p>
                  <p className="font-medium text-lg">{selectedTecnologia.nombre}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-2">Tintas Disponibles</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedTecnologia.tintas.map((tinta) => (
                      <span
                        key={tinta}
                        className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${TINTA_COLORS[tinta]}`}
                      >
                        {tinta}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Estado</p>
                  <Badge variant={selectedTecnologia.is_active ? 'primary' : 'secondary'}>
                    {selectedTecnologia.is_active ? 'Activa' : 'Inactiva'}
                  </Badge>
                </div>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-500 uppercase">
                  Configuración de Pasos por Tinta
                </h3>
                {!loadingDetails && tintasPasosConfig.length === selectedTecnologia.tintas.length && (
                  <div className="flex items-center gap-2 text-green-600 text-sm font-medium">
                    <CheckCircle className="w-4 h-4" />
                    <span>Completo</span>
                  </div>
                )}
                {!loadingDetails && tintasPasosConfig.length !== selectedTecnologia.tintas.length && (
                  <div className="flex items-center gap-2 text-orange-600 text-sm font-medium">
                    <AlertCircle className="w-4 h-4" />
                    <span>Incompleto</span>
                  </div>
                )}
              </div>

              {loadingDetails ? (
                <div className="text-center py-6">
                  <p className="text-sm text-gray-500">Cargando configuraciones...</p>
                </div>
              ) : tintasPasosConfig.length === 0 ? (
                <div className="text-center py-6 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                  <AlertCircle className="w-10 h-10 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">
                    No hay configuraciones de pasos para las tintas
                  </p>
                </div>
              ) : (
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Tinta
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Tipo
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Paso / Grupo de Pasos
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Estación
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {tintasPasosConfig.map((config: any) => {
                        let estacionDisplay = '-';

                        if (config.paso_id && config.paso?.estacion) {
                          estacionDisplay = config.paso.estacion.nombre;
                        }

                        return (
                          <tr key={config.id}>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${TINTA_COLORS[config.tinta as TintaType]}`}>
                                {config.tinta}
                              </span>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                              {config.paso_id ? 'Paso Individual' : 'Grupo de Pasos'}
                            </td>
                            <td className="px-4 py-3 text-sm">
                              <p className="font-medium text-gray-900">
                                {config.paso?.nombre || config.grupo_paso?.nombre || '-'}
                              </p>
                              {config.paso?.etapa && (
                                <p className="text-xs text-gray-500">{config.paso.etapa}</p>
                              )}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                              {estacionDisplay}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Fechas</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Creada el</p>
                  <p className="font-medium">
                    {new Date(selectedTecnologia.created_at).toLocaleDateString('es-AR', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Última actualización</p>
                  <p className="font-medium">
                    {new Date(selectedTecnologia.updated_at).toLocaleDateString('es-AR', {
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
