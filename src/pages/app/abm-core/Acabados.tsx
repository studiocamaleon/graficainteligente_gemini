import { useState, useMemo, useCallback } from 'react';
import { Sparkles, Plus, Edit2, Power, Eye, Trash2 } from 'lucide-react';
import { Card } from '../../../components/ui/card';
import { Button } from '../../../components/ui/Button';
import { usePageHeader } from '../../../hooks/usePageHeader';
import { SearchInput } from '../../../components/ui/SearchInput';
import { Select } from '../../../components/ui/Select';
import { SearchableSelect } from '../../../components/ui/SearchableSelect';
import { Table } from '../../../components/ui/Table';
import { Pagination } from '../../../components/ui/Pagination';
import { Modal } from '../../../components/ui/Modal';
import { Badge } from '../../../components/ui/Badge';
import { CategoryColorList } from '../../../components/ui/CategoryColorList';
import { CollapsibleFilters } from '../../../components/ui/CollapsibleFilters';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { AcabadoForm, AcabadoFormData } from '../../../components/abm-core/AcabadoForm';
import { useAcabados, useAcabado } from '../../../hooks/useAcabados';
import { useCategorias } from '../../../hooks/useCategorias';
import { useEstaciones } from '../../../hooks/useEstaciones';
import { useAuth } from '../../../hooks/useAuth';
import { useDebounce } from '../../../hooks/useDebounce';
import { useConfirmDialog } from '../../../hooks/useConfirmDialog';
import type { TipoImpactoPrecio } from '../../../types/database';

const tipoImpactoLabels: Record<TipoImpactoPrecio, string> = {
  sin_impacto: 'Sin Impacto',
  precio_fijo: 'Precio Fijo',
  por_unidad: 'Por Unidad',
  por_minuto: 'Por Minuto',
  porcentual: 'Porcentual',
  por_mt2: 'Por m²',
  por_mt_lineal: 'Por Metro Lineal',
  fijo_porcentual: 'Fijo + Porcentual',
  fijo_mt2: 'Fijo + Por m²',
  fijo_mt_lineal: 'Fijo + Por Metro Lineal',
  fijo_minuto: 'Fijo + Por Minuto',
  por_mt2_manual: 'Por m² (Manual)',
  fijo_mt2_manual: 'Fijo + Por m² (Manual)',
};


export function Acabados() {
  const { profile } = useAuth();
  const canEdit = profile?.role && ['super_admin', 'admin', 'manager'].includes(profile.role);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoriaFilter, setCategoriaFilter] = useState<string>('all');
  const [estacionFilter, setEstacionFilter] = useState<string>('all');
  const [tipoImpactoFilter, setTipoImpactoFilter] = useState<string>('all');
  const [independienteFilter, setIndependienteFilter] = useState<string>('all');
  const [nivelesFilter, setNivelesFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedAcabado, setSelectedAcabado] = useState<any | null>(null);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');

  const [categoriaSearchTerm, setCategoriaSearchTerm] = useState('');
  const [estacionSearchTerm, setEstacionSearchTerm] = useState('');

  const { categorias } = useCategorias({
    searchTerm: categoriaSearchTerm,
    isActive: true,
    itemsPerPage: 100,
  });

  const { estaciones } = useEstaciones({
    searchTerm: estacionSearchTerm,
    isActive: true,
    itemsPerPage: 100,
  });

  const handleOpenCreateModal = useCallback(() => {
    setSelectedAcabado(null);
    setModalMode('create');
    setIsModalOpen(true);
  }, []);

  const headerAction = useMemo(
    () =>
      canEdit ? (
        <Button variant="primary" onClick={handleOpenCreateModal}>
          <Plus className="w-5 h-5" />
          Nuevo Acabado
        </Button>
      ) : undefined,
    [canEdit, handleOpenCreateModal]
  );

  usePageHeader('Administra acabados y terminaciones con precios y configuración flexible', headerAction);

  const debouncedSearch = useDebounce(searchTerm, 300);
  const isActiveFilter = statusFilter === 'all' ? null : statusFilter === 'active';
  const categoriaIdFilter = categoriaFilter === 'all' ? null : categoriaFilter;
  const estacionIdFilter = estacionFilter === 'all' ? null : estacionFilter;
  const tipoImpactoFilterValue = tipoImpactoFilter === 'all' ? null : (tipoImpactoFilter as TipoImpactoPrecio);
  const independienteFilterValue = independienteFilter === 'all' ? null : independienteFilter === 'si';
  const nivelesFilterValue = nivelesFilter === 'all' ? null : nivelesFilter === 'con_niveles';

  const activeFiltersCount = [
    searchTerm,
    categoriaFilter !== 'all',
    estacionFilter !== 'all',
    tipoImpactoFilter !== 'all',
    independienteFilter !== 'all',
    nivelesFilter !== 'all',
    statusFilter !== 'all'
  ].filter(Boolean).length;

  const { acabados, totalCount, loading, refetch } = useAcabados({
    searchTerm: debouncedSearch,
    categoriaId: categoriaIdFilter,
    estacionId: estacionIdFilter,
    tipoImpacto: tipoImpactoFilterValue,
    disponibleIndependiente: independienteFilterValue,
    tieneNiveles: nivelesFilterValue,
    isActive: isActiveFilter,
    page: currentPage,
    itemsPerPage,
  });

  const { createAcabado, updateAcabado, toggleAcabadoStatus, deleteAcabado, loading: mutationLoading } = useAcabado();
  const {
    dialogState,
    isLoading: isConfirmLoading,
    closeDialog,
    handleConfirm,
    confirmDelete,
    confirmAction,
  } = useConfirmDialog();

  const totalPages = Math.ceil(totalCount / itemsPerPage);

  const handleEdit = (acabado: any) => {
    setSelectedAcabado(acabado);
    setModalMode('edit');
    setIsModalOpen(true);
  };

  const handleViewDetails = (acabado: any) => {
    setSelectedAcabado(acabado);
    setIsDetailModalOpen(true);
  };

  const handleToggleStatus = async (acabado: any) => {
    if (!canEdit) return;

    const action = acabado.is_active ? 'desactivar' : 'activar';
    confirmAction({
      title: `Confirmar ${action.charAt(0).toUpperCase() + action.slice(1)}`,
      message: `¿Está seguro que desea ${action} el acabado "${acabado.nombre}"?`,
      confirmText: action.charAt(0).toUpperCase() + action.slice(1),
      variant: acabado.is_active ? 'warning' : 'info',
      onConfirm: async () => {
        const success = await toggleAcabadoStatus(acabado.id, acabado.is_active);
        if (success) {
          refetch();
        }
      },
    });
  };

  const handleDelete = async (acabado: any) => {
    if (!canEdit) return;

    confirmDelete(acabado.nombre, async () => {
      const success = await deleteAcabado(acabado.id);
      if (success) {
        refetch();
      }
    });
  };

  const handleSubmit = async (data: AcabadoFormData) => {
    try {
      if (modalMode === 'create') {
        await createAcabado(data);
        setIsModalOpen(false);
        refetch();
      } else if (selectedAcabado) {
        await updateAcabado(selectedAcabado.id, data);
        setIsModalOpen(false);
        refetch();
      }
    } catch (error) {
      console.error('Error submitting acabado:', error);
      throw error;
    }
  };

  const categoriaOptions = [
    { value: 'all', label: 'Todas las categorías' },
    ...categorias.map((cat) => ({ value: cat.id, label: cat.nombre })),
  ];

  const estacionOptions = [
    { value: 'all', label: 'Todas las estaciones' },
    ...estaciones.map((est) => ({ value: est.id, label: est.nombre })),
  ];

  const columns = [
    {
      key: 'nombre',
      header: 'Nombre',
      render: (acabado: any) => <div className="font-medium text-gray-900">{acabado.nombre}</div>,
      width: '200px',
    },
    {
      key: 'categorias',
      header: 'Categorías',
      render: (acabado: any) => (
        <CategoryColorList categories={acabado.acabados_categorias || []} maxVisible={8} />
      ),
      width: '140px',
    },
    {
      key: 'estacion',
      header: 'Estación',
      render: (acabado: any) => (
        <span className="text-sm text-gray-600">{acabado.estacion?.nombre || '-'}</span>
      ),
      width: '200px',
    },
    {
      key: 'tipo_impacto',
      header: 'Tipo de Impacto',
      render: (acabado: any) => (
        <span className="text-sm text-gray-600">
          {acabado.tiene_niveles_precio ? (
            <Badge variant="primary" size="sm">
              {acabado.niveles_precio?.length || 0} Niveles
            </Badge>
          ) : (
            tipoImpactoLabels[acabado.tipo_impacto as TipoImpactoPrecio] || '-'
          )}
        </span>
      ),
      width: '150px',
    },
    {
      key: 'independiente',
      header: 'Independiente',
      render: (acabado: any) => (
        <Badge variant={acabado.disponible_independiente ? 'primary' : 'secondary'} size="sm">
          {acabado.disponible_independiente ? 'Sí' : 'No'}
        </Badge>
      ),
      width: '110px',
    },
    {
      key: 'estado',
      header: 'Estado',
      render: (acabado: any) => (
        <Badge variant={acabado.is_active ? 'primary' : 'secondary'} size="sm">
          {acabado.is_active ? 'Activo' : 'Inactivo'}
        </Badge>
      ),
      width: '90px',
    },
    {
      key: 'acciones',
      header: 'Acciones',
      render: (acabado: any) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleViewDetails(acabado)}
            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Ver detalles"
          >
            <Eye className="w-4 h-4" />
          </button>

          {canEdit && (
            <>
              <button
                onClick={() => handleEdit(acabado)}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                title="Editar"
              >
                <Edit2 className="w-4 h-4" />
              </button>

              <button
                onClick={() => handleToggleStatus(acabado)}
                className={`p-2 rounded-lg transition-colors ${acabado.is_active ? 'text-red-600 hover:bg-red-50' : 'text-green-600 hover:bg-green-50'
                  }`}
                title={acabado.is_active ? 'Desactivar' : 'Activar'}
                disabled={mutationLoading}
              >
                <Power className="w-4 h-4" />
              </button>

              {(profile?.role === 'super_admin' || profile?.role === 'admin') && (
                <button
                  onClick={() => handleDelete(acabado)}
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
          <CollapsibleFilters storageKey="acabados-filters" activeFiltersCount={activeFiltersCount}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="md:col-span-2">
                <SearchInput onChange={setSearchTerm} placeholder="Buscar por nombre..." />
              </div>

              <SearchableSelect
                value={categoriaFilter}
                onChange={setCategoriaFilter}
                onSearch={setCategoriaSearchTerm}
                options={categoriaOptions}
                placeholder="Filtrar por categoría..."
                emptyMessage="No se encontraron categorías"
              />

              <SearchableSelect
                value={estacionFilter}
                onChange={setEstacionFilter}
                onSearch={setEstacionSearchTerm}
                options={estacionOptions}
                placeholder="Filtrar por estación..."
                emptyMessage="No se encontraron estaciones"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Select
                value={tipoImpactoFilter}
                onChange={setTipoImpactoFilter}
                options={[
                  { value: 'all', label: 'Todos los tipos' },
                  { value: 'precio_fijo', label: 'Precio Fijo' },
                  { value: 'por_unidad', label: 'Por Unidad' },
                  { value: 'porcentual', label: 'Porcentual' },
                  { value: 'por_mt2', label: 'Por m²' },
                ]}
              />

              <Select
                value={independienteFilter}
                onChange={setIndependienteFilter}
                options={[
                  { value: 'all', label: 'Todos' },
                  { value: 'si', label: 'Independientes' },
                  { value: 'no', label: 'No independientes' },
                ]}
              />

              <Select
                value={nivelesFilter}
                onChange={setNivelesFilter}
                options={[
                  { value: 'all', label: 'Todos' },
                  { value: 'con_niveles', label: 'Con niveles' },
                  { value: 'sin_niveles', label: 'Sin niveles' },
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
            Total: <span className="font-semibold">{totalCount}</span> acabados
          </div>
        </div>

        <Table
          columns={columns}
          data={acabados}
          keyExtractor={(acabado) => acabado.id}
          emptyMessage="No se encontraron acabados"
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
        title={modalMode === 'create' ? 'Nuevo Acabado' : 'Editar Acabado'}
        size="xl"
      >
        <AcabadoForm
          acabado={selectedAcabado || undefined}
          onSubmit={handleSubmit}
          onCancel={() => setIsModalOpen(false)}
        />
      </Modal>

      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        title="Detalles del Acabado"
        size="lg"
      >
        {selectedAcabado && (
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Información General</h3>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-gray-500">Nombre del Acabado</p>
                  <p className="font-medium text-lg">{selectedAcabado.nombre}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Categorías</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {selectedAcabado.acabados_categorias && selectedAcabado.acabados_categorias.length > 0 ? (
                        selectedAcabado.acabados_categorias.map((cat: any, idx: number) => (
                          <Badge key={idx} variant="info">
                            {cat.categoria?.nombre || '-'}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Estación</p>
                    <p className="font-medium">{selectedAcabado.estacion?.nombre || '-'}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Disponible Independiente</p>
                    <Badge variant={selectedAcabado.disponible_independiente ? 'primary' : 'secondary'}>
                      {selectedAcabado.disponible_independiente ? 'Sí' : 'No'}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Estado</p>
                    <Badge variant={selectedAcabado.is_active ? 'primary' : 'secondary'}>
                      {selectedAcabado.is_active ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>

            {selectedAcabado.tiene_niveles_precio ? (
              <div>
                <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3">Niveles de Precio</h3>
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nivel</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Valor</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {selectedAcabado.niveles_precio
                        ?.sort((a: any, b: any) => a.orden - b.orden)
                        .map((nivel: any) => (
                          <tr key={nivel.id}>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <p className="font-medium text-gray-900">{nivel.nombre}</p>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                              {tipoImpactoLabels[nivel.tipo_impacto as TipoImpactoPrecio]}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                              ${nivel.valor_impacto}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div>
                <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Configuración de Precio</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Tipo de Impacto</p>
                    <p className="font-medium">
                      {tipoImpactoLabels[selectedAcabado.tipo_impacto as TipoImpactoPrecio] || '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Valor</p>
                    <p className="font-medium">${selectedAcabado.valor_impacto || 0}</p>
                  </div>
                </div>
              </div>
            )}

            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Fechas</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Creado el</p>
                  <p className="font-medium">
                    {new Date(selectedAcabado.created_at).toLocaleDateString('es-AR', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Última actualización</p>
                  <p className="font-medium">
                    {new Date(selectedAcabado.updated_at).toLocaleDateString('es-AR', {
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
