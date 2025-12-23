import { useState, useMemo, useCallback, useEffect } from 'react';
import { Box, Plus, Edit2, Power, Eye } from 'lucide-react';
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
import { MaterialForm, MaterialFormData } from '../../../components/abm-core/MaterialForm';
import { useMateriales, useMaterial } from '../../../hooks/useMateriales';
import { useAuth } from '../../../hooks/useAuth';
import { useDebounce } from '../../../hooks/useDebounce';
import { useConfirmDialog } from '../../../hooks/useConfirmDialog';
import type { Material } from '../../../types/database';

export function Materiales() {
  const { profile } = useAuth();
  const canEdit = profile?.role && ['super_admin', 'admin', 'manager'].includes(profile.role);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [espesorFilter, setEspesorFilter] = useState<string>('all');
  const [unidadFilter, setUnidadFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [expandedMaterialId, setExpandedMaterialId] = useState<string | null>(null);

  const handleOpenCreateModal = useCallback(() => {
    setSelectedMaterial(null);
    setModalMode('create');
    setIsModalOpen(true);
  }, []);

  const headerAction = useMemo(
    () =>
      canEdit ? (
        <Button variant="primary" onClick={handleOpenCreateModal}>
          <Plus className="w-5 h-5" />
          Nuevo Material
        </Button>
      ) : undefined,
    [canEdit, handleOpenCreateModal]
  );

  usePageHeader('Gestiona los materiales y sustratos de tu producción', headerAction);

  const debouncedSearch = useDebounce(searchTerm, 300);
  const isActiveFilter = statusFilter === 'all' ? null : statusFilter === 'active';
  const aplicaEspesorFilter = espesorFilter === 'all' ? null : espesorFilter === 'con_espesor';
  const unidadEspesorFilter = unidadFilter === 'all' ? null : unidadFilter;

  const activeFiltersCount = [
    searchTerm,
    espesorFilter !== 'all',
    unidadFilter !== 'all',
    statusFilter !== 'all'
  ].filter(Boolean).length;

  const { materiales, totalCount, loading, refetch } = useMateriales({
    searchTerm: debouncedSearch,
    isActive: isActiveFilter,
    aplicaEspesor: aplicaEspesorFilter,
    unidadEspesor: unidadEspesorFilter as any,
    page: currentPage,
    itemsPerPage,
  });

  const { createMaterial, updateMaterial, toggleMaterialStatus, loading: mutationLoading } = useMaterial();
  const {
    dialogState,
    isLoading: isConfirmLoading,
    closeDialog,
    handleConfirm,
    confirmAction,
  } = useConfirmDialog();

  const totalPages = Math.ceil(totalCount / itemsPerPage);

  useEffect(() => {
    setExpandedMaterialId(null);
  }, [currentPage, searchTerm, statusFilter, espesorFilter, unidadFilter]);

  const handleToggleExpand = useCallback((materialId: string) => {
    setExpandedMaterialId((prev) => (prev === materialId ? null : materialId));
  }, []);

  const isRowExpandable = useCallback((material: Material) => {
    return material.variantes.length > 0;
  }, []);

  const renderExpandedContent = useCallback((material: Material) => {
    return (
      <div className="py-2">
        <h4 className="text-sm font-semibold text-gray-700 mb-3">Variantes y Espesores</h4>
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-white">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Variante
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Espesores Disponibles
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {material.variantes.map((variante, index) => (
                <tr key={index}>
                  <td className="px-4 py-2 whitespace-nowrap">
                    <p className="font-medium text-gray-900">{variante.nombre}</p>
                  </td>
                  <td className="px-4 py-2">
                    {variante.espesores.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {variante.espesores.map((espesor, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700"
                          >
                            {espesor} {material.unidad_espesor}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-sm text-gray-500 italic">Sin espesores definidos</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }, []);

  const handleEdit = (material: Material) => {
    setSelectedMaterial(material);
    setModalMode('edit');
    setIsModalOpen(true);
  };

  const handleViewDetails = (material: Material) => {
    setSelectedMaterial(material);
    setIsDetailModalOpen(true);
  };

  const handleToggleStatus = async (material: Material) => {
    if (!canEdit) return;

    const action = material.is_active ? 'desactivar' : 'activar';
    confirmAction({
      title: `Confirmar ${action.charAt(0).toUpperCase() + action.slice(1)}`,
      message: `¿Está seguro que desea ${action} el material "${material.nombre}"?`,
      confirmText: action.charAt(0).toUpperCase() + action.slice(1),
      variant: material.is_active ? 'warning' : 'info',
      onConfirm: async () => {
        const success = await toggleMaterialStatus(material.id, material.is_active);
        if (success) {
          refetch();
        }
      },
    });
  };

  const handleSubmit = async (data: MaterialFormData) => {
    try {
      if (modalMode === 'create') {
        const newMaterial = await createMaterial(data);
        if (newMaterial) {
          setIsModalOpen(false);
          refetch();
        }
      } else if (selectedMaterial) {
        const updated = await updateMaterial(selectedMaterial.id, data);
        if (updated) {
          setIsModalOpen(false);
          refetch();
        }
      }
    } catch (error) {
      console.error('Error submitting material:', error);
    }
  };

  const columns = [
    {
      key: 'nombre',
      header: 'Nombre',
      render: (material: Material) => (
        <div className="font-medium text-gray-900">{material.nombre}</div>
      ),
    },
    {
      key: 'aplica_espesor',
      header: 'Espesor',
      render: (material: Material) => (
        <Badge variant={material.aplica_espesor ? 'primary' : 'secondary'} size="sm">
          {material.aplica_espesor ? 'Sí' : 'No'}
        </Badge>
      ),
      width: '100px',
    },
    {
      key: 'unidad',
      header: 'Unidad',
      render: (material: Material) => (
        <span className="text-sm text-gray-600">
          {material.unidad_espesor || '-'}
        </span>
      ),
      width: '100px',
    },
    {
      key: 'variantes',
      header: 'Variantes',
      render: (material: Material) => (
        <span className={`text-sm ${material.variantes.length > 0 ? 'text-blue-600 font-medium' : 'text-gray-600'}`}>
          {material.variantes.length > 0 ? `${material.variantes.length} variante(s)` : '-'}
        </span>
      ),
      width: '120px',
    },
    {
      key: 'estado',
      header: 'Estado',
      render: (material: Material) => (
        <Badge variant={material.is_active ? 'primary' : 'secondary'} size="sm">
          {material.is_active ? 'Activo' : 'Inactivo'}
        </Badge>
      ),
      width: '100px',
    },
    {
      key: 'acciones',
      header: 'Acciones',
      render: (material: Material) => (
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => handleViewDetails(material)}
            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Ver detalles"
          >
            <Eye className="w-4 h-4" />
          </button>

          {canEdit && (
            <>
              <button
                onClick={() => handleEdit(material)}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                title="Editar"
              >
                <Edit2 className="w-4 h-4" />
              </button>

              <button
                onClick={() => handleToggleStatus(material)}
                className={`p-2 rounded-lg transition-colors ${
                  material.is_active
                    ? 'text-red-600 hover:bg-red-50'
                    : 'text-green-600 hover:bg-green-50'
                }`}
                title={material.is_active ? 'Desactivar' : 'Activar'}
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
          <CollapsibleFilters storageKey="materiales-filters" activeFiltersCount={activeFiltersCount}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="md:col-span-2">
                <SearchInput
                  onChange={setSearchTerm}
                  placeholder="Buscar por nombre..."
                />
              </div>

              <Select
                value={espesorFilter}
                onChange={setEspesorFilter}
                options={[
                  { value: 'all', label: 'Todos' },
                  { value: 'con_espesor', label: 'Con espesor' },
                  { value: 'sin_espesor', label: 'Sin espesor' },
                ]}
              />

              <Select
                value={unidadFilter}
                onChange={setUnidadFilter}
                options={[
                  { value: 'all', label: 'Todas las unidades' },
                  { value: 'gr', label: 'Gramos (gr)' },
                  { value: 'mm', label: 'Milímetros (mm)' },
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
            Total: <span className="font-semibold">{totalCount}</span> materiales
          </div>
        </div>

        <Table
          columns={columns}
          data={materiales}
          keyExtractor={(material) => material.id}
          emptyMessage="No se encontraron materiales"
          isLoading={loading}
          dense
          expandable
          expandedRowId={expandedMaterialId}
          onToggleExpand={handleToggleExpand}
          renderExpandedContent={renderExpandedContent}
          isRowExpandable={isRowExpandable}
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
        title={modalMode === 'create' ? 'Nuevo Material' : 'Editar Material'}
        size="lg"
      >
        <MaterialForm
          material={selectedMaterial || undefined}
          onSubmit={handleSubmit}
          onCancel={() => setIsModalOpen(false)}
        />
      </Modal>

      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        title="Detalles del Material"
        size="lg"
      >
        {selectedMaterial && (
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Información General</h3>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-gray-500">Nombre</p>
                  <p className="font-medium text-lg">{selectedMaterial.nombre}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Aplica Espesor</p>
                    <Badge variant={selectedMaterial.aplica_espesor ? 'primary' : 'secondary'}>
                      {selectedMaterial.aplica_espesor ? 'Sí' : 'No'}
                    </Badge>
                  </div>
                  {selectedMaterial.aplica_espesor && (
                    <div>
                      <p className="text-sm text-gray-500">Unidad de Espesor</p>
                      <p className="font-medium">{selectedMaterial.unidad_espesor}</p>
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-sm text-gray-500">Estado</p>
                  <Badge variant={selectedMaterial.is_active ? 'primary' : 'secondary'}>
                    {selectedMaterial.is_active ? 'Activo' : 'Inactivo'}
                  </Badge>
                </div>
              </div>
            </div>

            {selectedMaterial.variantes.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3">Variantes y Espesores</h3>
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Variante
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Espesores Disponibles
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {selectedMaterial.variantes.map((variante, index) => (
                        <tr key={index}>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <p className="font-medium text-gray-900">{variante.nombre}</p>
                          </td>
                          <td className="px-4 py-3">
                            {variante.espesores.length > 0 ? (
                              <div className="flex flex-wrap gap-2">
                                {variante.espesores.map((espesor, idx) => (
                                  <span
                                    key={idx}
                                    className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700"
                                  >
                                    {espesor} {selectedMaterial.unidad_espesor}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-sm text-gray-500 italic">Sin espesores definidos</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Fechas</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Creado el</p>
                  <p className="font-medium">
                    {new Date(selectedMaterial.created_at).toLocaleDateString('es-AR', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Última actualización</p>
                  <p className="font-medium">
                    {new Date(selectedMaterial.updated_at).toLocaleDateString('es-AR', {
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
